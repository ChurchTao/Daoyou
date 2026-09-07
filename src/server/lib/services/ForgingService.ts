import type {
  DevGrantSchema,
  ForgeRequest,
  ForgeView,
  VaultQuerySchema,
  VaultView,
  WithdrawMaterialSchema,
} from '@shared/contracts/forging';
import { generateForgedEquipment } from '@shared/engine/combat-v6/equipment/forging';
import { forgingBoosts, forgingCost } from '@shared/forging/rules';
import {
  addItems,
  itemDefinition,
  type InventoryItem,
} from '@shared/inventory';
import {
  FORGING_MATERIAL_TYPES,
  MaterialFactsSchema,
} from '@shared/items/definitions/materials';
import { materialFactsOf } from '@shared/items/material';
import { and, asc, count, eq, gte, ilike, inArray, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { db, type DbTransaction } from '../drizzle/db';
import { cultivators, inventoryItems, materials } from '../drizzle/schema';
import { redisLockKeys, withRedisLock } from '../redis/lock';
import { readBeastOwner } from '../repositories/combatV6BeastRepository';
import { lockCultivatorForStateMutation } from '../repositories/playerStateRepository';
import {
  assertInventoryIdle,
  grantInventory,
  InventoryError,
  inventoryItemOf,
  readInventory,
  saveInventoryPlan,
} from './InventoryService';
import { QiService } from './QiService';
import { ResourceEventCommitter } from './ResourceEventCommitter';

async function mutate<T>(
  owner: string,
  action: (tx: DbTransaction) => Promise<T>,
) {
  return withRedisLock(
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
}

export async function readForge(owner: string): Promise<ForgeView> {
  const [inventory, character, qi] = await Promise.all([
    readInventory(owner, { location: 'bag', kind: 'all', search: '', page: 0 }),
    readBeastOwner(owner, db),
    QiService.getQiState(owner),
  ]);
  return {
    inventory,
    ownerLevel: character.ownerLevel,
    spiritStones: character.spiritStones,
    qi: qi.current,
  };
}

export async function forgeEquipment(owner: string, input: ForgeRequest) {
  return mutate(owner, async (tx) => {
    const before = (
      await tx
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
    if (
      definition.kind !== 'blueprint' ||
      !definition.slot ||
      !definition.level
    )
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
        facts: materialFactsOf(item.definitionId, item.instanceData),
      };
    });
    const character = await readBeastOwner(owner, tx);
    const boosts = forgingBoosts(
      definition.level,
      character.ownerLevel,
      selected,
    );
    const cost = forgingCost(definition.level);
    if (character.spiritStones < cost.spiritStones)
      throw new InventoryError('灵石不足');
    const seed = randomInt(0x100000000);
    const generated = generateForgedEquipment({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      seed,
      templateId: `dao_equipment.standard.${definition.slot}.v1`,
      equipmentLevel: definition.level,
      boosts,
    });
    if (!generated.ok)
      throw new InventoryError(generated.diagnostics[0].message);
    const equipment = generated.instance;
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
      { definitionId: 'equipment.v6', quantity: 1, instanceData: equipment },
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
    await QiService.commitReservation({ actionInstanceId: equipment.id, tx });
    return { equipment };
  });
}

export async function readVault(
  owner: string,
  query: z.infer<typeof VaultQuerySchema>,
): Promise<VaultView> {
  const filter = and(
    eq(materials.cultivatorId, owner),
    inArray(materials.type, [...FORGING_MATERIAL_TYPES]),
    query.search
      ? ilike(materials.name, `%${query.search.replace(/[\\%_]/g, '\\$&')}%`)
      : undefined,
  );
  const [total] = await db.select({ n: count() }).from(materials).where(filter);
  const page = Math.min(query.page, Math.max(0, Math.ceil(total.n / 40) - 1));
  const rows = await db
    .select()
    .from(materials)
    .where(filter)
    .orderBy(asc(materials.createdAt), asc(materials.id))
    .limit(40)
    .offset(page * 40);
  return {
    total: total.n,
    page,
    items: rows.map((row) => ({
      ...MaterialFactsSchema.parse({
        name: row.name,
        type: row.type,
        rank: row.rank,
        element: row.element,
        description: row.description ?? '',
      }),
      id: row.id,
      quantity: row.quantity,
    })),
  };
}

export async function withdrawMaterial(
  owner: string,
  input: z.infer<typeof WithdrawMaterialSchema>,
) {
  return mutate(owner, async (tx) => {
    const [row] = await tx
      .select()
      .from(materials)
      .where(and(eq(materials.id, input.id), eq(materials.cultivatorId, owner)))
      .for('update');
    if (
      !row ||
      row.quantity !== input.expectedQuantity ||
      input.quantity > row.quantity
    )
      throw new InventoryError('材料已变化，请刷新宝库');
    const facts = MaterialFactsSchema.parse({
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
          definitionId: 'material.v1',
          quantity: input.quantity,
          instanceData: facts,
        },
      ],
      tx,
      false,
    );
    if (row.quantity === input.quantity)
      await tx.delete(materials).where(eq(materials.id, row.id));
    else
      await tx
        .update(materials)
        .set({ quantity: row.quantity - input.quantity })
        .where(eq(materials.id, row.id));
    return { withdrawn: input.quantity };
  });
}

export async function grantDevResources(input: z.infer<typeof DevGrantSchema>) {
  return mutate(input.cultivatorId, async (tx) => {
    const ids: string[] = [];
    for (const grant of input.grants) {
      if (grant.type === 'item')
        await grantInventory(input.cultivatorId, [grant.item], tx, false);
      else if (grant.type === 'vault-material') {
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
