import { db, type DbTransaction } from '@server/lib/drizzle/db';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import {
  claimInfiniteTowerFloor,
  getInfiniteTowerLeaderboard,
  getInfiniteTowerProgress,
  type InfiniteTowerProgressRecord,
} from '@server/lib/repositories/infiniteTowerRepository';
import { assembleCombatV6TrainingPlayer } from '@server/lib/services/combat-v6/CombatV6BuildService';
import { assertCombatV6MutationAllowed } from '@server/lib/services/combat-v6/CombatV6MutationGuard';
import { grantInventory } from '@server/lib/services/InventoryService';
import { automaticCommands } from '@shared/combat-v6/auto';
import {
  combatV6ReplayView,
  createCombatV6Replay,
} from '@shared/combat-v6/replay';
import { ATTRIBUTE_RESET_TALISMAN_NAME } from '@shared/config/attributeResetTalisman';
import { QI_RESTORE_TALISMAN_SCENARIOS } from '@shared/config/qiSystem';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import {
  buildInfiniteTowerEncounter,
  resolveInfiniteTowerFloor,
  resolveInfiniteTowerReward,
  type InfiniteTowerBattleContext,
  type InfiniteTowerItemRewardKind,
  type InfiniteTowerState,
} from '@shared/lib/infiniteTower';
import { createInfiniteTowerHost } from '@shared/lib/infiniteTower/combat';
import type { TowerEncounter } from '@shared/lib/tower';
import type { RealmType } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';
import { randomUUID } from 'node:crypto';

const BATTLE_TTL_SECONDS = 60 * 60;

const INFINITE_TOWER_TALISMANS: Record<
  InfiniteTowerItemRewardKind,
  Consumable
> = {
  medium_qi_talisman: {
    name: QI_RESTORE_TALISMAN_SCENARIOS.qi_restore_medium.label,
    type: '符箓',
    quality: '凡品',
    quantity: 1,
    description: '聚拢天地灵气，使用后恢复100点灵气。',
    spec: {
      kind: 'talisman',
      scenario: 'qi_restore_medium',
      sessionMode: 'consume_on_action',
      notes: '使用时恢复100点灵气。',
    },
  },
  attribute_reset_talisman: {
    name: ATTRIBUTE_RESET_TALISMAN_NAME,
    type: '符箓',
    quality: '凡品',
    quantity: 1,
    description: '洗炼根骨，使六维属性回归当前境界自然成长值。',
    spec: {
      kind: 'talisman',
      scenario: 'attribute_reset',
      sessionMode: 'consume_on_action',
      notes: '启封后重置根基属性。',
    },
  },
};

interface InfiniteTowerBattlePayload {
  battleId: string;
  cultivatorId: string;
  encounter: TowerEncounter;
}

function battleKey(battleId: string) {
  return `infinite-tower:v6:battle:${battleId}`;
}

function activeBattleKey(cultivatorId: string) {
  return `infinite-tower:v6:active:${cultivatorId}`;
}

function buildState(progress: InfiniteTowerProgressRecord): InfiniteTowerState {
  const currentFloor = progress.highestFloor + 1;
  return {
    highestFloorCleared: progress.highestFloor,
    currentFloor,
    totalSpiritStonesEarned: Number(progress.totalSpiritStonesEarned),
    firstReachedAt: progress.firstReachedAt?.toISOString() ?? null,
    currentRule: resolveInfiniteTowerFloor(currentFloor),
    currentReward: resolveInfiniteTowerReward(currentFloor),
  };
}

export class InfiniteTowerService {
  async getState(cultivatorId: string): Promise<InfiniteTowerState> {
    return buildState(await getInfiniteTowerProgress(cultivatorId));
  }

  async getLeaderboard(cultivatorId: string, realm: RealmType, limit: number) {
    return getInfiniteTowerLeaderboard({
      realm,
      limit,
      selfCultivatorId: cultivatorId,
    });
  }

  private async getPayload(battleId: string) {
    const key = battleKey(battleId);
    return parseRedisJson<InfiniteTowerBattlePayload>(
      await redis.get(key),
      key,
    );
  }

  private toContext(
    payload: InfiniteTowerBattlePayload,
  ): InfiniteTowerBattleContext {
    return {
      battleId: payload.battleId,
      encounter: payload.encounter,
      reward: resolveInfiniteTowerReward(payload.encounter.floor),
    };
  }

  async probeBattle(cultivatorId: string): Promise<{
    state: InfiniteTowerState;
    context: InfiniteTowerBattleContext;
  }> {
    const progress = await getInfiniteTowerProgress(cultivatorId);
    const state = buildState(progress);
    if (state.currentFloor > 100_000)
      throw new Error('已达到当前通天塔层数上限');
    const activeId = await redis.get(activeBattleKey(cultivatorId));
    if (activeId) {
      const existing = await this.getPayload(activeId);
      if (existing && existing.encounter.floor === state.currentFloor) {
        return { state, context: this.toContext(existing) };
      }
      await redis.del(activeBattleKey(cultivatorId), battleKey(activeId));
    }

    await assertCombatV6MutationAllowed(cultivatorId, 'tower_battle_infinite');
    await assembleCombatV6TrainingPlayer(cultivatorId, db);
    const encounter = buildInfiniteTowerEncounter({
      cultivatorId,
      floor: state.currentFloor,
    });
    const battleId = randomUUID();
    const payload: InfiniteTowerBattlePayload = {
      battleId,
      cultivatorId,
      encounter,
    };
    await redis
      .multi()
      .set(
        battleKey(battleId),
        JSON.stringify(payload),
        'EX',
        BATTLE_TTL_SECONDS,
      )
      .set(activeBattleKey(cultivatorId), battleId, 'EX', BATTLE_TTL_SECONDS)
      .exec();
    return { state, context: this.toContext(payload) };
  }

  async getBattleContext(
    cultivatorId: string,
    battleId: string,
  ): Promise<InfiniteTowerBattleContext> {
    const payload = await this.getPayload(battleId);
    if (!payload || payload.cultivatorId !== cultivatorId) {
      throw new Error('通天塔战局不存在或已失效');
    }
    return this.toContext(payload);
  }

  async executeBattle(args: {
    userId: string;
    cultivatorId: string;
    battleId: string;
    tx: DbTransaction;
    now?: Date;
  }) {
    const now = args.now ?? new Date();
    const payload = await this.getPayload(args.battleId);
    if (!payload || payload.cultivatorId !== args.cultivatorId) {
      throw new Error('通天塔战局不存在或已失效');
    }
    const progress = await getInfiniteTowerProgress(args.cultivatorId, args.tx);
    if (payload.encounter.floor !== progress.highestFloor + 1) {
      throw new Error('通天塔层数已变化，请重新挑战');
    }

    await assertCombatV6MutationAllowed(
      args.cultivatorId,
      'tower_battle_infinite',
    );
    const { player } = await assembleCombatV6TrainingPlayer(
      args.cultivatorId,
      args.tx,
    );
    const host = createInfiniteTowerHost(
      player,
      payload.encounter.floor,
      args.cultivatorId,
    );
    const input = host.runtimeSnapshot().input;
    for (let round = 0; !host.finished && round < 300; round++) {
      host.submitGroup(
        automaticCommands(
          host.state,
          host.playerId,
          input.skills ?? [],
          (id) => host.queryCommands(id),
          { statusDefs: input.statusDefs ?? [] },
        ),
      );
      host.resolveRound();
      // Let lock renewals and unrelated requests run between deterministic rounds.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (!host.finished) throw new Error('通天塔战斗超过回合上限，请重新挑战');
    const isWin = host.state.result?.winner === 0;
    const archive = createCombatV6Replay({
      battleId: args.battleId,
      participants: [
        {
          userId: args.userId,
          cultivatorId: args.cultivatorId,
          unitId: host.playerId,
          side: 0,
          slot: 0,
        },
      ],
      metadata: {
        schemaVersion: 1,
        sourceType: 'infinite-tower',
        battleType: 'pve',
        idempotencyKey: args.battleId,
        payload: { runId: args.battleId, floor: payload.encounter.floor },
      },
      startedAt: now.toISOString(),
      finishedAt: new Date().toISOString(),
      reason: 'battle-ended',
      trace: { ...host.trace(), seed: host.runtimeSnapshot().input.seed! },
    });
    const battleResult = combatV6ReplayView(
      archive,
      args.cultivatorId,
      args.userId,
    );
    const reward = resolveInfiniteTowerReward(payload.encounter.floor);
    const claim = isWin
      ? await claimInfiniteTowerFloor({
          userId: args.userId,
          cultivatorId: args.cultivatorId,
          floor: payload.encounter.floor,
          spiritStones: reward.totalReward,
          now,
          tx: args.tx,
        })
      : null;
    const inventoryChanges = claim
      ? await grantInventory(
          args.cultivatorId,
          reward.itemRewards.map((item) => ({
            definitionId: 'consumable.v1',
            quantity: item.quantity,
            instanceData: consumableFactsOf(
              INFINITE_TOWER_TALISMANS[item.kind],
            ),
          })),
          args.tx,
        )
      : [];
    const resourceChanges: ResourceChangeDescriptor[] = claim
      ? [
          {
            resourceTopic: 'player.currency',
            eventType: 'currency.infinite_tower.rewarded',
            operation: 'merge',
            payload: { spiritStones: claim.spiritStones },
          },
        ]
      : [];
    if (inventoryChanges.length)
      resourceChanges.push({
        resourceTopic: 'inventory.bag',
        operation: 'invalidate',
        eventType: 'inventory.infinite_tower.rewarded',
      });

    return {
      response: {
        battleResult,
        callbackData: {
          isWin,
          reward: isWin ? reward : null,
          state: buildState(claim?.progress ?? progress),
        },
      },
      resourceChanges,
      runtimeCommit: {
        battleId: args.battleId,
        cultivatorId: args.cultivatorId,
      },
    };
  }

  async commitBattleRuntime(commit: {
    battleId: string;
    cultivatorId: string;
  }) {
    // A retry of an old receipt must not remove a newer pending challenge.
    await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end; return redis.call('DEL', KEYS[2])",
      2,
      activeBattleKey(commit.cultivatorId),
      battleKey(commit.battleId),
      commit.battleId,
    );
  }
}

export const infiniteTowerService = new InfiniteTowerService();
