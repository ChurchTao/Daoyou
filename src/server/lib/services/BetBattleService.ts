import * as betBattleRepository from '@server/lib/repositories/betBattleRepository';
import { createBattleRecordV3 } from '@server/lib/repositories/battleRecordV3Repository';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import {
  TEMP_DISABLED_MESSAGES,
  temporaryRestrictions,
} from '@shared/config/temporaryRestrictions';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import { prepareStandardFullBattle } from '@shared/engine/battle-v5/setup/BattleStateStrategy';
import { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { and, eq, sql } from 'drizzle-orm';
import { isRealmInRange, toRealmType } from '../admin/realm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import * as schema from '../drizzle/schema';
import type { BattleRecordV3 } from './battleResult';
import { mapConsumableRow } from './consumablePersistence';
import { toArtifactFromProduct } from './creationProductArtifactSupport';
import {
  loadCultivatorCombatInput,
} from '@server/lib/services/cultivator/CultivatorCombatProjectionReader';
import { MailAttachment, MailService } from './MailService';
import { simulateBattleV5 } from './simulateBattleV5';

const BATTLE_DURATION_HOURS = 48;
export const MAX_BET_BATTLE_SPIRIT_STONES = 5_000_000;

export type BetStakeItemType = 'material' | 'artifact' | 'consumable';
export type BetStakeType = 'spirit_stones' | 'item';

export interface BetStakeInputItem {
  itemType: BetStakeItemType;
  itemId: string;
  quantity: number;
}

export interface BetBattleMutationOptions {
  tx?: DbTransaction;
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

export type BetStakeInventoryChange =
  | {
      kind: 'materials';
      operation: 'upsert';
      item: Material;
    }
  | {
      kind: 'consumables';
      operation: 'upsert';
      item: Consumable;
    }
  | {
      kind: 'materials' | 'artifacts' | 'consumables';
      operation: 'remove';
      id: string;
    };

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
  battleRecordV3Id: string;
  battleResult: BattleRecordV3;
  rumor: string;
  challenger: {
    id: string;
    name: string;
    cultivator: CultivatorCombatInput;
  };
  creator: {
    id: string;
    name: string;
    cultivator: CultivatorCombatInput;
  };
  stakeInventoryChange?: BetStakeInventoryChange;
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
  CONSUMABLE_STAKE_DISABLED: 'CONSUMABLE_STAKE_DISABLED',
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

function assertConsumableStakeAllowed(
  stakeItem: BetStakeInputItem | null,
): void {
  if (!temporaryRestrictions.disableConsumableBetBattle) return;
  if (stakeItem?.itemType !== 'consumable') return;

  throw new BetBattleServiceError(
    BetBattleError.CONSUMABLE_STAKE_DISABLED,
    TEMP_DISABLED_MESSAGES.consumableBetBattle,
  );
}

function assertBattleSnapshotStakeAllowed(rawStake: unknown): void {
  if (!temporaryRestrictions.disableConsumableBetBattle) return;
  const snapshot = normalizeStakeSnapshot(rawStake);
  if (snapshot.item?.itemType !== 'consumable') return;

  throw new BetBattleServiceError(
    BetBattleError.CONSUMABLE_STAKE_DISABLED,
    TEMP_DISABLED_MESSAGES.consumableBetBattle,
  );
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
  executor: DbExecutor = getExecutor(),
): Promise<Material | Artifact | Consumable | null> {
  const q = executor;

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
    const rows =
      await creationProductRepository.findArtifactsByIdsAndCultivator(
        cultivatorId,
        [itemId],
        q,
      );
    const artifact = rows[0] || null;
    if (!artifact || artifact.isEquipped) {
      return null;
    }
    return toArtifactFromProduct(artifact);
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
  return consumable ? mapConsumableRow(consumable) : null;
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
): Promise<{
  snapshot: BetStakeSnapshotItem;
  inventoryChange: BetStakeInventoryChange;
}> {
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

    const deleted =
      await creationProductRepository.deleteArtifactsByIdsAndCultivator(
        cultivatorId,
        [stakeItem.itemId],
        tx,
      );
    if (deleted.length !== 1) {
      throw new BetBattleServiceError(
        BetBattleError.ITEM_NOT_FOUND,
        '押注物品不存在或已被消耗',
      );
    }

    return {
      snapshot: {
        itemType: stakeItem.itemType,
        itemId: stakeItem.itemId,
        name: (ownedItem as Artifact).name,
        quantity: 1,
        quality,
        data: ownedItem,
      },
      inventoryChange: {
        kind: 'artifacts',
        operation: 'remove',
        id: stakeItem.itemId,
      },
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

  const snapshot: BetStakeSnapshotItem = {
    itemType: stakeItem.itemType,
    itemId: stakeItem.itemId,
    name: ownedItem.name,
    quantity: stakeItem.quantity,
    quality,
    data: { ...ownedItem, quantity: stakeItem.quantity } as
      | Material
      | Consumable,
  };
  return {
    snapshot,
    inventoryChange:
      stakeItem.quantity === currentQuantity
        ? {
            kind:
              stakeItem.itemType === 'material'
                ? 'materials'
                : 'consumables',
            operation: 'remove',
            id: stakeItem.itemId,
          }
        : stakeItem.itemType === 'material'
          ? {
              kind: 'materials',
              operation: 'upsert',
              item: {
                ...(ownedItem as Material),
                quantity: currentQuantity - stakeItem.quantity,
              },
            }
          : {
              kind: 'consumables',
              operation: 'upsert',
              item: {
                ...(ownedItem as Consumable),
                quantity: currentQuantity - stakeItem.quantity,
              },
            },
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
): Promise<{
  snapshot: BetStakeSnapshot;
  inventoryChange?: BetStakeInventoryChange;
}> {
  if (stakeType === 'spirit_stones') {
    await deductSpiritStones(cultivatorId, spiritStones, tx);
    return {
      snapshot: {
        stakeType,
        spiritStones,
        item: null,
      },
    };
  }

  if (!stakeItem) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_STAKE,
      '请选择押注道具',
    );
  }

  const deducted = await deductStakeItem(cultivatorId, stakeItem, tx);
  return {
    snapshot: {
      stakeType,
      spiritStones: 0,
      item: deducted.snapshot,
    },
    inventoryChange: deducted.inventoryChange,
  };
}

export async function createBetBattle(
  input: CreateBetBattleInput,
  options: BetBattleMutationOptions = {},
): Promise<{
  battleId: string;
  stakeInventoryChange?: BetStakeInventoryChange;
}> {
  const spiritStones = input.spiritStones ?? 0;
  const stakeItem = input.stakeItem ?? null;

  validateExclusiveStake(input.stakeType, spiritStones, stakeItem);
  assertConsumableStakeAllowed(stakeItem);
  if (
    input.stakeType === 'spirit_stones' &&
    spiritStones > MAX_BET_BATTLE_SPIRIT_STONES
  ) {
    throw new BetBattleServiceError(
      BetBattleError.INVALID_STAKE,
      `单次赌战押注灵石不能超过 ${MAX_BET_BATTLE_SPIRIT_STONES} 枚`,
    );
  }
  validateRealmRange(input.minRealm, input.maxRealm);

  // 分布式锁由 API/Application 层统一获取。
  const q = getExecutor(options.tx);
  const pendingCount = await betBattleRepository.countPendingByCreator(
    input.creatorId,
    q,
  );
  if (pendingCount >= 1) {
    throw new BetBattleServiceError(
      BetBattleError.MAX_ACTIVE_BATTLE,
      '每位道友只能发起一条进行中的赌战',
    );
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + BATTLE_DURATION_HOURS);

  const persistBattle = async (tx: DbTransaction) => {
    const deducted = await lockAndDeductStake(
      input.creatorId,
      input.stakeType,
      spiritStones,
      stakeItem,
      tx,
    );

    const battle = await betBattleRepository.createBetBattle(
      {
        creatorId: input.creatorId,
        creatorName: input.creatorName,
        minRealm: input.minRealm,
        maxRealm: input.maxRealm,
        taunt: input.taunt?.trim() || null,
        creatorStakeSnapshot: deducted.snapshot,
        expiresAt,
      },
      tx,
    );
    return {
      battle,
      inventoryChange: deducted.inventoryChange,
    };
  };

  const battle = options.tx
    ? await persistBattle(options.tx)
    : await getExecutor().transaction(persistBattle);

  return {
    battleId: battle.battle.id,
    stakeInventoryChange: battle.inventoryChange,
  };
}

export async function challengeBetBattle(
  input: ChallengeBetBattleInput,
  options: BetBattleMutationOptions = {},
): Promise<ChallengeBetBattleResult> {
  const spiritStones = input.spiritStones ?? 0;
  const stakeItem = input.stakeItem ?? null;

  validateExclusiveStake(input.stakeType, spiritStones, stakeItem);
  assertConsumableStakeAllowed(stakeItem);

  // 分布式锁由 API/Application 层统一获取。
  const q = getExecutor(options.tx);
  const betBattle = await betBattleRepository.findById(input.battleId, q);
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

  const challengerBundle = await loadCultivatorCombatInput(
    input.challengerId,
    q,
  );
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

  const creatorBundle = await loadCultivatorCombatInput(
    betBattle.creatorId,
    q,
  );
  if (!creatorBundle?.cultivator) {
    throw new BetBattleServiceError(
      BetBattleError.BATTLE_NOT_FOUND,
      '发起者角色不存在',
    );
  }

  assertBattleSnapshotStakeAllowed(betBattle.creatorStakeSnapshot);

  const creatorStake = normalizeStakeSnapshot(betBattle.creatorStakeSnapshot);
  const battleResult = simulateBattleV5(
    prepareStandardFullBattle({
      player: challengerBundle.cultivator,
      opponent: creatorBundle.cultivator,
    }),
  );
  const winnerId =
    battleResult.outcome.winner.id === input.challengerId
      ? input.challengerId
      : betBattle.creatorId;

  let battleRecordV3Id = '';
  const persistChallenge = async (tx: DbTransaction) => {
    const current = await betBattleRepository.findById(input.battleId, tx);

    if (!current) {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_FOUND,
        '赌战不存在',
      );
    }

    if (current.status !== 'pending') {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_PENDING,
        '该赌战已被其他道友抢先应战',
      );
    }

    const deducted = await lockAndDeductStake(
      input.challengerId,
      input.stakeType,
      spiritStones,
      stakeItem,
      tx,
    );

    const challengerStake = deducted.snapshot;
    assertStakeMatch(creatorStake, challengerStake);

    const battleRecord = await createBattleRecordV3(
      {
        userId: input.challengerUserId,
        cultivatorId: input.challengerId,
        battleType: 'challenge',
        opponentCultivatorId: betBattle.creatorId,
        battleResult,
      },
      tx,
    );
    battleRecordV3Id = battleRecord.id;

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

    const settled = await betBattleRepository.transitionPendingBetBattle(
      tx,
      input.battleId,
      {
        status: 'settled',
        challengerId: input.challengerId,
        challengerName: input.challengerName,
        challengerStakeSnapshot: challengerStake,
        winnerCultivatorId: winnerId,
        battleRecordV3Id: battleRecord.id,
        matchedAt: new Date(),
        settledAt: new Date(),
      },
    );
    if (!settled) {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_PENDING,
        '该赌战已被其他道友抢先应战',
      );
    }
    return deducted.inventoryChange;
  };

  const stakeInventoryChange = options.tx
    ? await persistChallenge(options.tx)
    : await getExecutor().transaction(persistChallenge);

  const winnerName =
    winnerId === input.challengerId
      ? challengerBundle.cultivator.name
      : creatorBundle.cultivator.name;
  const loserName =
    winnerId === input.challengerId
      ? creatorBundle.cultivator.name
      : challengerBundle.cultivator.name;

  return {
    battleId: input.battleId,
    winnerId,
    battleRecordV3Id,
    battleResult,
    rumor: `赌战台风云再起，${winnerName}力克${loserName}，夺得${buildRumorStakeSummary(
      creatorStake,
    )}！`,
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
    stakeInventoryChange,
  };
}

export async function cancelBetBattle(
  battleId: string,
  creatorId: string,
  options: BetBattleMutationOptions = {},
): Promise<void> {
  const q = getExecutor(options.tx);
  const battle = await betBattleRepository.findById(battleId, q);
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

  const persistCancel = async (tx: DbTransaction) => {
    const cancelled = await betBattleRepository.transitionPendingBetBattle(
      tx,
      battleId,
      { status: 'cancelled' },
      creatorId,
    );
    if (!cancelled) {
      throw new BetBattleServiceError(
        BetBattleError.BATTLE_NOT_PENDING,
        '当前状态无法取消',
      );
    }

    await MailService.sendMail(
      creatorId,
      '赌战已取消，押注返还',
      '你发起的赌战已取消，押注物资已通过附件返还。',
      buildRewardAttachments(creatorStake),
      'reward',
      tx,
    );
  };

  if (options.tx) {
    await persistCancel(options.tx);
  } else {
    await getExecutor().transaction(persistCancel);
  }
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
