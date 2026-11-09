import type {
  AdminAiUsageQuery,
  AdminAiUsageSceneSummary,
  AdminAiUsageSnapshot,
  AiUsagePricingSnapshot,
  AiUsageTotals,
} from '@daoyou/contracts/admin/ai-usage';
import type { AiUsage } from '@nestjs/ai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  aiUsageDateStart,
  shiftAiUsageDate,
} from '@server/admin/ai-usage-input.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { RequestWorkService } from '@server/http/request-work.service.js';
import { runDbTasks, type DbClient } from '@server/lib/drizzle/db.js';
import { aiUsageEvents } from '@server/lib/drizzle/schema.js';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

export interface AiUsageRecordInput {
  sceneId?: string;
  provider: string;
  modelId: string;
  modelAlias?: string;
  step: number;
  attempt: number;
  fallback: boolean;
  stream: boolean;
  usage: AiUsage;
  durationMs: number;
  finishReason: string;
  estimatedCost?: string | number;
  currency?: string;
  pricingSnapshot?: AiUsagePricingSnapshot;
}

const count = z.number().int().nonnegative();
const recordSchema = z.object({
  sceneId: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(120),
  modelId: z.string().trim().min(1).max(240),
  modelAlias: z.string().trim().min(1).max(120).optional(),
  step: count.max(2_147_483_647),
  attempt: z.number().int().min(1).max(2_147_483_647),
  fallback: z.boolean(),
  stream: z.boolean(),
  usage: z.object({
    inputTokens: count,
    outputTokens: count,
    totalTokens: count,
    cachedInputTokens: count,
    reasoningTokens: count,
  }),
  durationMs: count,
  finishReason: z.string().min(1).max(100),
});

const pricingSchema = z.strictObject({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cachedInput: z.number().nonnegative().optional(),
  condition: z.string().max(2_000).optional(),
  source: z.string().max(2_000).optional(),
  verifiedAt: z.string().max(100).optional(),
});

type AggregateRow = Record<string, unknown> &
  AiUsageTotals & {
    kind: 'overview' | 'scene' | 'model' | 'daily';
    sceneId: string | null;
    provider: string | null;
    modelId: string | null;
    modelAlias: string | null;
    date: string | null;
  };

function emptyTotals(): AiUsageTotals {
  return {
    steps: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    totalDurationMs: 0,
    averageDurationMs: null,
    pricedSteps: 0,
    unpricedSteps: 0,
    costs: [],
  };
}

function totalsOf(row: AggregateRow): AiUsageTotals {
  return {
    steps: row.steps,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    cachedInputTokens: row.cachedInputTokens,
    reasoningTokens: row.reasoningTokens,
    totalDurationMs: row.totalDurationMs,
    averageDurationMs: row.averageDurationMs,
    pricedSteps: row.pricedSteps,
    unpricedSteps: row.unpricedSteps,
    costs: row.costs,
  };
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(RequestWorkService) private readonly work: RequestWorkService,
  ) {}

  /** Native onUsage is fire-and-forget; keep its insert in the existing shutdown drain. */
  async record(input: AiUsageRecordInput): Promise<void> {
    const release = this.work.begin();
    try {
      const parsed = recordSchema.safeParse({
        ...input,
        sceneId: input.sceneId?.trim() || 'unlabeled',
      });
      if (!parsed.success) {
        this.logger.warn(
          `Skipping invalid native usage: ${parsed.error.message}`,
        );
        return;
      }
      const record = parsed.data;
      const pricing = pricingSchema.safeParse(input.pricingSnapshot);
      const cost =
        input.estimatedCost === undefined
          ? undefined
          : String(input.estimatedCost);
      const currency = input.currency?.trim();
      const priced =
        cost !== undefined &&
        /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(cost) &&
        Number.isFinite(Number(cost)) &&
        Number(cost) >= 0 &&
        currency !== undefined &&
        /^[A-Z]{3,12}$/.test(currency) &&
        pricing.success;
      if (input.estimatedCost !== undefined && !priced) {
        this.logger.warn(
          'Native usage has incomplete pricing; recording it as unpriced',
        );
      }
      await this.database.insert(aiUsageEvents).values({
        sceneId: record.sceneId,
        credentialSource: 'server',
        provider: record.provider,
        modelId: record.modelId,
        modelAlias: record.modelAlias ?? null,
        step: record.step,
        attempt: record.attempt,
        fallback: record.fallback,
        stream: record.stream,
        inputTokens: record.usage.inputTokens,
        outputTokens: record.usage.outputTokens,
        totalTokens: record.usage.totalTokens,
        cachedInputTokens: record.usage.cachedInputTokens,
        reasoningTokens: record.usage.reasoningTokens,
        durationMs: record.durationMs,
        finishReason: record.finishReason,
        estimatedCost: priced ? cost : null,
        currency: priced ? currency : null,
        pricingSnapshot: priced && pricing.success ? pricing.data : null,
      });
    } catch (error) {
      this.logger.error('Failed to persist native AI usage', error);
    } finally {
      release();
    }
  }

  async snapshot(query: AdminAiUsageQuery): Promise<AdminAiUsageSnapshot> {
    const baseConditions = [
      eq(aiUsageEvents.credentialSource, 'server'),
      gte(aiUsageEvents.recordedAt, aiUsageDateStart(query.from)),
      lt(
        aiUsageEvents.recordedAt,
        aiUsageDateStart(shiftAiUsageDate(query.to, 1)),
      ),
    ];
    const conditions = [...baseConditions];
    if (query.sceneId)
      conditions.push(eq(aiUsageEvents.sceneId, query.sceneId));
    if (query.provider)
      conditions.push(eq(aiUsageEvents.provider, query.provider));
    if (query.modelId)
      conditions.push(eq(aiUsageEvents.modelId, query.modelId));
    const where = and(...conditions);

    const [aggregates, events, optionRows] = await runDbTasks(this.database, [
      () =>
        this.database.execute<AggregateRow>(sql`
        with filtered as (
          select *, (recorded_at at time zone 'Asia/Shanghai')::date as usage_date
          from ${aiUsageEvents} where ${where}
        ), grouped as (
          select
            case
              when grouping(usage_date) = 0 then 'daily'
              when grouping(provider) = 0 then 'model'
              when grouping(scene_id) = 0 then 'scene'
              else 'overview'
            end as kind,
            scene_id, provider, model_id, model_alias, usage_date, currency,
            count(*) as steps,
            sum(input_tokens) as input_tokens,
            sum(output_tokens) as output_tokens,
            sum(total_tokens) as total_tokens,
            sum(cached_input_tokens) as cached_input_tokens,
            sum(reasoning_tokens) as reasoning_tokens,
            sum(duration_ms) as duration_ms,
            count(*) filter (where estimated_cost is not null) as priced_steps,
            count(*) filter (where estimated_cost is null) as unpriced_steps,
            sum(estimated_cost)::text as estimated_cost
          from filtered
          group by grouping sets (
            (currency),
            (scene_id, currency),
            (scene_id, provider, model_id, model_alias, currency),
            (usage_date, currency)
          )
        )
        select kind, scene_id as "sceneId", provider, model_id as "modelId",
          model_alias as "modelAlias", usage_date::text as date,
          sum(steps)::double precision as steps,
          sum(input_tokens)::double precision as "inputTokens",
          sum(output_tokens)::double precision as "outputTokens",
          sum(total_tokens)::double precision as "totalTokens",
          sum(cached_input_tokens)::double precision as "cachedInputTokens",
          sum(reasoning_tokens)::double precision as "reasoningTokens",
          sum(duration_ms)::double precision as "totalDurationMs",
          sum(duration_ms)::double precision / nullif(sum(steps), 0)::double precision as "averageDurationMs",
          sum(priced_steps)::double precision as "pricedSteps",
          sum(unpriced_steps)::double precision as "unpricedSteps",
          coalesce(jsonb_agg(jsonb_build_object(
            'currency', currency, 'estimatedCost', estimated_cost, 'steps', priced_steps
          ) order by currency) filter (where estimated_cost is not null), '[]'::jsonb) as costs
        from grouped
        group by kind, scene_id, provider, model_id, model_alias, usage_date
      `),
      () =>
        this.database
          .select()
          .from(aiUsageEvents)
          .where(where)
          .orderBy(desc(aiUsageEvents.recordedAt), desc(aiUsageEvents.id))
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize),
      () =>
        this.database
          .selectDistinct({
            sceneId: aiUsageEvents.sceneId,
            provider: aiUsageEvents.provider,
            modelId: aiUsageEvents.modelId,
          })
          .from(aiUsageEvents)
          .where(and(...baseConditions)),
    ]);

    const overviewRow = aggregates.rows.find((row) => row.kind === 'overview');
    const overview = overviewRow ? totalsOf(overviewRow) : emptyTotals();
    const scenes: AdminAiUsageSceneSummary[] = aggregates.rows
      .filter((row) => row.kind === 'scene')
      .map((row) => ({
        ...totalsOf(row),
        sceneId: row.sceneId!,
        models: aggregates.rows
          .filter(
            (model) => model.kind === 'model' && model.sceneId === row.sceneId,
          )
          .map((model) => ({
            ...totalsOf(model),
            provider: model.provider!,
            modelId: model.modelId!,
            modelAlias: model.modelAlias,
          }))
          .sort(
            (left, right) =>
              right.steps - left.steps ||
              left.modelId.localeCompare(right.modelId),
          ),
      }))
      .sort(
        (left, right) =>
          right.steps - left.steps || left.sceneId.localeCompare(right.sceneId),
      );
    const dailyRows = new Map(
      aggregates.rows
        .filter((row) => row.kind === 'daily')
        .map((row) => [row.date!, totalsOf(row)]),
    );
    const daily: AdminAiUsageSnapshot['daily'] = [];
    for (
      let date = query.from;
      date <= query.to;
      date = shiftAiUsageDate(date, 1)
    ) {
      daily.push({ date, ...(dailyRows.get(date) ?? emptyTotals()) });
    }
    const models = new Map(
      optionRows.map((row) => [
        JSON.stringify([row.provider, row.modelId]),
        { provider: row.provider, modelId: row.modelId },
      ]),
    );

    return {
      generatedAt: new Date().toISOString(),
      timeZone: 'Asia/Shanghai',
      query,
      overview,
      scenes,
      daily,
      options: {
        sceneIds: [...new Set(optionRows.map((row) => row.sceneId))].sort(),
        providers: [...new Set(optionRows.map((row) => row.provider))].sort(),
        models: [...models.values()].sort(
          (left, right) =>
            left.provider.localeCompare(right.provider) ||
            left.modelId.localeCompare(right.modelId),
        ),
      },
      events: events.map((event) => ({
        ...event,
        recordedAt: event.recordedAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: overview.steps,
        totalPages: Math.ceil(overview.steps / query.pageSize),
      },
    };
  }
}
