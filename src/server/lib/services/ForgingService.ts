import { parseMailAttachments } from '@shared/lib/itemLibrary';
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
  generateStarterBeast,
} from '@shared/engine/combat-v6/beasts';
import { BEAST_CAPACITY } from '@shared/engine/combat-v6/beasts/progression';
import { generateForgedEquipment } from '@shared/engine/combat-v6/equipment/forging';
import { buildSpiritFieldSeedMaterialFromPlant } from '@shared/engine/spirit-field/seedMaterial';
import { forgingBoosts, forgingCost } from '@shared/forging/rules';
import {
  addItems,
  itemDefinition,
  type InventoryItem,
} from '@shared/inventory';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import {
  FORGING_MATERIAL_TYPES,
  MaterialFactsSchema,
} from '@shared/items/definitions/materials';
import { seedFactsOf } from '@shared/items/definitions/seeds';
import { materialFactsOf } from '@shared/items/material';
import { and, asc, count, eq, gte, ilike, inArray, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { db, type DbTransaction } from '../drizzle/db';
import {
  combatV6Beasts,
  consumables,
  cultivators,
  inventoryItems,
  materials,
} from '../drizzle/schema';
import { redisLockKeys, withRedisLock } from '../redis/lock';
import { readBeastOwner } from '../repositories/combatV6BeastRepository';
import { lockCultivatorForStateMutation } from '../repositories/playerStateRepository';
import { mapConsumableRow } from './consumablePersistence';
import { addConsumableToInventoryInTransaction } from './cultivator/CultivatorInventoryRepository';
import {
  assertInventoryIdle,
  grantInventory,
  InventoryError,
  inventoryItemOf,
  readInventory,
  saveInventoryPlan,
} from './InventoryService';
import { MailService } from './MailService';
import { getMysteryMaterialBlockingReason } from './materialMysteryGuard';
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
  const table = query.kind === 'consumable' ? consumables : materials;
  const filter = and(
    eq(table.cultivatorId, owner),
    query.kind === 'material'
      ? inArray(materials.type, ['seed', 'herb', ...FORGING_MATERIAL_TYPES])
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
      const blocked = getMysteryMaterialBlockingReason([row]);
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
          .from(combatV6Beasts)
          .where(eq(combatV6Beasts.cultivatorId, input.cultivatorId));
        if (held.total >= BEAST_CAPACITY)
          throw new InventoryError('灵兽持有数量已达上限');
        const id = randomUUID();
        const individual = generateStarterBeast(
          id,
          input.cultivatorId,
          grant.speciesId,
          randomInt(0x100000000),
        );
        await tx
          .insert(combatV6Beasts)
          .values({ id, cultivatorId: input.cultivatorId, individual });
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
