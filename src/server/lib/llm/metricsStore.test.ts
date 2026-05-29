import { describe, expect, it } from 'vitest';
import { buildLlmMetricsSnapshot, type LlmCallMetricEvent } from './metricsStore';

describe('buildLlmMetricsSnapshot', () => {
  it('aggregates scene stats and cache-related usage fields', () => {
    const events: LlmCallMetricEvent[] = [
      {
        recordedAt: '2026-05-29T08:00:00.000Z',
        sceneId: 'dungeon-round',
        provider: 'deepseek',
        model: 'deepseek-chat',
        systemChars: 2600,
        userChars: 900,
        schemaChars: 2100,
        retryCount: 0,
        usage: {
          inputTokens: 1000,
          outputTokens: 220,
          totalTokens: 1220,
          cachedInputTokens: 400,
        },
        status: 'success',
      },
      {
        recordedAt: '2026-05-29T08:05:00.000Z',
        sceneId: 'dungeon-round',
        provider: 'deepseek',
        model: 'deepseek-chat',
        systemChars: 2600,
        userChars: 1000,
        schemaChars: 2100,
        retryCount: 1,
        usage: {
          inputTokens: 1200,
          outputTokens: 260,
          totalTokens: 1460,
          cacheCreationInputTokens: 300,
        },
        status: 'failure',
      },
      {
        recordedAt: '2026-05-29T08:10:00.000Z',
        sceneId: 'fate-naming',
        provider: 'deepseek',
        model: 'deepseek-chat',
        systemChars: 400,
        userChars: 120,
        schemaChars: 150,
        retryCount: 0,
        usage: {
          inputTokens: 80,
          outputTokens: 30,
          totalTokens: 110,
        },
        status: 'success',
      },
    ];

    const snapshot = buildLlmMetricsSnapshot({
      events,
      source: 'memory',
    });

    expect(snapshot.overview.calls).toBe(3);
    expect(snapshot.overview.successCalls).toBe(2);
    expect(snapshot.overview.usage.cachedInputTokens).toBe(400);
    expect(snapshot.overview.usage.cacheWriteInputTokens).toBe(300);
    expect(snapshot.overview.cacheObservedCalls).toBe(2);
    expect(snapshot.overview.cacheHitCalls).toBe(1);
    expect(snapshot.scenes[0]).toMatchObject({
      key: 'dungeon-round',
      calls: 2,
      successCalls: 1,
      failureCalls: 1,
      usage: {
        inputTokens: 2200,
        outputTokens: 480,
        totalTokens: 2680,
        cachedInputTokens: 400,
        cacheWriteInputTokens: 300,
      },
    });
  });
});
