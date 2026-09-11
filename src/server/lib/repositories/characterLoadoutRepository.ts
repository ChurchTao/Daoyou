import type { DbExecutor } from '@server/lib/drizzle/db';
import {
  cultivatorEquipmentSlots,
  cultivatorManualSlots,
  cultivatorManualStates,
  inventoryItems,
} from '@server/lib/drizzle/schema';
import type { DaoEquipmentLoadoutV1 } from '@shared/engine/combat-v6/equipment';
import type { CultivatorManualStateV1 } from '@shared/engine/combat-v6/manuals';
import { eq } from 'drizzle-orm';
import { readActiveSectCombatProgress } from './sectCombatRepository';

export async function readCharacterManuals(
  cultivatorId: string,
  q: DbExecutor,
): Promise<CultivatorManualStateV1> {
  const [manualState] = await q
    .select()
    .from(cultivatorManualStates)
    .where(eq(cultivatorManualStates.cultivatorId, cultivatorId))
    .limit(1);
  const slots = await q
    .select({
      slot: cultivatorManualSlots.slot,
      manualId: cultivatorManualSlots.manualId,
    })
    .from(cultivatorManualSlots)
    .where(eq(cultivatorManualSlots.cultivatorId, cultivatorId));
  return {
    version: 1,
    revision: manualState?.revision ?? 0,
    learned: manualState?.learned ?? [],
    build: {
      slots: slots.map((slot) => ({
        slot: slot.slot as 1 | 2 | 3 | 4,
        manualId: slot.manualId,
      })),
    },
  };
}

export async function readCharacterEquipment(
  cultivatorId: string,
  q: DbExecutor,
): Promise<DaoEquipmentLoadoutV1> {
  const equipmentRows = await q
    .select({
      slot: cultivatorEquipmentSlots.slot,
      instance: inventoryItems.instanceData,
      ownerId: inventoryItems.cultivatorId,
      location: inventoryItems.location,
      definitionId: inventoryItems.definitionId,
    })
    .from(cultivatorEquipmentSlots)
    .innerJoin(
      inventoryItems,
      eq(cultivatorEquipmentSlots.equipmentInstanceId, inventoryItems.id),
    )
    .where(eq(cultivatorEquipmentSlots.cultivatorId, cultivatorId));
  if (
    equipmentRows.some(
      (row) =>
        row.ownerId !== cultivatorId ||
        row.location !== 'bag' ||
        row.definitionId !== 'equipment.v6',
    )
  )
    throw new Error('装备穿戴数据不合法');
  return Object.fromEntries(
    equipmentRows.map((row) => [row.slot, structuredClone(row.instance)]),
  ) as DaoEquipmentLoadoutV1;
}

export async function readCharacterCombatBuild(
  cultivatorId: string,
  q: DbExecutor,
) {
  const sect = await readActiveSectCombatProgress(cultivatorId, q);
  return {
    sect: sect?.sect,
    manuals: await readCharacterManuals(cultivatorId, q),
    equipment: await readCharacterEquipment(cultivatorId, q),
  };
}
