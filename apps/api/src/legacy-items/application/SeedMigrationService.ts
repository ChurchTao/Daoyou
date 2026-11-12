import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import type {
  ExchangeSeed,
  SeedMigrationResult,
  SeedMigrationSource,
  SeedMigrationView,
} from '@daoyou/contracts/legacy/seeds';
import { SeedFactsSchema, seedFactsOf } from '@daoyou/game-domain/inventory';
import { readSpiritSeedSpec } from '@daoyou/game-domain/spirit-field';
import { drawLegacySeedConversion } from '@daoyou/game-rules/legacy/seeds';
import {
  buildSpiritGardenSeed,
  getSpiritGardenSpecies,
  isSpiritGardenSeed,
} from '@daoyou/game-rules/spirit-field';
import {
  InventoryError,
  assertInventoryIdle,
  grantInventory,
  inventoryItemOf,
  saveInventoryPlan,
} from '@server/inventory/operations.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  inventoryItems,
  materials,
} from '@server/lib/drizzle/schema.js';
import { describeJournal } from '@server/player/application/JournalSettlement.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq, inArray } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

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

function sourceProblem(quality: string, quantity: number): string | null {
  if (!QUALITY_VALUES.includes(quality as Quality))
    return '旧灵种品质异常，请联系管理员核对';
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    return '旧灵种数量异常，请联系管理员核对';
  return null;
}

function vaultSource(
  row: typeof materials.$inferSelect,
): SeedMigrationSource | null {
  const spec = readSpiritSeedSpec(row.details);
  if (spec && isSpiritGardenSeed(spec.plant)) return null;
  return {
    source: 'vault',
    id: row.id,
    name: row.name,
    quality: row.rank,
    quantity: row.quantity,
    location: 'vault',
    problem: sourceProblem(row.rank, row.quantity),
  };
}

function inventorySource(
  row: typeof inventoryItems.$inferSelect,
): SeedMigrationSource | null {
  const facts = SeedFactsSchema.safeParse(row.instanceData);
  if (facts.success && isSpiritGardenSeed(facts.data.seedSpec.plant))
    return null;
  const plant = facts.success ? facts.data.seedSpec.plant : null;
  return {
    source: 'inventory',
    id: row.id,
    name: plant?.seedName ?? '异常旧灵种',
    quality: plant?.quality ?? '未知',
    quantity: row.quantity,
    revision: row.revision,
    location: row.location === 'bag' ? 'bag' : 'storage',
    problem: plant
      ? sourceProblem(plant.quality, row.quantity)
      : '旧灵种事实异常，请联系管理员核对',
  };
}

export async function readSeedMigration(
  actor: ActiveCultivatorRef,
): Promise<SeedMigrationView> {
  return db.transaction(
    async (tx) => {
      await requireOwner(actor, tx);
      const vault = await tx
        .select()
        .from(materials)
        .where(
          and(
            eq(materials.cultivatorId, actor.cultivatorId),
            eq(materials.type, 'seed'),
          ),
        )
        .orderBy(materials.id);
      const inventory = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.cultivatorId, actor.cultivatorId),
            eq(inventoryItems.definitionId, 'seed.v1'),
            inArray(inventoryItems.location, ['bag', 'storage']),
          ),
        )
        .orderBy(inventoryItems.id);
      let blockedReason: string | null = null;
      try {
        await assertInventoryIdle(actor.cultivatorId, tx);
      } catch (error) {
        if (!(error instanceof InventoryError)) throw error;
        blockedReason = error.message;
      }
      return {
        ownerId: actor.cultivatorId,
        blockedReason,
        pending: [
          ...vault.map(vaultSource),
          ...inventory.map(inventorySource),
        ].filter((source): source is SeedMigrationSource => source !== null),
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

export async function exchangeSeedMigration(
  actor: ActiveCultivatorRef,
  input: ExchangeSeed,
) {
  const committed =
    await playerCommandExecutor.executeWithLock<SeedMigrationResult>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'legacy_seed_migration',
      requestId: input.requestId,
      idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
      command: async (tx) => {
        await requireOwner(actor, tx);
        await assertInventoryIdle(actor.cultivatorId, tx);
        let source: SeedMigrationSource | null;
        if (input.source === 'vault') {
          const [row] = await tx
            .select()
            .from(materials)
            .where(
              and(
                eq(materials.id, input.id),
                eq(materials.cultivatorId, actor.cultivatorId),
                eq(materials.type, 'seed'),
              ),
            )
            .for('update');
          source = row ? vaultSource(row) : null;
          if (
            !source ||
            source.quantity !== input.expectedQuantity ||
            source.quantity < input.quantity
          )
            throw new InventoryError(
              '旧灵种已变化、不存在或不属于你，请刷新列表',
            );
          if (source.problem) throw new InventoryError(source.problem);
          if (source.quantity === input.quantity)
            await tx
              .delete(materials)
              .where(
                and(
                  eq(materials.id, source.id),
                  eq(materials.cultivatorId, actor.cultivatorId),
                ),
              );
          else
            await tx
              .update(materials)
              .set({ quantity: source.quantity - input.quantity })
              .where(
                and(
                  eq(materials.id, source.id),
                  eq(materials.cultivatorId, actor.cultivatorId),
                ),
              );
        } else {
          const [row] = await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.id, input.id),
                eq(inventoryItems.cultivatorId, actor.cultivatorId),
                eq(inventoryItems.definitionId, 'seed.v1'),
                inArray(inventoryItems.location, ['bag', 'storage']),
              ),
            )
            .for('update');
          source = row ? inventorySource(row) : null;
          if (
            !row ||
            !source ||
            source.quantity !== input.expectedQuantity ||
            source.quantity < input.quantity ||
            row.revision !== input.revision
          )
            throw new InventoryError(
              '旧灵种已变化、不存在或不属于你，请刷新列表',
            );
          if (source.problem) throw new InventoryError(source.problem);
          const before = inventoryItemOf(row);
          await saveInventoryPlan(
            actor.cultivatorId,
            [before],
            source.quantity === input.quantity
              ? []
              : [
                  {
                    ...before,
                    quantity: source.quantity - input.quantity,
                    revision: before.revision + 1,
                  },
                ],
            tx,
          );
        }
        const seeds = drawLegacySeedConversion(
          source.quality as Quality,
          input.quantity,
          () => randomInt(0x100000000) / 0x100000000,
        );
        const delivered = await grantInventory(
          actor.cultivatorId,
          seeds.map((seed) => ({
            definitionId: 'seed.v1',
            quantity: seed.quantity,
            instanceData: seedFactsOf(
              buildSpiritGardenSeed(
                seed.speciesId,
                seed.quality,
                seed.quantity,
              ),
            ),
          })),
          tx,
        );
        describeJournal(
          tx,
          actor.cultivatorId,
          `将${input.quantity}粒${source.quality}旧灵种转化为同品质新灵种`,
        );
        return {
          result: {
            quantity: input.quantity,
            seeds: seeds.map((seed) => ({
              ...seed,
              name: `${getSpiritGardenSpecies(seed.speciesId).name}的种子`,
            })),
            locations: [...new Set(delivered.map((item) => item.location))],
          },
          resourceChanges: [
            {
              resourceTopic: 'inventory.bag',
              operation: 'invalidate',
              eventType: 'legacy_seed_migration.granted',
            },
            ...(input.source === 'vault'
              ? [
                  {
                    resourceTopic: 'inventory.materials' as const,
                    operation: 'invalidate' as const,
                    eventType: 'legacy_seed_migration.consumed',
                  },
                ]
              : []),
          ],
        };
      },
    });
  return { data: committed.result, state: committed.state };
}
