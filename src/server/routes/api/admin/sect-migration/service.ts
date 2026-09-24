import {
  db,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  appSettings,
  cultivators,
  inventoryItems,
  sectCombatStates,
  sectMemberships,
  sectMeridianLoadouts,
  sectMeridianNodes,
  sectMethodProgress,
} from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  assertInventoryIdle,
  grantInventory,
} from '@server/lib/services/InventoryService';
import { ResourceEventCommitter } from '@server/lib/services/ResourceEventCommitter';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '@server/lib/services/cultivator/CultivatorStateRepository';
import { inventoryStackKey } from '@server/lib/services/inventoryStackKey';
import {
  LegacySectMemberSchema,
  type LegacySectMember,
  type SectMigrationPlan,
  type SectMigrationRefund,
  type SectMigrationReport,
  type SectMigrationRow,
} from '@shared/contracts/sectMigration';
import {
  COMBAT_V6_SECT_DEFINITIONS,
  compileCurrentSectCombatV6,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '@shared/engine/combat-v6/content';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import { methodLevelCap } from '@shared/engine/combat-v6/sect-progression';
import {
  migrationInsightFacts,
  migrationInsightGrants,
  migrationInsightQuantity,
} from '@shared/sect-migration/insightItem';
import { planLegacySectMigration } from '@shared/sect-migration/plan';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq, inArray, like, sql } from 'drizzle-orm';

const MANIFEST_KEY = 'sect-migration:v1:manifest';
const QUEUE_PREFIX = 'sect-migration:v1:pending:';
const RECEIPT_PREFIX = 'sect-migration:v1:member:';
const zeroRefund = (): SectMigrationRefund => ({
  cultivationExp: 0,
  spiritStones: 0,
  comprehensionInsight: 0,
});
type Manifest = { stagedAt: string; membershipIds: string[] };
type Receipt = {
  source: LegacySectMember;
  plan: SectMigrationPlan;
  before: SectMigrationRefund;
  after: SectMigrationRefund;
  insightItems: {
    before: number;
    after: number;
    facts: typeof migrationInsightFacts;
  };
  completedAt: string;
  operatorId: string;
};
type Character = typeof cultivators.$inferSelect;

function balances(character: Character): SectMigrationRefund {
  const p = character.cultivation_progress as Record<string, unknown> | null;
  const result = {
    spiritStones: character.spirit_stones,
    cultivationExp: p?.cultivation_exp ?? 0,
    comprehensionInsight: p?.comprehension_insight ?? 0,
  };
  if (
    Object.values(result).some(
      (v) => typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0,
    )
  )
    throw new Error('角色资源余额异常');
  return result as SectMigrationRefund;
}

function expectedBalances(
  before: SectMigrationRefund,
  refund: SectMigrationRefund,
) {
  const after = {
    spiritStones: before.spiritStones + refund.spiritStones,
    cultivationExp: before.cultivationExp + refund.cultivationExp,
    comprehensionInsight: before.comprehensionInsight,
  };
  if (
    after.spiritStones > 1_000_000_000 ||
    after.cultivationExp > 1_000_000_000
  )
    throw new Error('退款超过灵石或修为余额上限，需处理后重试');
  if (!Number.isSafeInteger(after.comprehensionInsight))
    throw new Error('感悟余额异常');
  return after;
}

function validatePlan(
  source: LegacySectMember,
  character: Character,
  plan: SectMigrationPlan,
) {
  const level = combatCharacterLevel(
    character.realm as RealmType,
    character.realm_stage as RealmStage,
  );
  if (plan.methods.some((m) => m.level > methodLevelCap(level)))
    throw new Error('旧心法超过当前角色等级允许范围，禁止裁剪');
  const definition =
    COMBAT_V6_SECT_DEFINITIONS[source.sectId as CombatV6SectId];
  if (
    !definition ||
    plan.methods.some(
      (m) => !definition.methods.some((t) => t.id === m.methodId),
    )
  )
    throw new Error('目标心法定义已变化');
  if (plan.pathIds.some((id) => !definition.paths.some((p) => p.id === id)))
    throw new Error('目标流派定义已变化');
  if (plan.activePathId) {
    const compiled = compileCurrentSectCombatV6({
      characterLevel: level,
      progress: {
        version: 1,
        sectId: source.sectId as CombatV6SectId,
        methods: Object.fromEntries(
          plan.methods.map((m) => [m.methodId, m.level]),
        ),
        meridianDepth:
          plan.meridianDepth as SectCombatProgressV6['meridianDepth'],
        activePathId: plan.activePathId,
        meridianLoadouts: [
          { pathId: plan.pathIds[0], nodeIds: [], revision: 0 },
          { pathId: plan.pathIds[1], nodeIds: [], revision: 0 },
        ],
      },
    });
    if (!compiled.ok)
      throw new Error(compiled.diagnostics.map((d) => d.message).join('；'));
  }
}

async function readTarget(membershipIds: string[], q: DbExecutor) {
  if (!membershipIds.length)
    return { states: [], methods: [], loadouts: [], nodes: [] };
  const states = await q
    .select()
    .from(sectCombatStates)
    .where(inArray(sectCombatStates.membershipId, membershipIds));
  const methods = await q
    .select()
    .from(sectMethodProgress)
    .where(inArray(sectMethodProgress.membershipId, membershipIds));
  const loadouts = await q
    .select()
    .from(sectMeridianLoadouts)
    .where(inArray(sectMeridianLoadouts.membershipId, membershipIds));
  const nodes = loadouts.length
    ? await q
        .select()
        .from(sectMeridianNodes)
        .where(
          inArray(
            sectMeridianNodes.loadoutId,
            loadouts.map((l) => l.id),
          ),
        )
    : [];
  return { states, methods, loadouts, nodes };
}

function verifyCompleted(
  id: string,
  target: Awaited<ReturnType<typeof readTarget>>,
  receipt: Receipt,
  character: Character,
  insightCount: number,
) {
  const plan = receipt.plan;
  const state = target.states.find((s) => s.membershipId === id);
  const methods = target.methods.filter((m) => m.membershipId === id);
  const loadouts = target.loadouts.filter((l) => l.membershipId === id);
  const expectedPaths = plan.activePathId ? plan.pathIds : [];
  if (
    !state ||
    state.revision !== 1 ||
    state.meridianDepth !== plan.meridianDepth ||
    state.activePathId !== plan.activePathId ||
    methods.length !== 6 ||
    plan.methods.some(
      (m) =>
        !methods.some((t) => t.methodId === m.methodId && t.level === m.level),
    ) ||
    loadouts.length !== expectedPaths.length ||
    expectedPaths.some(
      (id) => !loadouts.some((l) => l.pathId === id && l.revision === 0),
    ) ||
    target.nodes.some((n) => loadouts.some((l) => l.id === n.loadoutId))
  )
    throw new Error('迁移凭证与新版宗门进度不一致');
  const current = balances(character);
  if (
    (Object.keys(current) as (keyof SectMigrationRefund)[]).some(
      (k) =>
        current[k] !== receipt.after[k] ||
        receipt.after[k] - receipt.before[k] !==
          (k === 'comprehensionInsight' ? 0 : plan.refund[k]),
    )
  )
    throw new Error('迁移凭证与实际退款余额不一致');
  if (
    receipt.insightItems.after - receipt.insightItems.before !==
      migrationInsightQuantity(plan.refund.comprehensionInsight) ||
    insightCount !== receipt.insightItems.after
  )
    throw new Error('感悟补偿道具数量与迁移凭证不一致');
}

export async function sectMigrationReport(): Promise<SectMigrationReport> {
  return db.transaction(
    async (tx) => {
      const [rawManifest] = await tx
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, MANIFEST_KEY));
      const manifest = rawManifest
        ? (JSON.parse(rawManifest.value) as Manifest)
        : null;
      const report: SectMigrationReport = {
        enabled: false,
        phase: 'unknown',
        stagedAt: manifest?.stagedAt ?? null,
        issues: [],
        rows: [],
        totals: zeroRefund(),
        complete: false,
      };
      const schema = await tx.execute(sql`SELECT
        to_regclass('public.wanjiedaoyou_sect_path_progress') IS NOT NULL AS legacy,
        to_regclass('public.wanjiedaoyou_sect_combat_states') IS NOT NULL AS v6`);
      report.phase =
        schema.rows[0]?.legacy && !schema.rows[0]?.v6
          ? 'legacy'
          : schema.rows[0]?.v6 && !schema.rows[0]?.legacy
            ? 'v6'
            : 'unknown';
      report.enabled = report.phase === 'v6';
      if (!manifest) {
        if (report.phase === 'legacy') return report;
        report.issues.push(
          '缺少升级前旧宗门记录。若已执行旧版 0044，需从升级前备份恢复来源，不能用新版数据推断。',
        );
        return report;
      }
      const queue = await tx
        .select()
        .from(appSettings)
        .where(like(appSettings.key, `${QUEUE_PREFIX}%`));
      const receipts = await tx
        .select()
        .from(appSettings)
        .where(like(appSettings.key, `${RECEIPT_PREFIX}%`));
      const sources = new Map<string, unknown>();
      for (const row of queue)
        sources.set(row.key.slice(QUEUE_PREFIX.length), JSON.parse(row.value));
      for (const row of receipts) {
        const id = row.key.slice(RECEIPT_PREFIX.length);
        if (sources.has(id))
          report.issues.push(`成员同时存在待处理记录和凭证 ${id}`);
        sources.set(id, (JSON.parse(row.value) as Receipt).source);
      }
      const members: LegacySectMember[] = [];
      for (const id of manifest.membershipIds) {
        const parsed = LegacySectMemberSchema.safeParse(sources.get(id));
        if (!parsed.success || parsed.data.membershipId !== id)
          report.issues.push(`缺少或损坏旧宗门记录 ${id}`);
        else members.push(parsed.data);
      }
      for (const id of sources.keys())
        if (!manifest.membershipIds.includes(id))
          report.issues.push(`发现清单外记录 ${id}`);
      if (report.phase !== 'v6') {
        if (report.phase === 'unknown')
          report.issues.push('数据库结构不完整，暂不能执行迁移');
        for (const source of members) {
          try {
            const plan = planLegacySectMigration(source);
            for (const key of Object.keys(
              report.totals,
            ) as (keyof SectMigrationRefund)[])
              report.totals[key] += plan.refund[key];
            report.rows.push({
              membershipId: source.membershipId,
              cultivatorId: source.cultivatorId,
              name: source.cultivatorId,
              sectId: source.sectId,
              status: 'ready',
              plan,
            });
          } catch (error) {
            report.rows.push({
              membershipId: source.membershipId,
              cultivatorId: source.cultivatorId,
              name: source.cultivatorId,
              sectId: source.sectId,
              status: 'blocked',
              error: error instanceof Error ? error.message : '旧进度异常',
            });
          }
        }
        return report;
      }
      const memberships = await tx
        .select()
        .from(sectMemberships)
        .where(eq(sectMemberships.status, 'active'));
      const ids = members.map((m) => m.membershipId);
      const characters = members.length
        ? await tx
            .select()
            .from(cultivators)
            .where(
              inArray(
                cultivators.id,
                members.map((m) => m.cultivatorId),
              ),
            )
        : [];
      const target = await readTarget(ids, tx);
      const insightCounts = await insightItemCounts(
        characters.map((c) => c.id),
        tx,
      );
      for (const membership of memberships) {
        if (!ids.includes(membership.id))
          report.issues.push(`升级清单缺少当前宗门成员 ${membership.id}`);
      }
      for (const source of members) {
        const character = characters.find((c) => c.id === source.cultivatorId);
        const row: SectMigrationRow = {
          membershipId: source.membershipId,
          cultivatorId: source.cultivatorId,
          name: character?.name ?? source.cultivatorId,
          sectId: source.sectId,
          status: 'blocked',
        };
        try {
          const membership = memberships.find(
            (m) => m.id === source.membershipId,
          );
          if (
            !character ||
            character.status !== 'active' ||
            !membership ||
            membership.cultivatorId !== source.cultivatorId ||
            membership.sectId !== source.sectId
          )
            throw new Error('角色或宗门成员归属与升级清单不一致');
          row.plan = planLegacySectMigration(source);
          validatePlan(source, character, row.plan);
          for (const key of Object.keys(
            report.totals,
          ) as (keyof SectMigrationRefund)[])
            report.totals[key] += row.plan.refund[key];
          const raw = receipts.find(
            (r) => r.key === RECEIPT_PREFIX + source.membershipId,
          );
          if (raw) {
            const receipt = JSON.parse(raw.value) as Receipt;
            verifyCompleted(
              source.membershipId,
              target,
              receipt,
              character,
              insightCounts.get(character.id) ?? 0,
            );
            row.status = 'completed';
          } else {
            if (
              target.states.some(
                (s) => s.membershipId === source.membershipId,
              ) ||
              target.methods.some(
                (m) => m.membershipId === source.membershipId,
              ) ||
              target.loadouts.some(
                (l) => l.membershipId === source.membershipId,
              )
            )
              throw new Error('已有新版宗门数据，禁止覆盖');
            expectedBalances(balances(character), row.plan.refund);
            row.status = 'ready';
          }
        } catch (error) {
          row.error = error instanceof Error ? error.message : '核对失败';
        }
        report.rows.push(row);
      }
      report.complete =
        report.issues.length === 0 &&
        report.rows.every((r) => r.status === 'completed');
      return report;
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

async function migrateMember(
  source: LegacySectMember,
  operatorId: string,
  maintenance: boolean,
) {
  const migrate = (assertHeld?: () => void) =>
    db.transaction(async (tx) => {
      if (!maintenance)
        await lockCultivatorForStateMutation(tx, source.cultivatorId);
      const [raw] = await tx
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, RECEIPT_PREFIX + source.membershipId));
      if (raw) {
        return 'skipped' as const;
      }
      const [pending] = await tx
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, QUEUE_PREFIX + source.membershipId))
        .for('update');
      if (
        !pending ||
        JSON.stringify(
          LegacySectMemberSchema.parse(JSON.parse(pending.value)),
        ) !== JSON.stringify(source)
      )
        throw new Error('旧宗门待处理记录已变化');
      await assertInventoryIdle(source.cultivatorId, undefined, tx);
      const [membership] = await tx
        .select()
        .from(sectMemberships)
        .where(
          and(
            eq(sectMemberships.id, source.membershipId),
            eq(sectMemberships.status, 'active'),
          ),
        )
        .for('update');
      const [character] = await tx
        .select()
        .from(cultivators)
        .where(eq(cultivators.id, source.cultivatorId));
      if (
        !character ||
        character.status !== 'active' ||
        !membership ||
        membership.cultivatorId !== source.cultivatorId ||
        membership.sectId !== source.sectId
      )
        throw new Error('角色或宗门成员归属已变化');
      const target = await readTarget([source.membershipId], tx);
      if (
        target.states.length ||
        target.methods.length ||
        target.loadouts.length
      )
        throw new Error('已有新版宗门数据，禁止覆盖');
      const plan = planLegacySectMigration(source);
      validatePlan(source, character, plan);
      const before = balances(character);
      const insightBefore = await insightItemCount(character.id, tx);
      const after = expectedBalances(before, plan.refund);
      await tx.insert(sectCombatStates).values({
        membershipId: source.membershipId,
        activePathId: plan.activePathId,
        meridianDepth: plan.meridianDepth,
        revision: 1,
      });
      await tx.insert(sectMethodProgress).values(
        plan.methods.map((m) => ({
          ...m,
          membershipId: source.membershipId,
        })),
      );
      if (plan.activePathId)
        await tx.insert(sectMeridianLoadouts).values(
          plan.pathIds.map((pathId) => ({
            membershipId: source.membershipId,
            pathId,
            revision: 0,
          })),
        );
      await refundResources(character, plan.refund, tx);
      await new ResourceEventCommitter().commit(tx, {
        actor: { userId: character.userId, cultivatorId: character.id },
        source: 'sect-migration-v1',
        requestId: source.membershipId,
        scopeDefaults: { cultivatorId: character.id },
        changes: (
          [
            'player.sect-combat',
            'player.currency',
            'player.progress',
            'inventory.bag',
          ] as const
        ).map((resourceTopic) => ({
          resourceTopic,
          operation: 'invalidate',
          eventType: 'sect.migrated',
        })),
      });
      const receipt: Receipt = {
        source,
        plan,
        before,
        after,
        insightItems: {
          before: insightBefore,
          after:
            insightBefore +
            migrationInsightQuantity(plan.refund.comprehensionInsight),
          facts: migrationInsightFacts,
        },
        completedAt: new Date().toISOString(),
        operatorId,
      };
      const [updated] = await tx
        .select()
        .from(cultivators)
        .where(eq(cultivators.id, character.id));
      verifyCompleted(
        source.membershipId,
        await readTarget([source.membershipId], tx),
        receipt,
        updated,
        await insightItemCount(character.id, tx),
      );
      await tx.insert(appSettings).values({
        key: RECEIPT_PREFIX + source.membershipId,
        value: JSON.stringify(receipt),
        updatedBy: operatorId,
      });
      await tx
        .delete(appSettings)
        .where(eq(appSettings.key, QUEUE_PREFIX + source.membershipId));
      assertHeld?.();
      return 'completed' as const;
    });
  if (maintenance) return migrate();
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(source.cultivatorId),
      context: 'sect-migration',
      timeoutMs: 30000,
      retries: 0,
    },
    (lease) => migrate(() => lease.assertHeld()),
  );
}

async function insightItemCount(owner: string, q: DbExecutor) {
  return (await insightItemCounts([owner], q)).get(owner) ?? 0;
}

async function insightItemCounts(owners: string[], q: DbExecutor) {
  if (!owners.length) return new Map<string, number>();
  const rows = await q
    .select({
      owner: inventoryItems.cultivatorId,
      quantity: sql<string>`sum(${inventoryItems.quantity})`,
    })
    .from(inventoryItems)
    .where(
      and(
        inArray(inventoryItems.cultivatorId, owners),
        eq(inventoryItems.definitionId, 'consumable.v1'),
        eq(
          inventoryItems.stackKey,
          inventoryStackKey('consumable.v1', migrationInsightFacts)!,
        ),
      ),
    )
    .groupBy(inventoryItems.cultivatorId);
  return new Map(rows.map((row) => [row.owner, Number(row.quantity)]));
}

async function refundResources(
  character: Character,
  refund: SectMigrationRefund,
  tx: DbTransaction,
) {
  // Use ordinary resource writes in bounded chunks; never lose a large refund to maxDelta.
  for (let remaining = refund.spiritStones; remaining > 0;) {
    const amount = Math.min(remaining, 10_000_000);
    await updateSpiritStones(character.userId, character.id, amount, tx);
    remaining -= amount;
  }
  if (refund.cultivationExp)
    await updateCultivationExp(
      character.userId,
      character.id,
      refund.cultivationExp,
      undefined,
      tx,
    );
  await grantInventory(
    character.id,
    migrationInsightGrants(refund.comprehensionInsight),
    tx,
  );
}

type MigrationResult = { membershipId: string; status: string; error?: string };

/** Shared by the admin batch endpoint and the temporary offline CLI. */
export async function* streamSectMigration(
  ids: string[],
  operatorId: string,
  maintenance = false,
): AsyncGenerator<MigrationResult> {
  const preflight = await sectMigrationReport();
  if (!preflight.enabled) throw new Error('请先完成数据库结构升级');
  if (preflight.issues.length) throw new Error(preflight.issues.join('；'));
  async function migrateId(id: string): Promise<MigrationResult> {
    try {
      const [raw] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, QUEUE_PREFIX + id));
      if (!raw) {
        const [receipt] = await db
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, RECEIPT_PREFIX + id));
        if (!receipt) throw new Error('没有待处理记录或迁移凭证');
        return { membershipId: id, status: 'skipped' };
      }
      const source = LegacySectMemberSchema.parse(JSON.parse(raw.value));
      if (source.membershipId !== id) throw new Error('来源成员 ID 不一致');
      return {
        membershipId: id,
        status: await migrateMember(source, operatorId, maintenance),
      };
    } catch (error) {
      return {
        membershipId: id,
        status: 'failed',
        error: error instanceof Error ? error.message : '迁移失败',
      };
    }
  }
  const uniqueIds = [...new Set(ids)];
  const concurrency = maintenance ? 16 : 1;
  for (let offset = 0; offset < uniqueIds.length; offset += concurrency) {
    const results = await Promise.all(
      uniqueIds.slice(offset, offset + concurrency).map(migrateId),
    );
    for (const result of results) yield result;
  }
}

export async function executeSectMigration(ids: string[], operatorId: string) {
  const results: MigrationResult[] = [];
  for await (const result of streamSectMigration(ids, operatorId))
    results.push(result);
  return results;
}

export async function exportSectMigrationAudit() {
  const report = await sectMigrationReport();
  const receipts = await db
    .select()
    .from(appSettings)
    .where(like(appSettings.key, `${RECEIPT_PREFIX}%`));
  return {
    exportedAt: new Date().toISOString(),
    report,
    receipts: receipts.map((r) => JSON.parse(r.value) as Receipt),
  };
}
