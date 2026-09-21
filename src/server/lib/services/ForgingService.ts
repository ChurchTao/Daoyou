import type {
  DevGrantSchema,
  ForgeRequest,
  ForgeView,
  VaultQuerySchema,
  VaultView,
  WithdrawMaterialSchema,
} from '@shared/contracts/forging';
import {
  BEAST_SPECIES,
  BeastSchema,
  generateStarterBeast,
} from '@shared/engine/combat-v6/beasts';
import {
  BEAST_CAPACITY,
  gainBeastExp,
  nextBeastExp,
} from '@shared/engine/combat-v6/beasts/progression';
import { generateForgedEquipment } from '@shared/engine/combat-v6/equipment/forging';
import { buildSpiritFieldSeedMaterialFromPlant } from '@shared/engine/spirit-field/seedMaterial';
import { forgingCost, forgingInputs } from '@shared/forging/rules';
import {
  addItems,
  itemDefinition,
  type InventoryItem,
} from '@shared/inventory';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import {
  INVENTORY_MATERIAL_TYPES,
  MaterialFactsSchema,
} from '@shared/items/definitions/materials';
import { seedFactsOf } from '@shared/items/definitions/seeds';
import { legacyMaterialUnavailableReason } from '@shared/items/legacy-material';
import { materialFactsOf } from '@shared/items/material';
import { parseMailAttachments } from '@shared/lib/itemLibrary';
import { and, asc, count, eq, gte, ilike, inArray, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { db, type DbExecutor, type DbTransaction } from '../drizzle/db';
import {
  consumables,
  cultivatorBeasts,
  cultivators,
  inventoryItems,
  materials,
} from '../drizzle/schema';
import { redisLockKeys, withRedisLock } from '../redis/lock';
import {
  beastIndividualData,
  readBeastOwner,
} from '../repositories/combatV6BeastRepository';
import {
  findPlayerMutationRequest,
  lockCultivatorForStateMutation,
} from '../repositories/playerStateRepository';
import { playerCommandExecutor } from './CommandExecutors';
import { mapConsumableRow } from './consumablePersistence';
import { readCultivatorName } from './cultivator/CultivatorFactsReader';
import { addConsumableToInventoryInTransaction } from './cultivator/CultivatorInventoryRepository';
import { generateForgingNarrative } from './ForgingNarrativeService';
import {
  assertInventoryIdle,
  grantInventory,
  InventoryError,
  inventoryItemOf,
  saveInventoryPlan,
} from './InventoryService';
import { MailService } from './MailService';
import { publishResourceEvents } from './playerStateBroadcaster';
import { QiService } from './QiService';
import { ResourceEventCommitter } from './ResourceEventCommitter';

async function mutate<T>(
  owner: string,
  action: (tx: DbTransaction) => Promise<T>,
) {
  const committed = await withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'forging',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, owner);
        await assertInventoryIdle(owner);
        const result = await action(tx);
        const actor = await readBeastOwner(owner, tx);
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { userId: actor.userId, cultivatorId: owner },
          source: 'forging',
          scopeDefaults: { cultivatorId: owner },
          changes: [
            {
              resourceTopic: 'player.currency',
              operation: 'invalidate',
              eventType: 'forging.currency.changed',
            },
            {
              resourceTopic: 'player.profile',
              operation: 'invalidate',
              eventType: 'forging.profile.changed',
            },
            {
              resourceTopic: 'inventory.consumables',
              operation: 'invalidate',
              eventType: 'vault.consumables.changed',
            },
            {
              resourceTopic: 'inventory.materials',
              operation: 'invalidate',
              eventType: 'forging.materials.changed',
            },
          ],
        });
        lease.assertHeld();
        return { data: result, state };
      }),
  );
  publishResourceEvents(committed.state.changes);
  return committed;
}

export async function readForge(owner: string): Promise<ForgeView> {
  const [character, qi] = await Promise.all([
    readBeastOwner(owner, db),
    QiService.getQiState(owner),
  ]);
  return {
    ownerLevel: character.ownerLevel,
    spiritStones: character.spiritStones,
    qi: qi.current,
  };
}

async function readForgeInputs(
  owner: string,
  input: ForgeRequest,
  executor: DbExecutor,
) {
  const before = (
    await executor
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, owner),
          eq(inventoryItems.location, 'bag'),
        ),
      )
  ).map(inventoryItemOf);
  const requireItem = (ref: { id: string; revision: number }) => {
    const item = before.find(
      (i) => i.id === ref.id && i.revision === ref.revision,
    );
    if (!item) throw new InventoryError('物品已变化，请重新备料');
    return item;
  };
  const blueprint = requireItem(input.blueprint);
  const definition = itemDefinition(blueprint.definitionId);
  if (definition.kind !== 'blueprint' || !definition.slot || !definition.level)
    throw new InventoryError('请选择道装图纸');
  const selected = input.materials.map((ref) => {
    const item = requireItem(ref);
    if (
      itemDefinition(item.definitionId).kind !== 'material' ||
      item.quantity < ref.quantity
    )
      throw new InventoryError('材料数量不足或类型无效');
    return {
      item,
      quantity: ref.quantity,
      facts: materialFactsOf(item.instanceData),
    };
  });
  const character = await readBeastOwner(owner, executor);
  const forging = forgingInputs(
    definition.level,
    character.ownerLevel,
    selected,
  );
  const cost = forgingCost(definition.level);
  if (character.spiritStones < cost.spiritStones)
    throw new InventoryError('灵石不足');
  return {
    before,
    blueprint,
    slot: definition.slot,
    level: definition.level,
    selected,
    forging,
    cost,
  };
}

export async function forgeEquipment(
  owner: string,
  input: ForgeRequest,
  userId: string,
) {
  // 只串行化同一角色的开炉请求；命名期间不持有角色写锁或数据库事务。
  return withRedisLock(
    {
      key: redisLockKeys.forgingPreparation(owner),
      context: 'forging-preparation',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const existing = await findPlayerMutationRequest(
        owner,
        'forging',
        input.requestId,
      );
      let narrative: Awaited<ReturnType<typeof generateForgingNarrative>> =
        null;
      if (!existing) {
        await assertInventoryIdle(owner);
        const prepared = await readForgeInputs(owner, input, db);
        const qi = await QiService.getQiState(owner);
        if (qi.current < prepared.cost.qi)
          throw new InventoryError('天地灵气不足');
        narrative = await generateForgingNarrative({
          level: prepared.level,
          slot: prepared.slot,
          materials: prepared.selected,
          intent: input.intent,
        });
      }
      lease.assertHeld();
      const seed = randomInt(0x100000000);
      const equipmentId = randomUUID();
      const createdAt = new Date().toISOString();
      const committed = await playerCommandExecutor.executeWithLock({
        userId,
        cultivatorId: owner,
        source: 'forging',
        idempotency: {
          key: input.requestId,
          fingerprint: JSON.stringify(input),
        },
        command: async (tx) => {
          lease.assertHeld();
          if (existing)
            throw new InventoryError('开炉凭据已失效，请核对储物袋');
          await assertInventoryIdle(owner);
          const { before, blueprint, slot, level, selected, forging, cost } =
            await readForgeInputs(owner, input, tx);
          const generated = generateForgedEquipment({
            id: equipmentId,
            createdAt,
            seed,
            templateId: `dao_equipment.standard.${slot}.v1`,
            equipmentLevel: level,
            ...forging,
          });
          if (!generated.ok)
            throw new InventoryError(generated.diagnostics[0].message);
          const { name: crafterName } = await readCultivatorName(owner, tx);
          const equipment = {
            ...generated.instance,
            ...(narrative
              ? { name: narrative.name, desc: narrative.desc }
              : {}),
            crafterName,
          };
          const consumed = new Map([
            [blueprint.id, 1],
            ...selected.map((m) => [m.item.id, m.quantity] as const),
          ]);
          let next: InventoryItem[] = before.flatMap((item) => {
            const quantity = item.quantity - (consumed.get(item.id) ?? 0);
            return quantity
              ? [
                  {
                    ...item,
                    quantity,
                    revision: item.revision + (consumed.has(item.id) ? 1 : 0),
                  },
                ]
              : [];
          });
          next = addItems(
            next,
            {
              definitionId: 'equipment.v6',
              quantity: 1,
              instanceData: equipment,
            },
            'bag',
            false,
            randomUUID,
            null,
          );
          await QiService.reserveQi({
            cultivatorId: owner,
            action: 'equipment_forge',
            actionInstanceId: equipment.id,
            cost: cost.qi,
            tx,
          });
          const paid = await tx
            .update(cultivators)
            .set({
              spirit_stones: sql`${cultivators.spirit_stones} - ${cost.spiritStones}`,
            })
            .where(
              and(
                eq(cultivators.id, owner),
                gte(cultivators.spirit_stones, cost.spiritStones),
              ),
            )
            .returning({ id: cultivators.id });
          if (!paid.length) throw new InventoryError('灵石不足');
          await saveInventoryPlan(owner, before, next, tx);
          await QiService.commitReservation({
            actionInstanceId: equipment.id,
            tx,
          });
          lease.assertHeld();
          return {
            result: { equipment },
            resourceChanges: [
              {
                resourceTopic: 'player.currency',
                operation: 'invalidate',
                eventType: 'forging.currency.changed',
              },
              {
                resourceTopic: 'player.profile',
                operation: 'invalidate',
                eventType: 'forging.profile.changed',
              },
              {
                resourceTopic: 'inventory.bag',
                operation: 'invalidate',
                eventType: 'inventory.forging.changed',
              },
              {
                resourceTopic: 'inventory.materials',
                operation: 'invalidate',
                eventType: 'forging.materials.changed',
              },
            ],
          };
        },
      });
      return { data: committed.result, state: committed.state };
    },
  );
}

export async function readVault(
  owner: string,
  query: z.infer<typeof VaultQuerySchema>,
): Promise<VaultView> {
  const table = query.kind === 'consumable' ? consumables : materials;
  const filter = and(
    eq(table.cultivatorId, owner),
    query.kind === 'material'
      ? inArray(materials.type, ['seed', ...INVENTORY_MATERIAL_TYPES])
      : undefined,
    query.search
      ? ilike(
          table.name,
          '%' + query.search.replace(/[\\\\%_]/g, '\\\\$&') + '%',
        )
      : undefined,
  );
  const [total] = await db.select({ n: count() }).from(table).where(filter);
  const page = Math.min(query.page, Math.max(0, Math.ceil(total.n / 40) - 1));
  const rows = await db
    .select()
    .from(table)
    .where(filter)
    .orderBy(asc(table.createdAt), asc(table.id))
    .limit(40)
    .offset(page * 40);
  return {
    total: total.n,
    page,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      quantity: row.quantity,
      rank: 'rank' in row ? row.rank : row.quality,
      description: row.description ?? '',
      element: 'element' in row ? row.element : null,
      kind: query.kind,
      unavailableReason:
        'rank' in row ? legacyMaterialUnavailableReason(row) : undefined,
    })),
  };
}

export async function withdrawMaterial(
  owner: string,
  input: z.infer<typeof WithdrawMaterialSchema>,
) {
  return mutate(owner, async (tx) => {
    const table = input.kind === 'consumable' ? consumables : materials;
    const [row] = await tx
      .select()
      .from(table)
      .where(and(eq(table.id, input.id), eq(table.cultivatorId, owner)))
      .for('update');
    if (
      !row ||
      row.quantity !== input.expectedQuantity ||
      input.quantity > row.quantity
    )
      throw new InventoryError('物品已变化，请刷新宝库');
    if ('rank' in row) {
      const blocked = legacyMaterialUnavailableReason(row);
      if (blocked) throw new InventoryError(blocked);
      const facts =
        row.type === 'seed'
          ? seedFactsOf(row)
          : MaterialFactsSchema.parse({
              name: row.name,
              type: row.type,
              rank: row.rank,
              element: row.element,
              description: row.description ?? '',
            });
      await grantInventory(
        owner,
        [
          {
            definitionId: row.type === 'seed' ? 'seed.v1' : 'material.v1',
            quantity: input.quantity,
            instanceData: facts,
          },
        ],
        tx,
        false,
      );
    } else {
      const facts = consumableFactsOf(mapConsumableRow(row));
      await grantInventory(
        owner,
        [
          {
            definitionId: 'consumable.v1',
            quantity: input.quantity,
            instanceData: facts,
          },
        ],
        tx,
        false,
      );
    }
    if (row.quantity === input.quantity)
      await tx.delete(table).where(eq(table.id, row.id));
    else
      await tx
        .update(table)
        .set({ quantity: row.quantity - input.quantity })
        .where(eq(table.id, row.id));
    return { withdrawn: input.quantity };
  });
}

export async function grantDevResources(input: z.infer<typeof DevGrantSchema>) {
  return mutate(input.cultivatorId, async (tx) => {
    const ids: string[] = [];
    for (const grant of input.grants) {
      if (grant.type === 'item')
        await grantInventory(input.cultivatorId, [grant.item], tx, false);
      else if (grant.type === 'mail') {
        const send =
          grant.format === 'historical'
            ? MailService.sendMail
            : MailService.sendNewRewardMail;
        const mail = await send(
          input.cultivatorId,
          '本地邮件验收',
          '10Q 本地附件领取验收',
          parseMailAttachments(grant.attachments),
          'reward',
          tx,
        );
        ids.push(mail.id);
      } else if (grant.type === 'vault-consumable') {
        const item = await addConsumableToInventoryInTransaction(
          input.cultivatorId,
          { ...grant.facts, quantity: grant.quantity },
          tx,
        );
        if (item.id) ids.push(item.id);
      } else if (grant.type === 'beast') {
        if (!BEAST_SPECIES.some((species) => species.id === grant.speciesId))
          throw new InventoryError('灵兽物种无效');
        const [held] = await tx
          .select({ total: count() })
          .from(cultivatorBeasts)
          .where(eq(cultivatorBeasts.cultivatorId, input.cultivatorId));
        if (held.total >= BEAST_CAPACITY)
          throw new InventoryError('灵兽持有数量已达上限');
        const id = randomUUID();
        let starter = generateStarterBeast(
          id,
          input.cultivatorId,
          grant.speciesId,
          randomInt(0x100000000),
        );
        if (grant.level !== undefined) {
          const { ownerLevel } = await readBeastOwner(input.cultivatorId, tx);
          if (grant.level > ownerLevel)
            throw new InventoryError('验收灵兽等级不能超过主人等级');
          const experience = Array.from(
            { length: grant.level - starter.level },
            (_, index) => nextBeastExp(starter.level + index),
          ).reduce((sum, value) => sum + value, 0);
          starter = gainBeastExp(starter, experience, ownerLevel);
        }
        const individual = grant.skills
          ? BeastSchema.parse({
              ...starter,
              skills: grant.skills,
              skillSlotCapacity: grant.skills.length,
            })
          : starter;
        await tx
          .insert(cultivatorBeasts)
          .values({
            id,
            cultivatorId: input.cultivatorId,
            individual: beastIndividualData(individual),
          });
        ids.push(id);
      } else if (grant.type === 'vault-seed') {
        const [row] = await tx
          .insert(materials)
          .values({
            ...buildSpiritFieldSeedMaterialFromPlant(
              grant.facts.seedSpec.plant,
              grant.quantity,
            ),
            cultivatorId: input.cultivatorId,
          })
          .returning({ id: materials.id });
        ids.push(row.id);
      } else if (grant.type === 'vault-material') {
        const [row] = await tx
          .insert(materials)
          .values({
            ...grant.facts,
            cultivatorId: input.cultivatorId,
            quantity: grant.quantity,
          })
          .returning({ id: materials.id });
        ids.push(row.id);
      } else if (grant.type === 'spirit-stones') {
        const updated = await tx
          .update(cultivators)
          .set({
            spirit_stones: sql`${cultivators.spirit_stones} + ${grant.amount}`,
          })
          .where(
            and(
              eq(cultivators.id, input.cultivatorId),
              sql`${cultivators.spirit_stones} <= ${2147483647 - grant.amount}`,
            ),
          )
          .returning({ id: cultivators.id });
        if (!updated.length) throw new InventoryError('灵石超过上限');
      } else if (grant.type === 'qi')
        await QiService.restoreQi({
          cultivatorId: input.cultivatorId,
          amount: grant.amount,
          source: 'gm',
          actionInstanceId: randomUUID(),
          tx,
        });
      else {
        const generated = generateForgedEquipment({
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          seed: randomInt(0x100000000),
          templateId: `dao_equipment.standard.${grant.slot}.v1`,
          equipmentLevel: grant.level,
          boosts: { ore: 0, essence: 0, attributes: 0 },
        });
        if (!generated.ok) throw new InventoryError('道装生成失败');
        await grantInventory(
          input.cultivatorId,
          [
            {
              definitionId: 'equipment.v6',
              quantity: 1,
              instanceData: generated.instance,
            },
          ],
          tx,
          false,
        );
        ids.push(generated.instance.id);
      }
    }
    return { granted: input.grants.length, ids };
  });
}
