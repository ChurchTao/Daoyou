import { randomUUID } from 'node:crypto';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { EnemyGenerator } from '@shared/engine/enemyGenerator';
import {
  buildTowerBlessingChoices,
  getTowerSeasonMeta,
  isTowerSeasonKeyCurrent,
  pickTowerRace,
  resolveTowerDifficulty,
  resolveTowerFloorKind,
  resolveTowerMilestoneTier,
  resolveTowerRealmStage,
  TOWER_MAX_FLOOR,
  type TowerBattleContext,
  type TowerBlessingId,
  type TowerEncounter,
  type TowerMilestoneReward,
  type TowerSeasonMeta,
  type TowerSettlement,
  type TowerState,
} from '@shared/lib/tower';
import type { RealmType } from '@shared/types/constants';
import type { Cultivator, Material } from '@shared/types/cultivator';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import { RewardFactory } from '@server/lib/dungeon/reward';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import {
  getCultivatorByIdUnsafe,
} from '@server/lib/services/cultivatorService';
import { ConditionService } from '@server/lib/services/ConditionService';
import { MailService, type MailAttachment } from '@server/lib/services/MailService';
import { ServerEnemyCopyProvider } from '@server/lib/services/ServerEnemyCopyProvider';
import type { PlayerInfo } from '@server/lib/dungeon/types';
import { buildTowerBattleInit, applyTowerBattleOutcome } from './battleInit';
import { getTowerLeaderboard, updateTowerWeeklyRecord } from './leaderboard';

const RUN_TTL_SECONDS = 8 * 24 * 60 * 60;

const RESOURCE_DISPLAY_NAME: Record<string, string> = {
  spirit_stones: '灵石',
  cultivation_exp: '修为',
  comprehension_insight: '感悟',
  material: '材料',
};

const towerEnemyGenerator = new EnemyGenerator({
  copyProvider: new ServerEnemyCopyProvider({
    enabled: process.env.NODE_ENV !== 'test',
  }),
});

interface TowerBattleSession {
  battleId: string;
  cultivatorId: string;
  runId: string;
  seasonKey: string;
  encounter: TowerEncounter;
}

interface TowerBattleCachePayload {
  session: TowerBattleSession;
  enemyObject: Cultivator;
}

function getTowerRunKey(cultivatorId: string) {
  return `tower:run:${cultivatorId}`;
}

function getTowerBattleKey(battleId: string) {
  return `tower:battle:${battleId}`;
}

function buildTowerSettlement(
  state: TowerState,
  endReason: TowerSettlement['endReason'],
): TowerSettlement {
  return {
    seasonKey: state.seasonKey,
    highestFloorCleared: state.highestFloorCleared,
    finalFloor: state.currentFloor,
    endReason,
    milestoneRewards: state.milestoneRewardLog,
    blessings: state.blessings,
  };
}

function buildRewardPlayerInfo(cultivator: Cultivator): PlayerInfo {
  const { finalAttributes, attrs } = getCultivatorDisplayAttributes(cultivator);

  return {
    name: cultivator.name,
    realm: `${cultivator.realm} ${cultivator.realm_stage}`,
    gender: cultivator.gender ?? '未知',
    age: cultivator.age,
    lifespan: cultivator.lifespan,
    personality: cultivator.personality ?? '普通',
    attributes: finalAttributes,
    spiritual_roots: cultivator.spiritual_roots.map(
      (root) => `${root.element}(${root.strength})`,
    ),
    fates: cultivator.pre_heaven_fates.map((fate) => fate.name),
    skills: cultivator.skills.map((skill) => skill.name),
    spirit_stones: cultivator.spirit_stones,
    background: cultivator.background ?? '无',
    inventory_summary: undefined,
    resourceCaps: {
      maxHp: attrs.maxHp,
      maxMp: attrs.maxMp,
    },
  };
}

export class TowerService {
  private buildBattleContext(
    battleId: string,
    payload: TowerBattleCachePayload,
  ): TowerBattleContext {
    return {
      battleId,
      encounter: payload.session.encounter,
      enemy: payload.enemyObject,
    };
  }

  private async loadState(
    cultivatorId: string,
    now: Date = new Date(),
  ): Promise<{
    season: TowerSeasonMeta;
    state: TowerState | null;
  }> {
    const season = getTowerSeasonMeta(now);
    const key = getTowerRunKey(cultivatorId);
    const state = parseRedisJson<TowerState>(await redis.get(key), key);
    if (!state) {
      return { season, state: null };
    }

    if (!isTowerSeasonKeyCurrent(state.seasonKey, now)) {
      if (state.activeBattleId) {
        await redis.del(getTowerBattleKey(state.activeBattleId));
      }
      await redis.del(key);
      return { season, state: null };
    }

    return { season, state };
  }

  private async saveState(cultivatorId: string, state: TowerState) {
    await redis.set(
      getTowerRunKey(cultivatorId),
      JSON.stringify(state),
      'EX',
      RUN_TTL_SECONDS,
    );
  }

  private async getBattlePayload(battleId: string) {
    const key = getTowerBattleKey(battleId);
    const payload = parseRedisJson<TowerBattleCachePayload>(
      await redis.get(key),
      key,
    );

    return {
      key,
      payload,
    };
  }

  private buildEncounter(
    cultivator: Cultivator,
    state: TowerState,
  ): TowerEncounter {
    const floor = state.currentFloor;
    const kind = resolveTowerFloorKind(floor);

    return {
      floor,
      kind,
      difficulty: resolveTowerDifficulty(floor),
      race: pickTowerRace(state.runId, floor),
      realm: cultivator.realm,
      realmStage: resolveTowerRealmStage(floor),
      isBoss: kind === 'boss',
    };
  }

  private async createBattleSession(
    cultivatorId: string,
    cultivator: Cultivator,
    season: TowerSeasonMeta,
    state: TowerState,
  ) {
    const encounter = this.buildEncounter(cultivator, state);
    const draft = await towerEnemyGenerator.enrichNarrative(
      towerEnemyGenerator.buildDraft({
        realm: encounter.realm,
        realmStage: encounter.realmStage,
        race: encounter.race,
        difficulty: encounter.difficulty,
        isBoss: encounter.isBoss,
      }),
    );
    const { normalizedCondition } = buildTowerBattleInit({
      cultivator,
      condition: state.condition,
      blessings: state.blessings,
      encounterKind: encounter.kind,
    });

    const battleId = randomUUID();
    const session: TowerBattleSession = {
      battleId,
      cultivatorId,
      runId: state.runId,
      seasonKey: season.seasonKey,
      encounter,
    };

    await redis.set(
      getTowerBattleKey(battleId),
      JSON.stringify({
        session,
        enemyObject: draft.cultivator,
      } satisfies TowerBattleCachePayload),
      'EX',
      RUN_TTL_SECONDS,
    );

    return {
      session,
      enemyObject: draft.cultivator,
      normalizedCondition,
    };
  }

  private async grantMilestoneReward(args: {
    cultivatorId: string;
    cultivator: Cultivator;
    state: TowerState;
    floor: number;
    now: Date;
  }): Promise<TowerMilestoneReward | undefined> {
    if (args.state.claimedMilestones.includes(args.floor)) {
      return undefined;
    }

    const tier = resolveTowerMilestoneTier(args.floor);
    if (!tier) {
      return undefined;
    }

    const rewards = RewardFactory.generateBaseRewards(
      args.cultivator.realm,
      tier,
      args.floor,
      buildRewardPlayerInfo(args.cultivator),
    );

    // All rewards go into mail attachments for the player to claim
    // manually — nothing is auto-granted.
    const attachments: MailAttachment[] = rewards.map((item) => {
      const name =
        item.name ??
        RESOURCE_DISPLAY_NAME[item.type] ??
        item.type;

      return {
        type: item.type as MailAttachment['type'],
        name,
        quantity: item.value,
        ...(item.data ? { data: item.data as Material } : {}),
      };
    });

    const rewardLines = rewards.map(
      (r) =>
        `${RESOURCE_DISPLAY_NAME[r.type] ?? r.type} +${r.value}`,
    );

    const mailTitle = `【蜃楼幻境】第 ${args.floor} 层 · ${tier} 级机缘`;
    const mailBody = [
      `道友在蜃楼幻境第 ${args.floor} 层达成里程碑，获得${tier}级机缘奖励：`,
      '',
      ...rewardLines,
      '',
      '所有奖励已附于此邮件，请及时领取。',
    ].join('\n');

    await MailService.sendMail(
      args.cultivatorId,
      mailTitle,
      mailBody,
      attachments,
      'reward',
    );

    const reward: TowerMilestoneReward = {
      floor: args.floor,
      tier,
      realm: args.cultivator.realm,
      grantedAt: args.now.toISOString(),
      rewards,
    };

    args.state.claimedMilestones.push(args.floor);
    args.state.milestoneRewardLog.push(reward);

    return reward;
  }

  async getState(cultivatorId: string, now: Date = new Date()) {
    const { season, state } = await this.loadState(cultivatorId, now);
    return {
      season,
      state,
      settlement:
        state?.status === 'FINISHED'
          ? buildTowerSettlement(
              state,
              state.currentFloor >= TOWER_MAX_FLOOR ? 'clear' : 'defeat',
            )
          : undefined,
    };
  }

  async startRun(cultivatorId: string, now: Date = new Date()) {
    const { season, state } = await this.loadState(cultivatorId, now);
    if (state && state.status !== 'FINISHED') {
      throw new Error('当前已有尚未结束的幻境进度');
    }

    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }

    // Carry forward milestone progress from any previous run in the same
    // season (e.g. a finished run or a reset-preserved state) so that
    // milestone rewards cannot be claimed more than once per season.
    const previousMilestones =
      state?.seasonKey === season.seasonKey
        ? state.claimedMilestones
        : [];
    const previousRewardLog =
      state?.seasonKey === season.seasonKey
        ? state.milestoneRewardLog
        : [];

    const nextState: TowerState = {
      runId: randomUUID(),
      seasonKey: season.seasonKey,
      status: 'READY',
      currentFloor: 1,
      highestFloorCleared: 0,
      condition: ConditionService.normalizeCondition(
        cultivatorBundle.cultivator,
        cultivatorBundle.cultivator.condition,
        now,
      ),
      blessings: {},
      pendingBlessingChoices: [],
      claimedMilestones: [...previousMilestones],
      milestoneRewardLog: [...previousRewardLog],
    };

    await this.saveState(cultivatorId, nextState);
    return {
      season,
      state: nextState,
    };
  }

  async resetRun(cultivatorId: string, now: Date = new Date()) {
    const { season, state } = await this.loadState(cultivatorId, now);
    if (state?.activeBattleId) {
      await redis.del(getTowerBattleKey(state.activeBattleId));
    }

    // Preserve claimed milestones and reward log across resets within
    // the same season so that milestone rewards cannot be farmed by
    // repeatedly resetting and replaying the tower.
    if (state) {
      const preservedState: TowerState = {
        ...state,
        runId: randomUUID(),
        status: 'FINISHED',
        currentFloor: 1,
        highestFloorCleared: 0,
        blessings: {},
        pendingBlessingChoices: [],
        activeBattleId: undefined,
      };
      await this.saveState(cultivatorId, preservedState);
    } else {
      await redis.del(getTowerRunKey(cultivatorId));
    }

    return {
      success: true,
      season,
    };
  }

  async probeBattle(cultivatorId: string, now: Date = new Date()) {
    const { season, state } = await this.loadState(cultivatorId, now);
    if (!state) {
      throw new Error('当前没有进行中的幻境');
    }
    if (state.status === 'FINISHED') {
      throw new Error('本轮幻境已结束，请手动重置后重新开始');
    }
    if (state.status === 'CHOOSING_BLESSING') {
      throw new Error('请先选择本层祝福');
    }

    if (state.status === 'WAITING_BATTLE' && state.activeBattleId) {
      const { payload } = await this.getBattlePayload(state.activeBattleId);
      if (payload?.session && payload.enemyObject) {
        return {
          season,
          state,
          ...this.buildBattleContext(state.activeBattleId, payload),
        };
      }

      delete state.activeBattleId;
      state.status = 'READY';
    }

    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }

    const session = await this.createBattleSession(
      cultivatorId,
      cultivatorBundle.cultivator,
      season,
      state,
    );

    state.condition = session.normalizedCondition;
    state.status = 'WAITING_BATTLE';
    state.activeBattleId = session.session.battleId;

    await this.saveState(cultivatorId, state);

    return {
      season,
      state,
      ...this.buildBattleContext(session.session.battleId, {
        session: session.session,
        enemyObject: session.enemyObject,
      }),
    };
  }

  async getBattleContext(
    cultivatorId: string,
    battleId: string,
    now: Date = new Date(),
  ) {
    const { state } = await this.loadState(cultivatorId, now);
    if (
      !state ||
      state.status !== 'WAITING_BATTLE' ||
      state.activeBattleId !== battleId
    ) {
      throw new Error('当前没有匹配的幻境战局');
    }

    const { payload } = await this.getBattlePayload(battleId);
    if (
      !payload?.session ||
      !payload.enemyObject ||
      payload.session.cultivatorId !== cultivatorId
    ) {
      throw new Error('幻境战局数据不存在或已失效');
    }

    return this.buildBattleContext(battleId, payload);
  }

  async chooseBlessing(
    cultivatorId: string,
    blessingId: TowerBlessingId,
    now: Date = new Date(),
  ) {
    const { season, state } = await this.loadState(cultivatorId, now);
    if (!state) {
      throw new Error('当前没有进行中的幻境');
    }
    if (state.status !== 'CHOOSING_BLESSING') {
      throw new Error('当前不在选择祝福阶段');
    }

    const choice = state.pendingBlessingChoices.find((item) => item.id === blessingId);
    if (!choice) {
      throw new Error('无效的祝福选择');
    }

    state.blessings[blessingId] = choice.nextStacks;
    state.pendingBlessingChoices = [];
    state.currentFloor += 1;
    state.status = 'READY';

    await this.saveState(cultivatorId, state);
    return {
      season,
      state,
    };
  }

  async executeBattle(
    cultivatorId: string,
    battleId: string,
    now: Date = new Date(),
  ) {
    const { state } = await this.loadState(cultivatorId, now);
    if (!state || state.activeBattleId !== battleId) {
      throw new Error('当前没有匹配的幻境战局');
    }

    const { key: battleKey, payload } = await this.getBattlePayload(battleId);
    if (!payload?.session || !payload.enemyObject) {
      throw new Error('幻境战局数据不存在或已失效');
    }

    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }

    const { battleInit } = buildTowerBattleInit({
      cultivator: cultivatorBundle.cultivator,
      condition: state.condition,
      blessings: state.blessings,
      encounterKind: payload.session.encounter.kind,
    });
    const battleResult = simulateBattleV5(
      cultivatorBundle.cultivator,
      payload.enemyObject,
      battleInit,
    );

    const isWin = battleResult.winner.id === cultivatorId;
    const playerSnapshot = isWin
      ? battleResult.winnerSnapshot
      : battleResult.loserSnapshot;

    if (!playerSnapshot) {
      throw new Error('战斗终局缺少玩家状态快照');
    }

    state.condition = applyTowerBattleOutcome({
      cultivator: cultivatorBundle.cultivator,
      condition: state.condition,
      playerSnapshot,
      didLose: !isWin,
      now,
    });
    delete state.activeBattleId;

    let settlement: TowerSettlement | undefined;
    let milestoneReward: TowerMilestoneReward | undefined;

    if (!isWin) {
      state.pendingBlessingChoices = [];
      state.status = 'FINISHED';
      await this.saveState(cultivatorId, state);
      settlement = buildTowerSettlement(state, 'defeat');
    } else {
      const clearedFloor = payload.session.encounter.floor;
      state.highestFloorCleared = Math.max(
        state.highestFloorCleared,
        clearedFloor,
      );

      await updateTowerWeeklyRecord({
        seasonKey: state.seasonKey,
        seasonEndAt: getTowerSeasonMeta(now).seasonEndsAt,
        cultivatorId,
        recordedRealm: cultivatorBundle.cultivator.realm,
        highestFloor: state.highestFloorCleared,
        firstReachedAt: now.toISOString(),
      });

      milestoneReward = await this.grantMilestoneReward({
        cultivatorId,
        cultivator: cultivatorBundle.cultivator,
        state,
        floor: clearedFloor,
        now,
      });

      if (clearedFloor >= TOWER_MAX_FLOOR) {
        state.pendingBlessingChoices = [];
        state.status = 'FINISHED';
        await this.saveState(cultivatorId, state);
        settlement = buildTowerSettlement(state, 'clear');
      } else {
        const { maxHp, maxMp } = ConditionService.getMaxResources(
          cultivatorBundle.cultivator,
        );
        const choices = buildTowerBlessingChoices({
          runId: state.runId,
          clearedFloor,
          blessings: state.blessings,
          currentHp: state.condition.resources.hp.current,
          maxHp,
          currentMp: state.condition.resources.mp.current,
          maxMp,
        });

        if (choices.length === 0) {
          state.pendingBlessingChoices = [];
          state.currentFloor = clearedFloor + 1;
          state.status = 'READY';
        } else {
          state.pendingBlessingChoices = choices;
          state.status = 'CHOOSING_BLESSING';
        }

        await this.saveState(cultivatorId, state);
      }
    }

    await redis.del(battleKey);

    return {
      battleResult,
      state,
      isFinished: state.status === 'FINISHED',
      settlement,
      milestoneReward,
    };
  }

  async getLeaderboard(
    cultivatorId: string | undefined,
    realm: RealmType,
    limit: number,
    now: Date = new Date(),
  ) {
    const season = getTowerSeasonMeta(now);
    const entries = await getTowerLeaderboard({
      seasonKey: season.seasonKey,
      seasonEndAt: season.seasonEndsAt,
      realm,
      limit,
      selfCultivatorId: cultivatorId,
    });

    return {
      season,
      realm,
      entries,
    };
  }
}

export const towerService = new TowerService();
