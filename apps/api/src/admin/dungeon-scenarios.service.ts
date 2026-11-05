import type {
  AdminDungeonJob,
  AdminDungeonJobList,
  AdminDungeonJobsQuerySchema,
  AdminDungeonRestockSchema,
  AdminDungeonScenarioDetail,
  AdminDungeonScenarioList,
  AdminDungeonScenarioListQuerySchema,
  AdminDungeonScenarioRow,
  AdminDungeonSlot,
  AdminDungeonSlotsQuerySchema,
  AdminDungeonSlotsView,
  AdminDungeonWarmupSchema,
} from '@daoyou/contracts/admin/dungeon-scenarios';
import { getMysteryTemplate } from '@daoyou/game-content/dungeon/scenarios';
import { getMapNode } from '@daoyou/game-content/world/map';
import { MYSTERY_LIBRARY_POLICY } from '@daoyou/game-rules/dungeon/mystery';
import { HttpException, Injectable } from '@nestjs/common';
import { MYSTERY_GENERATOR_VERSION } from '@server/dungeon/application/mystery/MysteryCaseGenerator.js';
import {
  configuredSlots,
  enqueueAdminScenarioJobs,
  retryFailedScenarioJob,
} from '@server/dungeon/application/mystery/ScenarioLibrary.js';
import { isBackgroundLlmEnabled } from '@server/lib/config/environment.js';
import { db } from '@server/lib/drizzle/db.js';
import {
  dungeonScenarioJobs,
  dungeonScenarios,
} from '@server/lib/drizzle/schema.js';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';

const PAGE_SIZE = 50;

const nodeName = (id: string) => getMapNode(id)?.name ?? id;
const templateName = (id: string) => getMysteryTemplate(id)?.name ?? id;
const slotKey = (mapNodeId: string, templateId: string) =>
  `${mapNodeId}|${templateId}`;

type ScenarioRecord = typeof dungeonScenarios.$inferSelect;

function toRow(r: ScenarioRecord): AdminDungeonScenarioRow {
  return {
    id: r.id,
    mapNodeId: r.mapNodeId,
    nodeName: nodeName(r.mapNodeId),
    templateId: r.templateId,
    templateName: templateName(r.templateId),
    title: r.title,
    variant: r.caseFile.variant ?? 'base',
    source: r.source,
    generatorVersion: r.generatorVersion,
    status: r.status,
    reviewIssueCount: r.reviewIssueCount,
    playCount: r.playCount,
    completionCount: r.completionCount,
    averageScore:
      r.completionCount > 0 ? Math.round(r.scoreSum / r.completionCount) : null,
    createdAt: r.createdAt.toISOString(),
    retiredAt: r.retiredAt?.toISOString() ?? null,
  };
}

function toJob(r: typeof dungeonScenarioJobs.$inferSelect): AdminDungeonJob {
  return {
    id: r.id,
    mapNodeId: r.mapNodeId,
    nodeName: nodeName(r.mapNodeId),
    templateId: r.templateId,
    templateName: templateName(r.templateId),
    status: r.status,
    reason: r.reason,
    attempts: r.attempts,
    error: r.error,
    scenarioId: r.scenarioId,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

/** 云游剧本管理：库存总览、剧本库、生成任务；写操作只做停用恢复与投递任务。 */
@Injectable()
export class AdminDungeonScenariosService {
  async slots(
    query: z.infer<typeof AdminDungeonSlotsQuerySchema>,
  ): Promise<AdminDungeonSlotsView> {
    const { slots, pendingTotal } = await this.allSlots();
    const names = (pick: (s: AdminDungeonSlot) => [string, string]) =>
      [...new Map(slots.map(pick))].map(([id, name]) => ({ id, name }));
    return {
      slots: slots.slice((query.page - 1) * PAGE_SIZE, query.page * PAGE_SIZE),
      total: slots.length,
      page: query.page,
      pageSize: PAGE_SIZE,
      emptyTotal: slots.filter((s) => s.active === 0).length,
      nodes: names((s) => [s.mapNodeId, s.nodeName]),
      templates: names((s) => [s.templateId, s.templateName]),
      pendingTotal,
      maxPendingPerNode: MYSTERY_LIBRARY_POLICY.maxPendingPerNode,
      warmupPerSlot: MYSTERY_LIBRARY_POLICY.warmupPerSlot,
      backgroundGeneration: isBackgroundLlmEnabled(),
      generatorVersion: MYSTERY_GENERATOR_VERSION,
    };
  }

  /** 全部库存位的在用、排队、生成中与最近失败，按配置顺序。 */
  private async allSlots(): Promise<{
    slots: AdminDungeonSlot[];
    pendingTotal: number;
  }> {
    const [active, pending, failures] = await Promise.all([
      db
        .select({
          mapNodeId: dungeonScenarios.mapNodeId,
          templateId: dungeonScenarios.templateId,
          n: count(),
        })
        .from(dungeonScenarios)
        .where(
          and(
            eq(dungeonScenarios.status, 'active'),
            eq(dungeonScenarios.generatorVersion, MYSTERY_GENERATOR_VERSION),
          ),
        )
        .groupBy(dungeonScenarios.mapNodeId, dungeonScenarios.templateId),
      db
        .select({
          mapNodeId: dungeonScenarioJobs.mapNodeId,
          templateId: dungeonScenarioJobs.templateId,
          status: dungeonScenarioJobs.status,
          n: count(),
        })
        .from(dungeonScenarioJobs)
        .where(inArray(dungeonScenarioJobs.status, ['queued', 'running']))
        .groupBy(
          dungeonScenarioJobs.mapNodeId,
          dungeonScenarioJobs.templateId,
          dungeonScenarioJobs.status,
        ),
      // 每个库存位最近一次失败的任务。
      db
        .selectDistinctOn(
          [dungeonScenarioJobs.mapNodeId, dungeonScenarioJobs.templateId],
          {
            mapNodeId: dungeonScenarioJobs.mapNodeId,
            templateId: dungeonScenarioJobs.templateId,
            at: dungeonScenarioJobs.finishedAt,
            error: dungeonScenarioJobs.error,
          },
        )
        .from(dungeonScenarioJobs)
        .where(eq(dungeonScenarioJobs.status, 'failed'))
        .orderBy(
          dungeonScenarioJobs.mapNodeId,
          dungeonScenarioJobs.templateId,
          desc(dungeonScenarioJobs.finishedAt),
        ),
    ]);
    const activeBy = new Map(
      active.map((r) => [slotKey(r.mapNodeId, r.templateId), r.n]),
    );
    const pendingBy = new Map<string, { queued: number; running: number }>();
    let pendingTotal = 0;
    for (const r of pending) {
      const key = slotKey(r.mapNodeId, r.templateId);
      const entry = pendingBy.get(key) ?? { queued: 0, running: 0 };
      if (r.status === 'running') entry.running += r.n;
      else entry.queued += r.n;
      pendingBy.set(key, entry);
      pendingTotal += r.n;
    }
    const failureBy = new Map(
      failures.map((r) => [slotKey(r.mapNodeId, r.templateId), r]),
    );
    return {
      slots: configuredSlots().map(({ mapNodeId, templateId }) => {
        const key = slotKey(mapNodeId, templateId);
        const failure = failureBy.get(key);
        return {
          mapNodeId,
          nodeName: nodeName(mapNodeId),
          templateId,
          templateName: templateName(templateId),
          active: activeBy.get(key) ?? 0,
          queued: pendingBy.get(key)?.queued ?? 0,
          running: pendingBy.get(key)?.running ?? 0,
          lastFailure: failure?.at
            ? { at: failure.at.toISOString(), error: failure.error }
            : null,
        };
      }),
      pendingTotal,
    };
  }

  async list(
    query: z.infer<typeof AdminDungeonScenarioListQuerySchema>,
  ): Promise<AdminDungeonScenarioList> {
    const where = and(
      query.mapNodeId
        ? eq(dungeonScenarios.mapNodeId, query.mapNodeId)
        : undefined,
      query.templateId
        ? eq(dungeonScenarios.templateId, query.templateId)
        : undefined,
      query.status ? eq(dungeonScenarios.status, query.status) : undefined,
      query.source ? eq(dungeonScenarios.source, query.source) : undefined,
      query.generatorVersion
        ? eq(dungeonScenarios.generatorVersion, query.generatorVersion)
        : undefined,
    );
    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(dungeonScenarios)
        .where(where)
        .orderBy(desc(dungeonScenarios.createdAt))
        .limit(PAGE_SIZE)
        .offset((query.page - 1) * PAGE_SIZE),
      db.select({ n: count() }).from(dungeonScenarios).where(where),
    ]);
    return {
      rows: rows.map(toRow),
      total: total?.n ?? 0,
      page: query.page,
      pageSize: PAGE_SIZE,
    };
  }

  async detail(id: string): Promise<AdminDungeonScenarioDetail> {
    const [row] = await db
      .select()
      .from(dungeonScenarios)
      .where(eq(dungeonScenarios.id, id))
      .limit(1);
    if (!row) throw new HttpException('剧本不存在', 404);
    const template = getMysteryTemplate(row.templateId);
    return {
      ...toRow(row),
      caseFile: row.caseFile,
      generation: row.generation ?? null,
      labels: {
        roles: Object.fromEntries(
          (template?.roles ?? []).map((r) => [r.slot, r.label]),
        ),
        questions: Object.fromEntries(
          (template?.questions ?? []).map((q) => [q.id, q.prompt]),
        ),
      },
    };
  }

  async setStatus(id: string, status: 'active' | 'retired') {
    const [row] = await db
      .update(dungeonScenarios)
      .set({ status, retiredAt: status === 'retired' ? new Date() : null })
      .where(eq(dungeonScenarios.id, id))
      .returning();
    if (!row) throw new HttpException('剧本不存在', 404);
    return toRow(row);
  }

  async jobs(
    query: z.infer<typeof AdminDungeonJobsQuerySchema>,
  ): Promise<AdminDungeonJobList> {
    const where = query.status
      ? eq(dungeonScenarioJobs.status, query.status)
      : undefined;
    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(dungeonScenarioJobs)
        .where(where)
        .orderBy(desc(dungeonScenarioJobs.createdAt))
        .limit(PAGE_SIZE)
        .offset((query.page - 1) * PAGE_SIZE),
      db.select({ n: count() }).from(dungeonScenarioJobs).where(where),
    ]);
    return {
      rows: rows.map(toJob),
      total: total?.n ?? 0,
      page: query.page,
      pageSize: PAGE_SIZE,
    };
  }

  restock(input: z.infer<typeof AdminDungeonRestockSchema>) {
    const known = configuredSlots().some(
      (s) =>
        s.mapNodeId === input.mapNodeId && s.templateId === input.templateId,
    );
    if (!known) throw new HttpException('此节点没有配置该案型', 400);
    return enqueueAdminScenarioJobs([input]);
  }

  /** 按缺口为每个库存位投递任务，使在用数加排队数达到 perSlot。 */
  async warmup(input: z.infer<typeof AdminDungeonWarmupSchema>) {
    const { slots } = await this.allSlots();
    const wanted = slots.flatMap((slot) =>
      Array.from(
        {
          length: Math.max(
            0,
            input.perSlot - slot.active - slot.queued - slot.running,
          ),
        },
        () => ({ mapNodeId: slot.mapNodeId, templateId: slot.templateId }),
      ),
    );
    return enqueueAdminScenarioJobs(wanted);
  }

  async retryJob(id: string) {
    const ok = await retryFailedScenarioJob(id);
    if (!ok) throw new HttpException('只有失败的任务可以重试', 409);
    return { ok };
  }
}
