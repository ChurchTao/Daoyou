import { db, type DbExecutor } from '@server/lib/drizzle/db';
import { creationProducts, cultivators } from '@server/lib/drizzle/schema';
import type { ActiveCultivatorRef } from '@server/lib/hono/types';
import { readCharacterManuals } from '@server/lib/repositories/characterLoadoutRepository';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import {
  assertInventoryIdle,
  grantInventory,
  InventoryError,
} from '@server/lib/services/InventoryService';
import type {
  ExchangeManual,
  ManualMigrationAdminView,
  ManualMigrationPolicy,
  ManualMigrationResult,
  ManualMigrationSource,
  ManualMigrationView,
} from '@shared/contracts/manualMigration';
import {
  buildManualMigrationPolicy,
  drawLegacyManual,
  MANUAL_MIGRATION_CONFIG,
  manualMigrationPlan,
  validateManualSelection,
} from '@shared/manual-migration/rules';
import { and, eq, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

const policy = buildManualMigrationPolicy(MANUAL_MIGRATION_CONFIG);
function preview(source: ManualMigrationSource, policy: ManualMigrationPolicy) {
  try {
    const plan = manualMigrationPlan(source, policy);
    return {
      ...source,
      count: plan.count,
      choices: plan.choices,
      problem: null,
    };
  } catch (error) {
    return {
      ...source,
      count: 0,
      choices: 0,
      problem: error instanceof Error ? error.message : '来源异常',
    };
  }
}
async function requireOwner(actor: ActiveCultivatorRef, tx: DbExecutor) {
  const [owner] = await tx
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    );
  if (!owner) throw new InventoryError('角色不可用');
}
const sourceColumns = {
  id: creationProducts.id,
  name: creationProducts.name,
  quality: creationProducts.quality,
  score: creationProducts.score,
};
function ownedManual(ownerId: string) {
  return and(
    eq(creationProducts.cultivatorId, ownerId),
    eq(creationProducts.productType, 'gongfa'),
  );
}
export async function manualMigrationAvailability(actor: ActiveCultivatorRef) {
  return db.transaction(
    async (tx) => {
      await requireOwner(actor, tx);
      const [source] = await tx
        .select({ id: creationProducts.id })
        .from(creationProducts)
        .where(ownedManual(actor.cultivatorId))
        .limit(1);
      return {
        ownerId: actor.cultivatorId,
        available: !!source,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export async function readManualMigration(
  actor: ActiveCultivatorRef,
): Promise<ManualMigrationView> {
  return db.transaction(
    async (tx) => {
      await requireOwner(actor, tx);
      const sources = await tx
        .select(sourceColumns)
        .from(creationProducts)
        .where(ownedManual(actor.cultivatorId))
        .orderBy(creationProducts.id);
      const learned = (await readCharacterManuals(actor.cultivatorId, tx))
        .learned;
      let blockedReason: string | null = null;
      try {
        await assertInventoryIdle(actor.cultivatorId, undefined, tx);
      } catch (error) {
        if (!(error instanceof InventoryError)) throw error;
        blockedReason = error.message;
      }
      return {
        ownerId: actor.cultivatorId,
        available: sources.length > 0,
        policy,
        blockedReason,
        pending: sources.map((source) => preview(source, policy)),
        learned,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export async function exchangeManualMigration(
  actor: ActiveCultivatorRef,
  input: ExchangeManual,
) {
  const committed =
    await playerCommandExecutor.executeWithLock<ManualMigrationResult>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'legacy_manual_migration',
      command: async (tx) => {
        await requireOwner(actor, tx);
        await assertInventoryIdle(actor.cultivatorId, undefined, tx);
        const [source] = await tx
          .select(sourceColumns)
          .from(creationProducts)
          .where(
            and(
              eq(creationProducts.id, input.productId),
              ownedManual(actor.cultivatorId),
            ),
          )
          .for('update');
        if (!source)
          throw new InventoryError(
            '这本旧功法已兑换、不存在或不属于你，请刷新列表并核对背包',
          );
        try {
          const plan = manualMigrationPlan(source, policy);
          validateManualSelection(input.selections, plan.choices, policy);
        } catch (error) {
          throw new InventoryError(
            error instanceof Error ? error.message : '兑换参数无效',
          );
        }
        // Choose before drawing; expose rewards only after grant and source deletion commit.
        const randomGrants = drawLegacyManual(
          source,
          policy,
          () => randomInt(0x100000000) / 0x100000000,
        );
        await grantInventory(
          actor.cultivatorId,
          [...randomGrants, ...input.selections],
          tx,
        );
        await tx
          .delete(creationProducts)
          .where(
            and(
              eq(creationProducts.id, source.id),
              ownedManual(actor.cultivatorId),
            ),
          );
        return {
          result: { randomGrants, selectedGrants: input.selections },
          resourceChanges: [
            {
              resourceTopic: 'inventory.bag' as const,
              operation: 'invalidate' as const,
              eventType: 'legacy_manual_migration.granted',
            },
          ],
        };
      },
    });
  return { data: committed.result, state: committed.state };
}

export async function readManualMigrationAdmin(): Promise<ManualMigrationAdminView> {
  return db.transaction(
    async (tx) => {
      const sources = await tx
        .select({
          ...sourceColumns,
          ownerId: creationProducts.cultivatorId,
          ownerName: cultivators.name,
        })
        .from(creationProducts)
        .innerJoin(
          cultivators,
          eq(cultivators.id, creationProducts.cultivatorId),
        )
        .where(
          and(
            eq(creationProducts.productType, 'gongfa'),
            eq(cultivators.status, 'active'),
          ),
        );
      const stats =
        await tx.execute(sql`SELECT COALESCE(p.quality, '缺失') AS quality, count(*)::integer AS count,
      min(p.score)::integer AS min, percentile_disc(0.5) WITHIN GROUP (ORDER BY p.score)::integer AS median,
      percentile_disc(0.9) WITHIN GROUP (ORDER BY p.score)::integer AS p90, max(p.score)::integer AS max
      FROM wanjiedaoyou_creation_products p JOIN wanjiedaoyou_cultivators c ON c.id = p.cultivator_id
      WHERE p.product_type = 'gongfa' AND c.status = 'active' GROUP BY p.quality`);
      const owners = new Map<
        string,
        ManualMigrationAdminView['owners'][number]
      >();
      for (const source of sources) {
        const owner = owners.get(source.ownerId) ?? {
          ownerId: source.ownerId,
          name: source.ownerName,
          pending: 0,
          problems: 0,
        };
        owner.pending++;
        if (preview(source, policy).problem) owner.problems++;
        owners.set(source.ownerId, owner);
      }
      return {
        policy,
        stats: stats.rows as ManualMigrationAdminView['stats'],
        owners: [...owners.values()].sort((a, b) =>
          a.ownerId.localeCompare(b.ownerId),
        ),
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
