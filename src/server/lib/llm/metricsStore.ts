import { redis } from '@server/lib/redis';
import type { LlmCallMetrics, LlmSceneId } from '@server/utils/aiClient';

const LLM_METRICS_REDIS_KEY = 'admin:llm-metrics:events:v1';
const MAX_REDIS_EVENTS = 2000;
const MAX_MEMORY_EVENTS = 500;
const RECENT_CALLS_LIMIT = 40;

const memoryEvents: LlmCallMetricEvent[] = [];

export interface LlmCallMetricEvent extends LlmCallMetrics {
  recordedAt: string;
}

export interface LlmUsageAggregate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
}

export interface LlmMetricsSummaryRow {
  key: string;
  label: string;
  calls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number;
  avgSystemChars: number;
  avgUserChars: number;
  avgSchemaChars: number;
  avgRetryCount: number;
  usage: LlmUsageAggregate;
  cacheHitCalls: number;
  cacheObservedCalls: number;
  cacheHitCallRate: number | null;
  cacheCoverageRate: number | null;
}

export interface LlmMetricsSnapshot {
  source: 'redis' | 'memory';
  generatedAt: string;
  oldestRecordedAt: string | null;
  latestRecordedAt: string | null;
  usageKeys: string[];
  sceneIds: string[];
  overview: LlmMetricsSummaryRow;
  scenes: LlmMetricsSummaryRow[];
  recentCalls: LlmCallMetricEvent[];
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hasRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

function appendMemoryEvent(event: LlmCallMetricEvent): void {
  memoryEvents.unshift(event);
  if (memoryEvents.length > MAX_MEMORY_EVENTS) {
    memoryEvents.length = MAX_MEMORY_EVENTS;
  }
}

function toMetricEvent(metrics: LlmCallMetrics): LlmCallMetricEvent {
  return {
    ...metrics,
    recordedAt: new Date().toISOString(),
  };
}

function listUsageKeys(events: LlmCallMetricEvent[]): string[] {
  return Array.from(
    new Set(events.flatMap((event) => Object.keys(event.usage))),
  ).sort();
}

function readUsageField(
  usage: Record<string, number>,
  keys: string[],
  fallbackPattern?: RegExp,
): number {
  let total = 0;
  for (const key of keys) {
    if (typeof usage[key] === 'number') {
      total += usage[key];
    }
  }

  if (total > 0 || !fallbackPattern) {
    return total;
  }

  for (const [key, value] of Object.entries(usage)) {
    if (fallbackPattern.test(key) && Number.isFinite(value)) {
      total += value;
    }
  }

  return total;
}

function summarizeUsageAggregate(
  usage: Record<string, number>,
): LlmUsageAggregate {
  return {
    inputTokens: readUsageField(usage, ['inputTokens', 'promptTokens']),
    outputTokens: readUsageField(usage, ['outputTokens', 'completionTokens']),
    totalTokens: readUsageField(usage, ['totalTokens']),
    cachedInputTokens: readUsageField(
      usage,
      ['cachedInputTokens', 'cacheReadInputTokens'],
      /cached.*input|cache.*read/i,
    ),
    cacheWriteInputTokens: readUsageField(
      usage,
      ['cacheCreationInputTokens', 'cacheWriteInputTokens'],
      /cache.*(creation|write)/i,
    ),
  };
}

function emptyUsageAggregate(): LlmUsageAggregate {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
  };
}

function sumUsage(
  total: LlmUsageAggregate,
  next: LlmUsageAggregate,
): LlmUsageAggregate {
  total.inputTokens += next.inputTokens;
  total.outputTokens += next.outputTokens;
  total.totalTokens += next.totalTokens;
  total.cachedInputTokens += next.cachedInputTokens;
  total.cacheWriteInputTokens += next.cacheWriteInputTokens;
  return total;
}

function buildSummaryRow(
  key: string,
  label: string,
  events: LlmCallMetricEvent[],
): LlmMetricsSummaryRow {
  const calls = events.length;
  const successCalls = events.filter((event) => event.status === 'success').length;
  const failureCalls = calls - successCalls;
  const usage = events.reduce<LlmUsageAggregate>((acc, event) => {
    return sumUsage(acc, summarizeUsageAggregate(event.usage));
  }, emptyUsageAggregate());
  const cacheObservedCalls = events.filter((event) => {
    const aggregate = summarizeUsageAggregate(event.usage);
    return (
      aggregate.cachedInputTokens > 0 || aggregate.cacheWriteInputTokens > 0
    );
  }).length;
  const cacheHitCalls = events.filter((event) => {
    return summarizeUsageAggregate(event.usage).cachedInputTokens > 0;
  }).length;

  return {
    key,
    label,
    calls,
    successCalls,
    failureCalls,
    successRate: calls > 0 ? round(successCalls / calls, 4) : 0,
    avgSystemChars:
      calls > 0
        ? round(
            events.reduce((sum, event) => sum + event.systemChars, 0) / calls,
          )
        : 0,
    avgUserChars:
      calls > 0
        ? round(
            events.reduce((sum, event) => sum + event.userChars, 0) / calls,
          )
        : 0,
    avgSchemaChars:
      calls > 0
        ? round(
            events.reduce((sum, event) => sum + event.schemaChars, 0) / calls,
          )
        : 0,
    avgRetryCount:
      calls > 0
        ? round(
            events.reduce((sum, event) => sum + event.retryCount, 0) / calls,
            3,
          )
        : 0,
    usage,
    cacheHitCalls,
    cacheObservedCalls,
    cacheHitCallRate:
      cacheObservedCalls > 0 ? round(cacheHitCalls / cacheObservedCalls, 4) : null,
    cacheCoverageRate:
      usage.inputTokens > 0
        ? round(usage.cachedInputTokens / usage.inputTokens, 4)
        : null,
  };
}

function filterEventsByScene(
  events: LlmCallMetricEvent[],
  sceneId?: string,
): LlmCallMetricEvent[] {
  if (!sceneId || sceneId === 'all') {
    return events;
  }
  return events.filter((event) => event.sceneId === sceneId);
}

export function buildLlmMetricsSnapshot(args: {
  events: LlmCallMetricEvent[];
  source: 'redis' | 'memory';
  sceneId?: string;
}): LlmMetricsSnapshot {
  const filteredEvents = filterEventsByScene(args.events, args.sceneId);
  const sceneIds = Array.from(
    new Set(args.events.map((event) => event.sceneId)),
  ).sort() as Array<LlmSceneId | 'unknown'>;
  const eventsByScene = sceneIds
    .map((sceneId) => {
      const sceneEvents = filteredEvents.filter((event) => event.sceneId === sceneId);
      if (sceneEvents.length === 0) return null;
      return buildSummaryRow(sceneId, sceneId, sceneEvents);
    })
    .filter((row): row is LlmMetricsSummaryRow => Boolean(row))
    .sort((a, b) => b.calls - a.calls);

  return {
    source: args.source,
    generatedAt: new Date().toISOString(),
    oldestRecordedAt: filteredEvents[filteredEvents.length - 1]?.recordedAt ?? null,
    latestRecordedAt: filteredEvents[0]?.recordedAt ?? null,
    usageKeys: listUsageKeys(filteredEvents),
    sceneIds,
    overview: buildSummaryRow(
      args.sceneId ?? 'all',
      args.sceneId && args.sceneId !== 'all' ? args.sceneId : '全部场景',
      filteredEvents,
    ),
    scenes: eventsByScene,
    recentCalls: filteredEvents.slice(0, RECENT_CALLS_LIMIT),
  };
}

async function persistEventToRedis(event: LlmCallMetricEvent): Promise<void> {
  if (!hasRedisConfigured()) {
    return;
  }

  try {
    await redis
      .multi()
      .lpush(LLM_METRICS_REDIS_KEY, JSON.stringify(event))
      .ltrim(LLM_METRICS_REDIS_KEY, 0, MAX_REDIS_EVENTS - 1)
      .exec();
  } catch (error) {
    console.warn('[LLM_METRICS] failed to persist event to redis', error);
  }
}

export function recordLlmCallMetric(metrics: LlmCallMetrics): void {
  const event = toMetricEvent(metrics);
  appendMemoryEvent(event);
  void persistEventToRedis(event);
}

async function readEventsFromRedis(limit: number): Promise<LlmCallMetricEvent[]> {
  const rows = await redis.lrange(LLM_METRICS_REDIS_KEY, 0, limit - 1);
  return rows
    .map((row) => {
      try {
        return JSON.parse(row) as LlmCallMetricEvent;
      } catch {
        return null;
      }
    })
    .filter((row): row is LlmCallMetricEvent => Boolean(row));
}

export async function getLlmMetricsSnapshot(args?: {
  limit?: number;
  sceneId?: string;
}): Promise<LlmMetricsSnapshot> {
  const limit = clamp(args?.limit ?? 300, 20, MAX_REDIS_EVENTS);

  if (hasRedisConfigured()) {
    try {
      const events = await readEventsFromRedis(limit);
      return buildLlmMetricsSnapshot({
        events,
        source: 'redis',
        sceneId: args?.sceneId,
      });
    } catch (error) {
      console.warn('[LLM_METRICS] failed to read redis snapshot', error);
    }
  }

  return buildLlmMetricsSnapshot({
    events: memoryEvents.slice(0, limit),
    source: 'memory',
    sceneId: args?.sceneId,
  });
}
