import type { BattleEngineResult } from '@/engine/battle';
import { simulateBattle } from '@/engine/battle';
import { redis } from '@/lib/redis';
import * as betBattleRepository from '@/lib/repositories/betBattleRepository';
import { createMessage } from '@/lib/repositories/worldChatRepository';
import type { Cultivator } from '@/types/cultivator';
import { Artifact, Consumable, Material } from '@/types/cultivator';
import { and, eq, sql } from 'drizzle-orm';
import { isRealmInRange, toRealmType } from '../admin/realm';
import { getExecutor, type DbExecutor } from '../drizzle/db';
import * as schema from '../drizzle/schema';
import { MailAttachment, MailService } from './MailService';
import { getCultivatorByIdUnsafe } from './cultivatorService';

const CREATE_LOCK_PREFIX = 'bet_battle:create:lock:';
const CHALLENGE_LOCK_PREFIX = 'bet_battle:challenge:lock:';
const BATTLE_DURATION_HOURS = 48;

export type BetStakeItemType = 'material' | 'artifact' | 'consumable';
export type BetStakeType = 'spirit_stones' | 'item';

export interface BetStakeInputItem {
  itemType: BetStakeItemType;
  itemId: string;
  quantity: number;
}

export interface BetStakeSnapshotItem {
  itemType: BetStakeItemType;
  itemId: string;
  name: string;
  quantity: number;
  quality: string;
  data: Material | Artifact | Consumable;
}

export interface BetStakeSnapshot {
  stakeType: BetStakeType;
  spiritStones: number;
  item: BetStakeSnapshotItem | null;
}

export interface CreateBetBattleInput {
  creatorId: string;
  creatorName: string;
  minRealm: string;
  maxRealm: string;
  taunt?: string;
  stakeType: BetStakeType;
  spiritStones?: number;
  stakeItem?: BetStakeInputItem | null;
}

export interface ChallengeBetBattleInput {
  battleId: string;
  challengerId: string;
  challengerName: string;
  challengerUserId: string;
  stakeType: BetStakeType;
  spiritStones?: number;
  stakeItem?: BetStakeInputItem | null;
}

export interface ChallengeBetBattleResult {
  battleId: string;
  winnerId: string;
  battleRecordId: string;
  battleResult: BattleEngineResult;
  challenger: {
    id: string;
    name: string;
    cultivator: Cultivator;
  };
  creator: {
    id: string;
    name: string;
    cultivator: Cultivator;
  };
}

export const BetBattleError = {
  INVALID_STAKE: 'INVALID_STAKE',
  INVALID_REALM_RANGE: 'INVALID_REALM_RANGE',
  MAX_ACTIVE_BATTLE: 'MAX_ACTIVE_BATTLE',
  BATTLE_NOT_FOUND: 'BATTLE_NOT_FOUND',
  BATTLE_EXPIRED: 'BATTLE_EXPIRED',
  BATTLE_NOT_PENDING: 'BATTLE_NOT_PENDING',
  NOT_CREATOR: 'NOT_CREATOR',
  CHALLENGE_SELF: 'CHALLENGE_SELF',
  CHALLENGER_REALM_MISMATCH: 'CHALLENGER_REALM_MISMATCH',
  CHALLENGER_STAKE_MISMATCH: 'CHALLENGER_STAKE_MISMATCH',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  INSUFFICIENT_SPIRIT_STONES: 'INSUFFICIENT_SPIRIT_STONES',
  CONCURRENT_OPERATION: 'CONCURRENT_OPERATION',
} as const;

export type BetBattleErrorCode =
  (typeof BetBattleError)[keyof typeof BetBattleError];

export class BetBattleServiceError extends Error {
  constructor(
    public code: BetBattleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BetBattleServiceError';
  }
}

function getItemQuality(
  itemType: BetStakeItemType,
  item: Material | Artifact | Consumable,
): string {
  if (itemType === 'material') {
    return (item as Material).rank;
  }
  return (item as Artifact | Consumable).quality || '凡品';
}

function validateExclusiveStake(
  stakeType: BetStakeType,
  spiritStones: number,
  stakeItem: BetStakeInputItem | null,
): void {
  if (stakeType === 'spirit_stones') {
    if (stakeItem) {
      throw new BetBattleServiceError(
        BetBattleError.INVALID_STAKE,
        '灵石赌斗不可同时押注道具',
      );
    }
    if (!Number.isInteger(spiritStones) || spiritStones <= 0) {
      throw new BetBattleServiceError(
        BetBattleError.INVALID_STAKE,
        '灵石押注必须是大于0的整数',
      );
    }
    return;
  }

  if (spiritStones !== 0) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_STAKE,
      '道具赌斗不可同时押注灵石',
    );
  }
  if (!stakeItem) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_STAKE,
      '请选择一个押注道具',
    );
  }
  if (stakeItem.quantity < 1) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_QUANTITY,
      '押注数量至少为1',
    );
  }
}

function validateRealmRange(minRealm: string, maxRealm: string): void {
  const min = toRealmType(minRealm);
  const max = toRealmType(maxRealm);

  if (!min || !max) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_REALM_RANGE,
      '境界范围无效',
    );
  }

  if (!isRealmInRange(min, min, max)) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_REALM_RANGE,
      '最小境界不可高于最大境界',
    );
  }
}

async function getItemSnapshot(
  itemType: BetStakeItemType,
  itemId: string,
  cultivatorId: string,
  executor?: DbExecutor,
): Promise<Material | Artifact | Consumable | null> {
  const q = executor ?? getExecutor();

  if (itemType === 'material') {
    const [material] = await q
      .select()
      .from(schema.materials)
      .where(
        and(
          eq(schema.materials.id, itemId),
          eq(schema.materials.cultivatorId, cultivatorId),
        ),
      )
      .limit(1);
    return (material as Material | null) || null;
  }

  if (itemType === 'artifact') {
    const [artifact] = await q
      .select()
      .from(schema.artifacts)
      .where(
        and(
          eq(schema.artifacts.id, itemId),
          eq(schema.artifacts.cultivatorId, cultivatorId),
        ),
      )
      .limit(1);
    return (artifact as Artifact | null) || null;
  }

  const [consumable] = await q
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.id, itemId),
        eq(schema.consumables.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);
  return (consumable as Consumable | null) || null;
}

async function deductSpiritStones(
  cultivatorId: string,
  amount: number,
  tx: DbExecutor,
): Promise<void> {
  const [updated] = await tx
    .update(schema.cultivators)
    .set({
      spirit_stones: sql`${schema.cultivators.spirit_stones} - ${amount}`,
    })
    .where(
      sql`${schema.cultivators.id} = ${cultivatorId} AND ${schema.cultivators.spirit_stones} >= ${amount}`,
    )
    .returning({ id: schema.cultivators.id });

  if (!updated) {
    throw new BetBattleServiceError(
      BetBattleError.INSUFFICIENT_SPIRIT_STONES,
      `灵石不足，押注需要 ${amount}`,
    );
  }
}

async function deductStakeItem(
  cultivatorId: string,
  stakeItem: BetStakeInputItem,
  tx: DbExecutor,
): Promise<BetStakeSnapshotItem> {
  const ownedItem = await getItemSnapshot(
    stakeItem.itemType,
    stakeItem.itemId,
    cultivatorId,
    tx,
  );

  if (!ownedItem) {
    throw new BetBattleServiceError(
      BetBattleError.ITEM_NOT_FOUND,
      '押注物品不存在或已被消耗',
    );
  }

  const quality = getItemQuality(stakeItem.itemType, ownedItem);

  if (stakeItem.itemType === 'artifact') {
    if (stakeItem.quantity !== 1) {
      throw new BetBattleServiceError(
        BetBattleError.INVALID_QUANTITY,
        '法宝押注数量必须为 1',
      );
    }

    await tx
      .delete(schema.artifacts)
      .where(
        and(
          eq(schema.artifacts.id, stakeItem.itemId),
          eq(schema.artifacts.cultivatorId, cultivatorId),
        ),
      );

    return {
      itemType: stakeItem.itemType,
      itemId: stakeItem.itemId,
      name: (ownedItem as Artifact).name,
      quantity: 1,
      quality,
      data: ownedItem,
    };
  }

  const currentQuantity =
    'quantity' in ownedItem ? (ownedItem.quantity ?? 0) : 0;

  if (stakeItem.quantity > currentQuantity) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_QUANTITY,
      `押注数量不足，当前仅有 ${currentQuantity}`,
    );
  }

  const table =
    stakeItem.itemType === 'material' ? schema.materials : schema.consumables;

  if (stakeItem.quantity === currentQuantity) {
    await tx
      .delete(table)
      .where(
        and(
          eq(table.id, stakeItem.itemId),
          eq(table.cultivatorId, cultivatorId),
        ),
      );
  } else {
    await tx
      .update(table)
      .set({ quantity: currentQuantity - stakeItem.quantity })
      .where(
        and(
          eq(table.id, stakeItem.itemId),
          eq(table.cultivatorId, cultivatorId),
        ),
      );
  }

  return {
    itemType: stakeItem.itemType,
    itemId: stakeItem.itemId,
    name: ownedItem.name,
    quantity: stakeItem.quantity,
    quality,
    data: { ...ownedItem, quantity: stakeItem.quantity } as
      | Material
      | Consumable,
  };
}

function normalizeStakeSnapshot(raw: unknown): BetStakeSnapshot {
  const value = raw as Partial<BetStakeSnapshot> & {
    items?: BetStakeSnapshotItem[];
  };

  if (value.stakeType) {
    return {
      stakeType: value.stakeType,
      spiritStones: value.spiritStones || 0,
      item: value.item || null,
    };
  }

  // 兼容旧结构
  const legacyItems = value.items || [];
  if ((value.spiritStones || 0) > 0) {
    return {
      stakeType: 'spirit_stones',
      spiritStones: value.spiritStones || 0,
      item: null,
    };
  }

  return {
    stakeType: 'item',
    spiritStones: 0,
    item: legacyItems[0] || null,
  };
}

function assertStakeMatch(
  creatorStake: BetStakeSnapshot,
  challengerStake: BetStakeSnapshot,
): void {
  if (creatorStake.stakeType !== challengerStake.stakeType) {
    throw new BetBattleServiceError(
      BetBattleError.CHALLENGER_STAKE_MISMATCH,
      '应战押注类型与发起方不一致',
    );
  }

  if (creatorStake.stakeType === 'spirit_stones') {
    if (creatorStake.spiritStones !== challengerStake.spiritStones) {
      throw new BetBattleServiceError(
        BetBattleError.CHALLENGER_STAKE_MISMATCH,
        '应战灵石数量必须与发起方一致',
      );
    }
    return;
  }

  const c = creatorStake.item;
  const s = challengerStake.item;
  if (!c || !s) {
    throw new BetBattleServiceError(
      BetBattleError.CHALLENGER_STAKE_MISMATCH,
      '应战押注不完整',
    );
  }

  if (
    c.itemType !== s.itemType ||
    c.quality !== s.quality ||
    c.quantity !== s.quantity
  ) {
    throw new BetBattleServiceError(
      BetBattleError.CHALLENGER_STAKE_MISMATCH,
      '应战押注需满足同类同品质同数量',
    );
  }
}

function buildRewardAttachments(stake: BetStakeSnapshot): MailAttachment[] {
  if (stake.stakeType === 'spirit_stones') {
    return [
      {
        type: 'spirit_stones',
        name: '灵石',
        quantity: stake.spiritStones,
      },
    ];
  }

  if (!stake.item) return [];
  return [
    {
      type: stake.item.itemType,
      name: stake.item.name,
      quantity: stake.item.quantity,
      data: stake.item.data,
    },
  ];
}

function buildRumorStakeSummary(stake: BetStakeSnapshot): string {
  if (stake.stakeType === 'spirit_stones') {
    return `${stake.spiritStones * 2}枚灵石`;
  }

  if (!stake.item) return '赌注';
  return `${stake.item.quality}${stake.item.name} x${stake.item.quantity * 2}`;
}

async function lockAndDeductStake(
  cultivatorId: string,
  stakeType: BetStakeType,
  spiritStones: number,
  stakeItem: BetStakeInputItem | null,
  tx: DbExecutor,
): Promise<BetStakeSnapshot> {
  if (stakeType === 'spirit_stones') {
    await deductSpiritStones(cultivatorId, spiritStones, tx);
    return {
      stakeType,
      spiritStones,
      item: null,
    };
  }

  if (!stakeItem) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_STAKE,
      '请选择押注道具',
    );
  }

  const item = await deductStakeItem(cultivatorId, stakeItem, tx);
  return {
    stakeType,
    spiritStones: 0,
    item,
  };
}

export async function createBetBattle(
  input: CreateBetBattleInput,
): Promise<{ battleId: string }> {
  const spiritStones = input.spiritStones ?? 0;
  const stakeItem = input.stakeItem ?? null;

  validateExclusiveStake(input.stakeType, spiritStones, stakeItem);
  validateRealmRange(input.minRealm, input.maxRealm);

  const lockKey = `${CREATE_LOCK_PREFIX}${input.creatorId}`;
  const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 10 });
  if (!acquired) {
    throw new BetBattleServiceError(
      BetBattleError.CONCURRENT_OPERATION,
      '正在处理其他赌战请求，请稍后重试',
    );
  }

  try {
    const pendingCount = await betBattleRepository.countPendingByCreator(
      input.creatorId,
    );
    if (pendingCount >= 1) {
      throw new BetBattleServiceError(
        BetBattleError.MAX_ACTIVE_BATTLE,
        '每位道友只能发起一条进行中的赌战',
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + BATTLE_DURATION_HOURS);

    const q = getExecutor();
    const battle = await q.transaction(async (tx) => {
      const creatorStakeSnapshot = await lockAndDeductStake(
        input.creatorId,
        input.stakeType,
        spiritStones,
        stakeItem,
        tx,
      );

      return betBattleRepository.createBetBattle(
        {
          creatorId: input.creatorId,
          creatorName: input.creatorName,
          minRealm: input.minRealm,
          maxRealm: input.maxRealm,
          taunt: input.taunt?.trim() || null,
          creatorStakeSnapshot,
          expiresAt,
        },
        tx,
      );
    });

    return { battleId: battle.id };
  } finally {
    await redis.del(lockKey);
  }
}

export async function challengeBetBattle(
  input: ChallengeBetBattleInput,
): Promise<ChallengeBetBattleResult> {
  const spiritStones = input.spiritStones ?? 0;
  const stakeItem = input.stakeItem ?? null;

  validateExclusiveStake(input.stakeType, spiritStones, stakeItem);

  const lockKey = `${CHALLENGE_LOCK_PREFIX}${input.battleId}`;
  const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 10 });
  if (!acquired) {
    throw new BetBattleServiceError(
      BetBattleError.CONCURRENT_OPERATION,
      '该赌战正在被其他道友应战，请稍后再试',
    );
  }

  try {
    const betBattle = await betBattleRepository.findById(input.battleId);
    if (!betBattle) {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_FOUND,
        '赌战不存在',
      );
    }

    if (betBattle.status !== 'pending') {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_PENDING,
        '该赌战已结束或不可应战',
      );
    }

    if (new Date() > betBattle.expiresAt) {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_EXPIRED,
        '赌战已过期',
      );
    }

    if (betBattle.creatorId === input.challengerId) {
      throw new BetBattleServiceError(
        BetBattleError.CHALLENGE_SELF,
        '不可应战自己发起的赌战',
      );
    }

    const challengerBundle = await getCultivatorByIdUnsafe(input.challengerId);
    if (!challengerBundle?.cultivator) {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_FOUND,
        '应战角色不存在',
      );
    }

    const challengerRealm = toRealmType(challengerBundle.cultivator.realm);
    const minRealm = toRealmType(betBattle.minRealm);
    const maxRealm = toRealmType(betBattle.maxRealm);

    if (!challengerRealm || !minRealm || !maxRealm) {
      throw new BetBattleServiceError(
        BetBattleError.INVALID_REALM_RANGE,
        '赌战境界配置异常',
      );
    }

    if (!isRealmInRange(challengerRealm, minRealm, maxRealm)) {
      throw new BetBattleServiceError(
        BetBattleError.CHALLENGER_REALM_MISMATCH,
        '当前境界不在可应战范围内',
      );
    }

    const creatorBundle = await getCultivatorByIdUnsafe(betBattle.creatorId);
    if (!creatorBundle?.cultivator) {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_FOUND,
        '发起者角色不存在',
      );
    }

    const creatorStake = normalizeStakeSnapshot(betBattle.creatorStakeSnapshot);
    const battleResult = simulateBattle(
      challengerBundle.cultivator,
      creatorBundle.cultivator,
    );
    const winnerId =
      battleResult.winner.id === input.challengerId
        ? input.challengerId
        : betBattle.creatorId;

    const q = getExecutor();
    let battleRecordId = '';
    await q.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(schema.betBattles)
        .where(eq(schema.betBattles.id, input.battleId))
        .limit(1);

      if (!current[0]) {
        throw new BetBattleServiceError(
          BetBattleError.BATTLE_NOT_FOUND,
          '赌战不存在',
        );
      }

      if (current[0].status !== 'pending') {
        throw new BetBattleServiceError(
          BetBattleError.BATTLE_NOT_PENDING,
          '该赌战已被其他道友抢先应战',
        );
      }

      const challengerStake = await lockAndDeductStake(
        input.challengerId,
        input.stakeType,
        spiritStones,
        stakeItem,
        tx,
      );

      assertStakeMatch(creatorStake, challengerStake);

      const [battleRecord] = await tx
        .insert(schema.battleRecords)
        .values({
          userId: input.challengerUserId,
          cultivatorId: input.challengerId,
          challengeType: 'challenge',
          opponentCultivatorId: betBattle.creatorId,
          battleResult,
          battleReport: null,
        })
        .returning({ id: schema.battleRecords.id });
      battleRecordId = battleRecord.id;

      const attachments: MailAttachment[] = [
        ...buildRewardAttachments(creatorStake),
        ...buildRewardAttachments(challengerStake),
      ];

      await MailService.sendMail(
        winnerId,
        '赌战结算奖励',
        '赌战已分胜负，附件为双方押注物资，请及时领取。',
        attachments,
        'reward',
        tx,
      );

      await betBattleRepository.updateBetBattleById(tx, input.battleId, {
        status: 'settled',
        challengerId: input.challengerId,
        challengerName: input.challengerName,
        challengerStakeSnapshot: challengerStake,
        winnerCultivatorId: winnerId,
        battleRecordId: battleRecord.id,
        matchedAt: new Date(),
        settledAt: new Date(),
      });
    });

    const winnerName =
      winnerId === input.challengerId
        ? challengerBundle.cultivator.name
        : creatorBundle.cultivator.name;
    const loserName =
      winnerId === input.challengerId
        ? creatorBundle.cultivator.name
        : challengerBundle.cultivator.name;
    const rumor = `赌战台风云再起，${winnerName}力克${loserName}，夺得${buildRumorStakeSummary(
      creatorStake,
    )}！`;
    try {
      await createMessage({
        senderUserId: input.challengerUserId,
        senderCultivatorId: null,
        senderName: '修仙界传闻',
        senderRealm: '炼气',
        senderRealmStage: '系统',
        messageType: 'text',
        textContent: rumor,
        payload: { text: rumor },
      });
    } catch (chatError) {
      console.error(
        'Bet battle settled but world chat broadcast failed:',
        chatError,
      );
    }

    return {
      battleId: input.battleId,
      winnerId,
      battleRecordId,
      battleResult,
      challenger: {
        id: challengerBundle.cultivator.id!,
        name: challengerBundle.cultivator.name,
        cultivator: challengerBundle.cultivator,
      },
      creator: {
        id: creatorBundle.cultivator.id!,
        name: creatorBundle.cultivator.name,
        cultivator: creatorBundle.cultivator,
      },
    };
  } finally {
    await redis.del(lockKey);
  }
}

export async function cancelBetBattle(
  battleId: string,
  creatorId: string,
): Promise<void> {
  const battle = await betBattleRepository.findById(battleId);
  if (!battle) {
    throw new BetBattleServiceError(
      BetBattleError.BATTLE_NOT_FOUND,
      '赌战不存在',
    );
  }

  if (battle.creatorId !== creatorId) {
    throw new BetBattleServiceError(
      BetBattleError.NOT_CREATOR,
      '仅发起者可以取消赌战',
    );
  }

  if (battle.status !== 'pending') {
    throw new BetBattleServiceError(
      BetBattleError.BATTLE_NOT_PENDING,
      '当前状态无法取消',
    );
  }

  const creatorStake = normalizeStakeSnapshot(battle.creatorStakeSnapshot);

  const q = getExecutor();
  await q.transaction(async (tx) => {
    await betBattleRepository.updateBetBattleById(tx, battleId, {
      status: 'cancelled',
    });

    await MailService.sendMail(
      creatorId,
      '赌战已取消，押注返还',
      '你发起的赌战已取消，押注物资已通过附件返还。',
      buildRewardAttachments(creatorStake),
      'reward',
      tx,
    );
  });
}

export async function expireBetBattles(): Promise<number> {
  const q = getExecutor();
  let processed = 0;

  await q.transaction(async (tx) => {
    const expired = await betBattleRepository.markExpiredPendingBetBattles(tx);

    for (const battle of expired) {
      const creatorStake = normalizeStakeSnapshot(battle.creatorStakeSnapshot);

      await MailService.sendMail(
        battle.creatorId,
        '赌战无人应战，押注返还',
        '你的赌战在48小时内无人应战，押注已通过附件退回。',
        buildRewardAttachments(creatorStake),
        'reward',
        tx,
      );
      processed++;
    }
  });

  return processed;
}
