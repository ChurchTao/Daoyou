import {
  getMysteryFallbackCase,
  getMysteryTemplate,
  listMysteryFallbackSeeds,
} from '@daoyou/game-content/dungeon/scenarios';
import {
  getAllSatelliteNodes,
  getMapNode,
} from '@daoyou/game-content/world/map';
import {
  MysteryCaseFileSchema,
  type MysteryCaseFile,
} from '@daoyou/game-domain/dungeon/mystery';
import {
  decideMysteryRestock,
  MYSTERY_LIBRARY_POLICY,
  shouldRetireMysteryScenario,
  validateMysteryCase,
  type LibraryPlay,
  type LibraryScenario,
  type RestockDecision,
} from '@daoyou/game-rules/dungeon/mystery';
import {
  db,
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  dungeonScenarioJobs,
  dungeonScenarioPlays,
  dungeonScenarios,
} from '@server/lib/drizzle/schema.js';
import { isBackgroundLlmEnabled } from '@server/lib/config/environment.js';
import { publishScheduledBackgroundCommand } from '@server/lib/mq/backgroundCommandPublisher.js';
import { and, count, eq, inArray, lt, max, sql } from 'drizzle-orm';
import {
  generateMysteryCase,
  MYSTERY_GENERATOR_VERSION,
} from './MysteryCaseGenerator.js';
import { reviewMysteryCase } from './MysteryCaseReview.js';

type JobReason = (typeof dungeonScenarioJobs.$inferInsert)['reason'];

/** 节点上配置且存在的剧本模板，即该节点的剧本槽。 */
export function scenarioTemplatesForNode(mapNodeId: string): string[] {
  const templates = getMapNode(mapNodeId)?.dungeon_config?.scenario?.templates;
  return (templates ?? []).filter((id) => getMysteryTemplate(id));
}

/** 选本所需的库存与该角色的游玩记录。 */
export async function readScenarioLibrary(
  cultivatorId: string,
  mapNodeId: string,
  templateIds: readonly string[],
  q: DbExecutor = db,
): Promise<{ scenarios: LibraryScenario[]; plays: LibraryPlay[] }> {
  if (templateIds.length === 0) return { scenarios: [], plays: [] };
  const [scenarios, plays] = await Promise.all([
    q
      .select({
        id: dungeonScenarios.id,
        templateId: dungeonScenarios.templateId,
        playCount: dungeonScenarios.playCount,
      })
      .from(dungeonScenarios)
      .where(
        and(
          eq(dungeonScenarios.mapNodeId, mapNodeId),
          inArray(dungeonScenarios.templateId, [...templateIds]),
          eq(dungeonScenarios.status, 'active'),
        ),
      ),
    q
      .select({
        scenarioId: dungeonScenarioPlays.scenarioId,
        templateId: dungeonScenarioPlays.templateId,
        lastPlayedAt: dungeonScenarioPlays.lastPlayedAt,
        completed: dungeonScenarioPlays.completed,
      })
      .from(dungeonScenarioPlays)
      .where(
        and(
          eq(dungeonScenarioPlays.cultivatorId, cultivatorId),
          eq(dungeonScenarioPlays.mapNodeId, mapNodeId),
        ),
      ),
  ]);
  return {
    scenarios,
    plays: plays.map((p) => ({ ...p, lastPlayedAt: p.lastPlayedAt.getTime() })),
  };
}

/** 读取剧本案卷；与当前引擎不兼容的剧本直接停用并返回空。 */
export async function loadScenarioCase(
  scenarioId: string,
  q: DbExecutor = db,
): Promise<MysteryCaseFile | null> {
  const [row] = await q
    .select({
      caseFile: dungeonScenarios.caseFile,
      templateId: dungeonScenarios.templateId,
    })
    .from(dungeonScenarios)
    .where(eq(dungeonScenarios.id, scenarioId))
    .limit(1);
  if (!row) return null;
  const template = getMysteryTemplate(row.templateId);
  const parsed = MysteryCaseFileSchema.safeParse(row.caseFile);
  if (
    template &&
    parsed.success &&
    validateMysteryCase(parsed.data, template).length === 0
  )
    return parsed.data;
  console.warn('[ScenarioLibrary] 剧本与当前引擎不兼容，已停用:', scenarioId);
  await q
    .update(dungeonScenarios)
    .set({ status: 'retired', retiredAt: new Date() })
    .where(eq(dungeonScenarios.id, scenarioId));
  return null;
}

export async function insertScenario(
  q: DbExecutor,
  values: {
    id?: string;
    mapNodeId: string;
    templateId: string;
    caseFile: MysteryCaseFile;
    source: 'generated' | 'seed';
    reviewIssueCount?: number;
    generation?: Record<string, unknown>;
  },
): Promise<string> {
  const [row] = await q
    .insert(dungeonScenarios)
    .values({
      ...values,
      title: values.caseFile.title,
      generatorVersion: MYSTERY_GENERATOR_VERSION,
    })
    .onConflictDoNothing()
    .returning({ id: dungeonScenarios.id });
  return row?.id ?? values.id!;
}

/** 开局记录：角色游玩记录，首次游玩时累加剧本的全服游玩人数。 */
export async function recordScenarioStart(
  q: DbExecutor,
  args: {
    cultivatorId: string;
    scenarioId: string;
    mapNodeId: string;
    templateId: string;
    firstPlay: boolean;
  },
) {
  const now = new Date();
  await q
    .insert(dungeonScenarioPlays)
    .values({
      cultivatorId: args.cultivatorId,
      scenarioId: args.scenarioId,
      mapNodeId: args.mapNodeId,
      templateId: args.templateId,
      firstPlayedAt: now,
      lastPlayedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        dungeonScenarioPlays.cultivatorId,
        dungeonScenarioPlays.scenarioId,
      ],
      set: {
        playCount: sql`${dungeonScenarioPlays.playCount} + 1`,
        lastPlayedAt: now,
      },
    });
  if (args.firstPlay)
    await q
      .update(dungeonScenarios)
      .set({ playCount: sql`${dungeonScenarios.playCount} + 1` })
      .where(eq(dungeonScenarios.id, args.scenarioId));
}

/**
 * 结案记录：更新角色是否看过真相与最好成绩；只有非重温的结案计入剧本统计，
 * 统计达标后低质量的生成剧本自动停用。
 */
export async function recordScenarioSettlement(
  q: DbExecutor,
  args: {
    cultivatorId: string;
    scenarioId: string;
    completed: boolean;
    total: number | null;
    replay: boolean;
  },
) {
  if (args.completed)
    await q
      .update(dungeonScenarioPlays)
      .set({
        completed: true,
        ...(args.total !== null && !args.replay
          ? {
              bestTotal: sql`greatest(coalesce(${dungeonScenarioPlays.bestTotal}, 0), ${args.total})`,
            }
          : {}),
      })
      .where(
        and(
          eq(dungeonScenarioPlays.cultivatorId, args.cultivatorId),
          eq(dungeonScenarioPlays.scenarioId, args.scenarioId),
        ),
      );
  if (!args.completed || args.replay) return;
  const [stats] = await q
    .update(dungeonScenarios)
    .set({
      completionCount: sql`${dungeonScenarios.completionCount} + 1`,
      scoreSum: sql`${dungeonScenarios.scoreSum} + ${args.total ?? 0}`,
    })
    .where(eq(dungeonScenarios.id, args.scenarioId))
    .returning({
      source: dungeonScenarios.source,
      playCount: dungeonScenarios.playCount,
      completionCount: dungeonScenarios.completionCount,
      scoreSum: dungeonScenarios.scoreSum,
    });
  if (stats?.source === 'generated' && shouldRetireMysteryScenario(stats))
    await q
      .update(dungeonScenarios)
      .set({ status: 'retired', retiredAt: new Date() })
      .where(eq(dungeonScenarios.id, args.scenarioId));
}

const PENDING = ['queued', 'running'] as const;

/** 同一地图节点的投递用同一把事务级咨询锁串行化，保证该节点待生成数不超过上限。 */
function lockNodeQueue(tx: DbTransaction, mapNodeId: string) {
  return tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`dungeon-scenario-jobs:${mapNodeId}`}))`,
  );
}

function pendingInNode(tx: DbTransaction, mapNodeId: string) {
  return tx
    .select({ n: count() })
    .from(dungeonScenarioJobs)
    .where(
      and(
        eq(dungeonScenarioJobs.mapNodeId, mapNodeId),
        inArray(dungeonScenarioJobs.status, [...PENDING]),
      ),
    );
}

/** 投递补货任务；被拦下的请求直接忽略，不排队。 */
export async function requestScenarioRestock(args: {
  mapNodeId: string;
  templateId: string;
  reason: JobReason;
  requestedBy?: string;
}): Promise<RestockDecision> {
  const decision = await db.transaction(async (tx) => {
    await lockNodeQueue(tx, args.mapNodeId);
    const slot = and(
      eq(dungeonScenarios.mapNodeId, args.mapNodeId),
      eq(dungeonScenarios.templateId, args.templateId),
      eq(dungeonScenarios.status, 'active'),
    );
    const jobSlot = and(
      eq(dungeonScenarioJobs.mapNodeId, args.mapNodeId),
      eq(dungeonScenarioJobs.templateId, args.templateId),
    );
    const [[active], [pendingInSlot], [pendingNode], [lastFailure]] =
      await Promise.all([
        tx.select({ n: count() }).from(dungeonScenarios).where(slot),
        tx
          .select({ n: count() })
          .from(dungeonScenarioJobs)
          .where(
            and(jobSlot, inArray(dungeonScenarioJobs.status, [...PENDING])),
          ),
        pendingInNode(tx, args.mapNodeId),
        tx
          .select({ at: max(dungeonScenarioJobs.finishedAt) })
          .from(dungeonScenarioJobs)
          .where(and(jobSlot, eq(dungeonScenarioJobs.status, 'failed'))),
      ]);
    const result = decideMysteryRestock({
      activeInSlot: active?.n ?? 0,
      pendingInSlot: pendingInSlot?.n ?? 0,
      pendingInNode: pendingNode?.n ?? 0,
      lastFailedAt: lastFailure?.at ? lastFailure.at.getTime() : null,
      now: Date.now(),
    });
    if (result === 'enqueue')
      await tx.insert(dungeonScenarioJobs).values({
        mapNodeId: args.mapNodeId,
        templateId: args.templateId,
        reason: args.reason,
        requestedBy: args.requestedBy ?? null,
      });
    return result;
  });
  console.info('[ScenarioLibrary] 补货请求', { ...args, decision });
  return decision;
}

/** 唤醒生成处理器；同一 30 秒内多次唤醒只投递一次。 */
export function wakeScenarioWorker() {
  return publishScheduledBackgroundCommand('dungeon-scenario.generate');
}

/**
 * 管理后台投递：每个库存位可排多个任务，不受失败冷却与同槽去重限制，但与补货共用
 * 节点咨询锁与节点上限；某节点排满后，该节点其余的跳过。返回排队与跳过的数量。
 */
export async function enqueueAdminScenarioJobs(
  slots: Array<{ mapNodeId: string; templateId: string }>,
) {
  const byNode = new Map<string, typeof slots>();
  for (const slot of slots)
    byNode.set(slot.mapNodeId, [...(byNode.get(slot.mapNodeId) ?? []), slot]);
  const result = await db.transaction(async (tx) => {
    let enqueued = 0;
    // 按节点排序加锁，避免与并发的投递互相等待成死锁。
    for (const [mapNodeId, nodeSlots] of [...byNode].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      await lockNodeQueue(tx, mapNodeId);
      const [pending] = await pendingInNode(tx, mapNodeId);
      const room = Math.max(
        0,
        MYSTERY_LIBRARY_POLICY.maxPendingPerNode - (pending?.n ?? 0),
      );
      const accepted = nodeSlots.slice(0, room);
      if (accepted.length > 0)
        await tx
          .insert(dungeonScenarioJobs)
          .values(
            accepted.map((slot) => ({ ...slot, reason: 'admin' as const })),
          );
      enqueued += accepted.length;
    }
    const [pendingTotal] = await tx
      .select({ n: count() })
      .from(dungeonScenarioJobs)
      .where(inArray(dungeonScenarioJobs.status, [...PENDING]));
    return {
      enqueued,
      skipped: slots.length - enqueued,
      pendingTotal: pendingTotal?.n ?? 0,
    };
  });
  if (result.enqueued > 0) await wakeScenarioWorker();
  console.info('[ScenarioLibrary] 后台投递', result);
  return result;
}

/** 管理后台重试失败任务：尝试次数清零、重新排队；不是失败状态的任务不动。 */
export async function retryFailedScenarioJob(jobId: string) {
  const [row] = await db
    .update(dungeonScenarioJobs)
    .set({
      status: 'queued',
      attempts: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    })
    .where(
      and(
        eq(dungeonScenarioJobs.id, jobId),
        eq(dungeonScenarioJobs.status, 'failed'),
      ),
    )
    .returning({ id: dungeonScenarioJobs.id });
  if (row) await wakeScenarioWorker();
  return Boolean(row);
}

/** 已配置剧本的全部槽。 */
export function configuredSlots() {
  return getAllSatelliteNodes().flatMap((node) =>
    scenarioTemplatesForNode(node.id).map((templateId) => ({
      mapNodeId: node.id,
      templateId,
    })),
  );
}

/**
 * 清扫：中断的任务按失败处理一次；手写保底案卷入库；
 * 每槽库存低于预热数时投递预热任务（受节点队列上限约束）。
 */
async function sweepScenarioLibrary() {
  const policy = MYSTERY_LIBRARY_POLICY;
  await db.execute(sql`
    update ${dungeonScenarioJobs}
    set status = case when attempts >= ${policy.maxJobAttempts} then 'failed' else 'queued' end,
        error = 'interrupted',
        finished_at = case when attempts >= ${policy.maxJobAttempts} then now() else null end
    where status = 'running'
      and started_at < now() - make_interval(secs => ${policy.staleRunningMs / 1000})
  `);
  // 生成流水线升级后，旧版本的生成剧本整批停用；保底案卷也停用，随后以当前内容重新入库。
  await db
    .update(dungeonScenarios)
    .set({ status: 'retired', retiredAt: new Date() })
    .where(
      and(
        eq(dungeonScenarios.status, 'active'),
        lt(dungeonScenarios.generatorVersion, MYSTERY_GENERATOR_VERSION),
      ),
    );
  const seeds = await db
    .select({ id: dungeonScenarios.id })
    .from(dungeonScenarios)
    .where(
      and(
        eq(dungeonScenarios.status, 'active'),
        eq(dungeonScenarios.source, 'seed'),
      ),
    );
  for (const seed of seeds) await loadScenarioCase(seed.id);
  for (const seed of listMysteryFallbackSeeds()) {
    if (!scenarioTemplatesForNode(seed.mapNodeId).includes(seed.templateId))
      continue;
    const [existing] = await db
      .select({ n: count() })
      .from(dungeonScenarios)
      .where(
        and(
          eq(dungeonScenarios.mapNodeId, seed.mapNodeId),
          eq(dungeonScenarios.templateId, seed.templateId),
          eq(dungeonScenarios.source, 'seed'),
          // 与引擎不兼容而停用的保底案卷，用当前版本重新入库。
          eq(dungeonScenarios.status, 'active'),
        ),
      );
    const caseFile = getMysteryFallbackCase(seed.templateId);
    if ((existing?.n ?? 0) === 0 && caseFile)
      await insertScenario(db, { ...seed, caseFile, source: 'seed' });
  }
  for (const slot of configuredSlots()) {
    const [active] = await db
      .select({ n: count() })
      .from(dungeonScenarios)
      .where(
        and(
          eq(dungeonScenarios.mapNodeId, slot.mapNodeId),
          eq(dungeonScenarios.templateId, slot.templateId),
          eq(dungeonScenarios.status, 'active'),
        ),
      );
    if ((active?.n ?? 0) < policy.warmupPerSlot)
      await requestScenarioRestock({ ...slot, reason: 'warmup' });
  }
}

/**
 * 认领最早排队、且所在节点没有任务在跑的一个任务：同一节点逐个生成，不同节点并发。
 * 认领用一把全局事务锁串行化，多实例同时认领也不会让同一节点跑两个。
 */
async function claimJob(jobId?: string) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('dungeon-scenario-claim'))`,
    );
    const result = await tx.execute<{
      id: string;
      map_node_id: string;
      template_id: string;
    }>(sql`
      update ${dungeonScenarioJobs}
      set status = 'running', started_at = now(), attempts = attempts + 1
      where id = (
        select j.id from ${dungeonScenarioJobs} j
        where j.status = 'queued'
          ${jobId !== undefined ? sql`and j.id = ${jobId}` : sql``}
          and not exists (
            select 1 from ${dungeonScenarioJobs} r
            where r.status = 'running' and r.map_node_id = j.map_node_id
          )
        order by j.created_at
        limit 1
      )
      returning id, map_node_id, template_id
    `);
    return result.rows[0];
  });
}

async function runJob(job: {
  id: string;
  map_node_id: string;
  template_id: string;
}) {
  const startedAt = Date.now();
  try {
    const node = getMapNode(job.map_node_id);
    const setting = node?.dungeon_config?.scenario;
    const template = getMysteryTemplate(job.template_id);
    if (!node || !setting || !template || !('realm_requirement' in node))
      throw new Error('剧本槽配置已不存在');
    const generated = await generateMysteryCase({
      template,
      seed: Math.floor(Math.random() * 0x100000000),
      node,
      setting,
      mapNodeId: job.map_node_id,
    });
    if (generated.source !== 'generated')
      throw new Error('生成未通过校验，未入库保底案卷');
    // 入库把关：后台生成不影响开局，用高级模型组再做一次独立审校，只计数不改写。
    const audit = await reviewMysteryCase(
      generated.caseFile,
      generated.reviewContext?.canon,
      { apply: false, locked: generated.reviewContext?.locked },
    );
    const majorIssues = audit.issues.filter((i) => i.severity === 'major');
    if (majorIssues.length > MYSTERY_LIBRARY_POLICY.maxMajorIssuesForLibrary)
      throw new Error(
        `审校发现 ${majorIssues.length} 处严重矛盾，未入库：${majorIssues
          .slice(0, 3)
          .map((i) => i.problem)
          .join('；')}`,
      );
    await db.transaction(async (tx) => {
      const scenarioId = await insertScenario(tx, {
        mapNodeId: job.map_node_id,
        templateId: job.template_id,
        caseFile: generated.caseFile,
        source: 'generated',
        reviewIssueCount: generated.reviewIssueCount,
        generation: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          auditIssues: audit.issues.length,
          auditMajorIssues: majorIssues.length,
        },
      });
      await tx
        .update(dungeonScenarioJobs)
        .set({
          status: 'succeeded',
          scenarioId,
          finishedAt: new Date(),
          error: null,
        })
        .where(eq(dungeonScenarioJobs.id, job.id));
    });
    console.info('[ScenarioLibrary] 剧本生成完成', {
      job: job.id,
      slot: `${job.map_node_id}/${job.template_id}`,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[ScenarioLibrary] 剧本生成失败:', job.id, message);
    await getExecutor().execute(sql`
      update ${dungeonScenarioJobs}
      set status = case when attempts >= ${MYSTERY_LIBRARY_POLICY.maxJobAttempts} then 'failed' else 'queued' end,
          error = ${message.slice(0, 500)},
          finished_at = case when attempts >= ${MYSTERY_LIBRARY_POLICY.maxJobAttempts} then now() else null end
      where id = ${job.id}
    `);
  }
}

/** 手动执行指定的一个排队任务；不清扫、不补货，也不继续领取任务或重试整项任务。 */
export async function runSingleScenarioGeneration(jobId: string) {
  const job = await claimJob(jobId);
  if (!job) throw new Error('任务不在排队中，或该节点已有任务正在生成');
  await runJob(job);
  const [result] = await db
    .select({
      id: dungeonScenarioJobs.id,
      status: dungeonScenarioJobs.status,
      attempts: dungeonScenarioJobs.attempts,
      scenarioId: dungeonScenarioJobs.scenarioId,
      error: dungeonScenarioJobs.error,
    })
    .from(dungeonScenarioJobs)
    .where(eq(dungeonScenarioJobs.id, jobId));
  return result;
}

/** 每个实例的并发上限：每个节点同时只跑一个，且不超过策略给定的单实例上限。 */
const WORKER_LIMIT = Math.min(
  new Set(configuredSlots().map((s) => s.mapNodeId)).size,
  MYSTERY_LIBRARY_POLICY.maxConcurrentJobsPerInstance,
);
const workers = new Set<Promise<void>>();
let processed = 0;
let draining: Promise<{ processed: number }> | null = null;

async function work() {
  for (;;) {
    const job = await claimJob();
    if (!job) return;
    await runJob(job);
    processed++;
  }
}

/** 补足工作者：空闲的工作者认领不到任务就退出，唤醒时再补上。 */
function topUpWorkers() {
  while (workers.size < WORKER_LIMIT) {
    const worker: Promise<void> = work()
      .catch((error: unknown) =>
        console.warn('[ScenarioLibrary] 生成处理器异常:', error),
      )
      .finally(() => workers.delete(worker));
    workers.add(worker);
  }
}

/**
 * 后台命令 `dungeon-scenario.generate` 的处理器：先清扫，再按节点并发认领生成，
 * 直到没有可认领的任务。处理中的重复唤醒补足工作者并复用当前处理。
 */
export function runScenarioGeneration(): Promise<{ processed: number }> {
  if (!isBackgroundLlmEnabled()) {
    console.info('[ScenarioLibrary] 后台模型任务未开启，跳过清扫与生成');
    return Promise.resolve({ processed: 0 });
  }
  if (draining) {
    topUpWorkers();
    return draining;
  }
  draining = (async () => {
    try {
      await sweepScenarioLibrary();
      processed = 0;
      topUpWorkers();
      while (workers.size > 0) await Promise.allSettled([...workers]);
      return { processed };
    } finally {
      draining = null;
    }
  })();
  return draining;
}
