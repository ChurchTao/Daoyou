import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import { creationProducts, cultivators } from '@server/lib/drizzle/schema.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { readCharacterManuals } from '@server/lib/repositories/characterLoadoutRepository.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import {
  assertInventoryIdle,
  grantInventory,
  InventoryError,
} from '@server/inventory/operations.js';
import type {
  ExchangeManual,
  ManualMigrationPolicy,
  ManualMigrationResult,
  ManualMigrationSource,
  ManualMigrationView,
} from '@daoyou/shared/contracts/manualMigration';
import {
  buildManualMigrationPolicy,
  drawLegacyManual,
  MANUAL_MIGRATION_CONFIG,
  manualMigrationPlan,
  validateManualSelection,
} from '@daoyou/shared/manual-migration/rules';
import { and, eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

const policy = buildManualMigrationPolicy(MANUAL_MIGRATION_CONFIG);
function preview(source: ManualMigrationSource, policy: ManualMigrationPolicy) {
  try {
    const plan = manualMigrationPlan(source, policy);
    return {
      ...source,
      count: plan.count,
      choices: plan.choices,
      bonusGrants: plan.bonusGrants,
      problem: null,
    };
  } catch (error) {
    return {
      ...source,
      count: 0,
      choices: 0,
      bonusGrants: [],
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
        await assertInventoryIdle(actor.cultivatorId, tx);
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
        await assertInventoryIdle(actor.cultivatorId, tx);
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
        let plan;
        try {
          plan = manualMigrationPlan(source, policy);
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
          [...randomGrants, ...input.selections, ...plan.bonusGrants],
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
          result: {
            randomGrants,
            selectedGrants: input.selections,
            bonusGrants: plan.bonusGrants,
          },
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
