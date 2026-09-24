import { db, type DbExecutor } from '@server/lib/drizzle/db';
import { creationProducts, cultivators } from '@server/lib/drizzle/schema';
import type { ActiveCultivatorRef } from '@server/lib/hono/types';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import {
  assertInventoryIdle,
  grantInventory,
  InventoryError,
} from '@server/lib/services/InventoryService';
import {
  artifactMigrationPlan,
  artifactMigrationRealm,
  drawArtifactBlueprints,
} from '@shared/artifact-migration/rules';
import type {
  ArtifactMigrationResult,
  ArtifactMigrationView,
  ExchangeArtifact,
} from '@shared/contracts/artifactMigration';
import { generateForgedEquipment } from '@shared/engine/combat-v6/equipment/forging';
import { and, eq } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';

async function requireOwner(actor: ActiveCultivatorRef, tx: DbExecutor) {
  const [owner] = await tx
    .select({ id: cultivators.id, spiritStones: cultivators.spirit_stones })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    );
  if (!owner) throw new InventoryError('角色不可用');
  return owner;
}
function ownedArtifact(ownerId: string) {
  return and(
    eq(creationProducts.cultivatorId, ownerId),
    eq(creationProducts.productType, 'artifact'),
  );
}
const sourceColumns = {
  id: creationProducts.id,
  name: creationProducts.name,
  quality: creationProducts.quality,
  score: creationProducts.score,
  productModel: creationProducts.productModel,
};
export async function artifactMigrationAvailability(
  actor: ActiveCultivatorRef,
) {
  return db.transaction(
    async (tx) => {
      await requireOwner(actor, tx);
      const [source] = await tx
        .select({ id: creationProducts.id })
        .from(creationProducts)
        .where(ownedArtifact(actor.cultivatorId))
        .limit(1);
      return { ownerId: actor.cultivatorId, available: !!source };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export async function readArtifactMigration(
  actor: ActiveCultivatorRef,
): Promise<ArtifactMigrationView> {
  return db.transaction(
    async (tx) => {
      await requireOwner(actor, tx);
      const sources = await tx
        .select(sourceColumns)
        .from(creationProducts)
        .where(ownedArtifact(actor.cultivatorId))
        .orderBy(creationProducts.id);
      let blockedReason: string | null = null;
      try {
        await assertInventoryIdle(actor.cultivatorId, undefined, tx);
      } catch (error) {
        if (!(error instanceof InventoryError)) throw error;
        blockedReason = error.message;
      }
      return {
        ownerId: actor.cultivatorId,
        blockedReason,
        pending: sources.map(({ productModel, ...source }) => {
          try {
            return {
              ...source,
              ...artifactMigrationPlan({ ...source, productModel }),
              problem: null,
            };
          } catch (error) {
            return {
              ...source,
              ...artifactMigrationRealm(productModel),
              blueprints: 0,
              bonusGrants: [],
              spiritStones: 0,
              problem: error instanceof Error ? error.message : '来源异常',
            };
          }
        }),
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export async function exchangeArtifactMigration(
  actor: ActiveCultivatorRef,
  input: ExchangeArtifact,
) {
  const committed =
    await playerCommandExecutor.executeWithLock<ArtifactMigrationResult>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'legacy_artifact_migration',
      command: async (tx) => {
        const owner = await requireOwner(actor, tx);
        await assertInventoryIdle(actor.cultivatorId, undefined, tx);
        const [source] = await tx
          .select(sourceColumns)
          .from(creationProducts)
          .where(
            and(
              eq(creationProducts.id, input.productId),
              ownedArtifact(actor.cultivatorId),
            ),
          )
          .for('update');
        if (!source)
          throw new InventoryError(
            '这件旧法宝已兑换、不存在或不属于你，请刷新列表并核对背包',
          );
        let plan;
        try {
          plan = artifactMigrationPlan(source);
        } catch (error) {
          throw new InventoryError(
            error instanceof Error ? error.message : '来源异常',
          );
        }
        const generated = generateForgedEquipment({
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          seed: randomInt(0x100000000),
          templateId: `dao_equipment.standard.${input.slot}.v1`,
          equipmentLevel: plan.equipmentLevel,
          weaponType: input.weaponType,
          baseQuality: 0,
          boosts: { ore: 0, essence: 0, attributes: 0 },
        });
        if (!generated.ok) throw new InventoryError('道装生成失败，请稍后重试');
        const blueprints = drawArtifactBlueprints(
          plan,
          () => randomInt(0x100000000) / 0x100000000,
        );
        if (plan.spiritStones > 0) {
          const balance = await updateSpiritStones(
            actor.userId,
            actor.cultivatorId,
            plan.spiritStones,
            tx,
          );
          if (balance - owner.spiritStones !== plan.spiritStones)
            throw new InventoryError(
              '灵石余额空间不足，无法完整领取 50 万灵石，请先使用部分灵石再兑换',
            );
        }
        await grantInventory(
          actor.cultivatorId,
          [
            {
              definitionId: 'equipment.v6',
              quantity: 1,
              instanceData: generated.instance,
            },
            ...blueprints,
            ...plan.bonusGrants,
          ],
          tx,
        );
        await tx
          .delete(creationProducts)
          .where(
            and(
              eq(creationProducts.id, source.id),
              ownedArtifact(actor.cultivatorId),
            ),
          );
        return {
          result: {
            equipment: generated.instance,
            blueprints,
            bonusGrants: plan.bonusGrants,
            spiritStones: plan.spiritStones,
          },
          resourceChanges: [
            ...(plan.spiritStones > 0
              ? [
                  {
                    resourceTopic: 'player.currency' as const,
                    operation: 'invalidate' as const,
                    eventType: 'legacy_artifact_migration.granted',
                  },
                ]
              : []),
            {
              resourceTopic: 'inventory.bag' as const,
              operation: 'invalidate' as const,
              eventType: 'legacy_artifact_migration.granted',
            },
          ],
        };
      },
    });
  return { data: committed.result, state: committed.state };
}
