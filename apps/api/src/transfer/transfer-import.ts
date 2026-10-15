import { BeastSchema } from '@daoyou/game-rules/beasts/validation';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { stripExpCapForStorage } from '@daoyou/game-rules/cultivation';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';
import { getSectWeekKey } from '@server/sects/organization/SectOrganizationClock.js';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { TransferSnapshot } from './transfer-snapshot.js';

export async function importTransferSnapshot(tx: DbTransaction, userId: string, snapshot: TransferSnapshot): Promise<string> {
  const role = snapshot.role;
  const [inserted] = await tx.insert(schema.cultivators).values({
    userId, name: role.name, title: role.title, gender: role.gender,
    origin: role.origin, personality: role.personality, background: role.background,
    prompt: role.prompt, playerRace: role.playerRace, raceNarrative: role.raceNarrative,
    realm: role.realm, realm_stage: role.realmStage, age: role.age, lifespan: role.lifespan,
    closedDoorYearsTotal: role.closedDoorYearsTotal, status: 'active',
    vitality: role.attributes.vitality, strength: role.attributes.strength,
    spirit: role.attributes.spirit, endurance: role.attributes.endurance,
    speed: role.attributes.speed, willpower: role.attributes.willpower,
    unallocatedAttributePoints: role.unallocatedAttributePoints,
    spirit_stones: role.spiritStones, reputation: 0,
    qi: 200, qiLastRefreshedAt: new Date(), last_yield_at: new Date(),
    cultivation_progress: stripExpCapForStorage(role.cultivationProgress as unknown as CultivationProgress),
    condition: role.condition,
  }).returning({ id: schema.cultivators.id });
  if (!inserted) throw new Error('导入角色创建失败');
  const cultivatorId = inserted.id;
  if (snapshot.roots.length) await tx.insert(schema.spiritualRoots).values(snapshot.roots.map((root) => ({
    cultivatorId, element: root.element, strength: root.strength,
    marrowWashBonus: root.marrowWashBonus, grade: root.grade,
  })));
  if (snapshot.fates.length) await tx.insert(schema.preHeavenFates).values(snapshot.fates.map((fate) => ({
    cultivatorId, name: fate.name, quality: fate.quality,
    details: fate.details, description: fate.description,
  })));
  await tx.insert(schema.cultivatorManualStates).values({
    cultivatorId, revision: 0, learned: snapshot.manuals.learned,
  });
  if (snapshot.manuals.slots.length) await tx.insert(schema.cultivatorManualSlots).values(snapshot.manuals.slots.map((slot) => ({ cultivatorId, ...slot })));

  const itemIdMap = new Map<string, string>();
  for (const item of snapshot.items) itemIdMap.set(item.id, randomUUID());
  if (snapshot.items.length) await tx.insert(schema.inventoryItems).values(snapshot.items.map((item) => {
    const newId = itemIdMap.get(item.id)!;
    const data = item.definitionId === 'equipment.v6' && item.instanceData && typeof item.instanceData === 'object'
      ? { ...item.instanceData, id: newId }
      : item.instanceData;
    return {
      id: newId, cultivatorId, location: item.location, slotIndex: item.slotIndex,
      definitionId: item.definitionId, stackKey: item.stackKey, quantity: item.quantity,
      instanceData: data, revision: 0,
    };
  }));
  if (snapshot.equipped.length) await tx.insert(schema.cultivatorEquipmentSlots).values(snapshot.equipped.map((entry) => ({
    cultivatorId, slot: entry.slot, equipmentInstanceId: itemIdMap.get(entry.itemId)!,
  })));

  const beastIdMap = new Map<string, string>();
  const beasts = snapshot.beasts.map((input) => BeastSchema.parse(input));
  for (const beast of beasts) beastIdMap.set(beast.id, randomUUID());
  if (beasts.length) await tx.insert(schema.cultivatorBeasts).values(beasts.map((beast) => {
    const { id: _oldId, ownerCultivatorId: _oldOwner, ...individual } = beast;
    return { id: beastIdMap.get(beast.id)!, cultivatorId, individual: individual as Omit<SummonedBeast, 'id' | 'ownerCultivatorId'> };
  }));
  await tx.insert(schema.cultivatorBeastLineups).values({
    cultivatorId,
    lineup: {
      carriedBeastIds: snapshot.lineup.carriedBeastIds.map((id) => beastIdMap.get(id)!),
      ...(snapshot.lineup.leadBeastId ? { leadBeastId: beastIdMap.get(snapshot.lineup.leadBeastId)! } : {}),
      revision: 0,
    },
    starterClaimedAt: snapshot.beastStarterClaimed || beasts.length > 0 ? new Date() : null,
  });

  if (snapshot.sect) {
    const [membership] = await tx.insert(schema.sectMemberships).values({
      cultivatorId, sectId: snapshot.sect.sectId, status: 'active', joinedAt: new Date(),
      contribution: 0, lifetimeContribution: 0, discipleRank: 'registered', office: 'none',
    }).returning({ id: schema.sectMemberships.id });
    if (!membership) throw new Error('导入宗门成员身份失败');
    await tx.insert(schema.sectCombatStates).values({
      membershipId: membership.id, activePathId: snapshot.sect.activePathId || null,
      meridianDepth: snapshot.sect.meridianDepth,
    });
    const methods = Object.entries(snapshot.sect.methods);
    if (methods.length) await tx.insert(schema.sectMethodProgress).values(methods.map(([methodId, level]) => ({ membershipId: membership.id, methodId, level })));
    for (const loadout of snapshot.sect.loadouts) {
      const [row] = await tx.insert(schema.sectMeridianLoadouts).values({ membershipId: membership.id, pathId: loadout.pathId }).returning({ id: schema.sectMeridianLoadouts.id });
      const path = COMBAT_V6_SECT_DEFINITIONS[snapshot.sect.sectId as keyof typeof COMBAT_V6_SECT_DEFINITIONS].paths.find((entry) => entry.id === loadout.pathId);
      if (!path) throw new Error('目标服不支持原宗门经脉');
      if (loadout.nodeIds.length) await tx.insert(schema.sectMeridianNodes).values(loadout.nodeIds.map((nodeId) => {
        const node = path.nodes.find((entry) => entry.id === nodeId);
        if (!node) throw new Error('目标服不支持原宗门经脉节点');
        return { loadoutId: row.id, nodeId, layer: node.layer };
      }));
    }
    await tx.insert(schema.sectStipendClaims).values({ membershipId: membership.id, weekKey: getSectWeekKey(), spiritStones: 0 });
  }
  if (snapshot.storyReceipts.length) await tx.insert(schema.cultivatorStories).values(snapshot.storyReceipts.map((story) => ({
    cultivatorId, track: story.track as typeof schema.cultivatorStories.$inferInsert.track,
    storyId: story.storyId, beatId: story.beatId,
    status: story.status as typeof schema.cultivatorStories.$inferInsert.status,
    acks: story.acks, grants: story.grants, marks: story.marks,
  })));
  await tx.insert(schema.spiritFields).values({ cultivatorId, starterClaimed: true, plots: [] });
  return cultivatorId;
}
