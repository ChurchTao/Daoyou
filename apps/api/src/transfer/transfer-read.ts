import type { TransferPackageHeader } from '@daoyou/contracts/transfer';
import { TRANSFER_BEAST_LIMIT, TRANSFER_STONE_LIMIT, transferableBagItems } from '@daoyou/game-rules/transfer';
import { BeastLineupSchema } from '@daoyou/game-domain/beasts';
import { and, eq } from 'drizzle-orm';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';
import { inventoryItemOf, assertInventoryIdle } from '@server/inventory/operations.js';
import { readSectCombatProgress } from '@server/lib/repositories/sectCombatRepository.js';
import { validateTransferSnapshot, type TransferSnapshot } from './transfer-snapshot.js';

export class TransferEligibilityError extends Error {}

export async function readTransferSnapshot(
  tx: DbTransaction,
  userId: string,
  cultivatorId: string,
  header: TransferPackageHeader,
): Promise<TransferSnapshot> {
  const [role] = await tx.select().from(schema.cultivators).where(and(
    eq(schema.cultivators.id, cultivatorId),
    eq(schema.cultivators.userId, userId),
    eq(schema.cultivators.status, 'active'),
  )).for('update');
  if (!role) throw new TransferEligibilityError('角色不可导出');
  await assertInventoryIdle(cultivatorId, tx);
  const activeListing = await tx.query.auctionListings.findFirst({
    columns: { id: true },
    where: and(eq(schema.auctionListings.sellerId, cultivatorId), eq(schema.auctionListings.status, 'active')),
  });
  if (activeListing) throw new TransferEligibilityError('请先撤下所有在售物品和灵兽');
  const pendingMail = await tx.query.mails.findMany({
    columns: { attachments: true, isClaimed: true },
    where: and(eq(schema.mails.cultivatorId, cultivatorId), eq(schema.mails.isClaimed, false)),
  });
  if (pendingMail.some((mail) => Array.isArray(mail.attachments) && mail.attachments.length > 0))
    throw new TransferEligibilityError('请先领取所有邮件附件');
  const openPacket = await tx.query.chatRedPackets.findFirst({ columns: { id: true }, where: and(eq(schema.chatRedPackets.senderCultivatorId, cultivatorId), eq(schema.chatRedPackets.status, 'open')) });
  if (openPacket) throw new TransferEligibilityError('请等待红包结束并完成退款');
  const activeRun = await tx.query.dungeonRuns.findFirst({ columns: { id: true }, where: and(eq(schema.dungeonRuns.cultivatorId, cultivatorId), eq(schema.dungeonRuns.status, 'EXPLORING')) });
  if (activeRun) throw new TransferEligibilityError('请先结束进行中的副本');

  const roots = await tx.select().from(schema.spiritualRoots).where(eq(schema.spiritualRoots.cultivatorId, cultivatorId));
  const fates = await tx.select().from(schema.preHeavenFates).where(eq(schema.preHeavenFates.cultivatorId, cultivatorId));
  const [manualState] = await tx.select().from(schema.cultivatorManualStates).where(eq(schema.cultivatorManualStates.cultivatorId, cultivatorId));
  const manualSlots = await tx.select().from(schema.cultivatorManualSlots).where(eq(schema.cultivatorManualSlots.cultivatorId, cultivatorId));
  const inventory = (await tx.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.cultivatorId, cultivatorId))).map(inventoryItemOf);
  const items = [...inventory.filter((item) => item.location === 'equipped'), ...transferableBagItems(inventory)];
  const equipped = await tx.select().from(schema.cultivatorEquipmentSlots).where(eq(schema.cultivatorEquipmentSlots.cultivatorId, cultivatorId));
  const [lineupRow] = await tx.select().from(schema.cultivatorBeastLineups).where(eq(schema.cultivatorBeastLineups.cultivatorId, cultivatorId));
  const sourceLineup = BeastLineupSchema.parse(lineupRow?.lineup ?? { carriedBeastIds: [], revision: 0 });
  const carriedBeastIds = sourceLineup.carriedBeastIds.slice(0, TRANSFER_BEAST_LIMIT);
  const lineup = { ...sourceLineup, carriedBeastIds,
    ...(sourceLineup.leadBeastId && !carriedBeastIds.includes(sourceLineup.leadBeastId) ? { leadBeastId: undefined } : {}),
  };
  const beastRows = await tx.select().from(schema.cultivatorBeasts).where(eq(schema.cultivatorBeasts.cultivatorId, cultivatorId));
  const beastMap = new Map(beastRows.map((beast) => [beast.id, beast]));
  const beasts = lineup.carriedBeastIds.map((id) => {
    const row = beastMap.get(id);
    if (!row) throw new Error('灵兽袋包含不存在的个体');
    return { ...row.individual, id: row.id, ownerCultivatorId: cultivatorId };
  });
  const [membership] = await tx.select().from(schema.sectMemberships).where(and(eq(schema.sectMemberships.cultivatorId, cultivatorId), eq(schema.sectMemberships.status, 'active')));
  const sectProgress = membership ? await readSectCombatProgress(membership.id, tx) : null;
  if (membership && !sectProgress) throw new Error('原宗门修炼数据不兼容');
  const stories = await tx.select().from(schema.cultivatorStories).where(eq(schema.cultivatorStories.cultivatorId, cultivatorId));
  return validateTransferSnapshot({
    header,
    role: {
      name: role.name, title: role.title, gender: role.gender, origin: role.origin,
      personality: role.personality, background: role.background, prompt: role.prompt,
      playerRace: role.playerRace, raceNarrative: role.raceNarrative,
      realm: role.realm, realmStage: role.realm_stage, age: role.age, lifespan: role.lifespan,
      closedDoorYearsTotal: role.closedDoorYearsTotal ?? 0,
      attributes: { vitality: role.vitality, strength: role.strength, spirit: role.spirit, endurance: role.endurance, speed: role.speed, willpower: role.willpower },
      unallocatedAttributePoints: role.unallocatedAttributePoints,
      spiritStones: Math.min(role.spirit_stones, TRANSFER_STONE_LIMIT),
      cultivationProgress: role.cultivation_progress ?? {}, condition: role.condition ?? {},
    },
    roots: roots.map((root) => ({ element: root.element, strength: root.strength, marrowWashBonus: root.marrowWashBonus, grade: root.grade })),
    fates: fates.map((fate) => ({ name: fate.name, quality: fate.quality, details: fate.details, description: fate.description })),
    manuals: { learned: manualState?.learned ?? [], slots: manualSlots.map((slot) => ({ slot: slot.slot, manualId: slot.manualId })) },
    sect: sectProgress ? {
      sectId: sectProgress.sect.sectId,
      methods: sectProgress.sect.methods,
      activePathId: sectProgress.sect.activePathId,
      meridianDepth: sectProgress.sect.meridianDepth,
      loadouts: sectProgress.sect.meridianLoadouts.map((loadout) => ({ pathId: loadout.pathId, nodeIds: loadout.nodeIds })),
    } : null,
    items,
    equipped: equipped.map((entry) => ({ slot: entry.slot, itemId: entry.equipmentInstanceId })),
    beasts,
    lineup,
    beastStarterClaimed: Boolean(lineupRow?.starterClaimedAt),
    storyReceipts: stories.map((story) => ({ track: story.track, storyId: story.storyId, beatId: story.beatId, status: story.status, acks: story.acks, grants: story.grants, marks: story.marks })),
  });
}
