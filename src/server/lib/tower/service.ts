import { randomUUID } from 'node:crypto';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import {
  buildTowerBlessingChoices,
  getTowerSeasonMeta,
  isTowerSeasonKeyCurrent,
  isTowerRealmEligible,
  resolveTowerMilestoneTier,
  TOWER_MIN_REALM,
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
  getPlayerRuntimeCultivatorByIdUnsafe,
} from '@server/lib/services/cultivatorService';
import { ConditionService } from '@server/lib/services/ConditionService';
import { MailService, type MailAttachment } from '@server/lib/services/MailService';
import type { PlayerInfo } from '@server/lib/dungeon/types';
import { buildTowerBattleInit, applyTowerBattleOutcome } from './battleInit';
import { withPlayerAbilityStrategySettings } from '@shared/lib/battle/abilityStrategyInit';
import { getResourceTypeLabel } from '@shared/lib/gameConceptDisplay';
import { towerEnemySetService } from './enemySets';
import { getTowerLeaderboard, updateTowerWeeklyRecord } from './leaderboard';
import type { DbTransaction } from '@server/lib/drizzle/db';

const RUN_TTL_SECONDS = 8 * 24 * 60 * 60;
const TOWER_REPUTATION_REWARDS: Record<TowerMilestoneReward['tier'], number> = {
  C: 5,
  B: 10,
  A: 15,
  S: 20,
};

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

interface TowerMilestoneRewardCommit {
  reward: TowerMilestoneReward;
  mail: {
    title: string;
    body: string;
    attachments: MailAttachment[];
  };
}

interface TowerBattleExecutionOptions {
  deferPersistence?: boolean;
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

function buildTowerEligibility(realm: RealmType | undefined) {
  return {
    eligible: realm ? isTowerRealmEligible(realm) : false,
    minRealm: TOWER_MIN_REALM,
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

  private resolveChallengeRealm(
    state: TowerState,
    cultivator: Cultivator,
  ): RealmType {
    if (state.challengeRealm && isTowerRealmEligible(state.challengeRealm)) {
      return state.challengeRealm;
    }
    if (isTowerRealmEligible(cultivator.realm)) {
      state.challengeRealm = cultivator.realm;
      return cultivator.realm;
    }

    throw new Error(`蜃楼幻境仅向${TOWER_MIN_REALM}及以上境界开放`);
  }

  private async createBattleSession(
    cultivatorId: string,
    cultivator: Cultivator,
    season: TowerSeasonMeta,
    state: TowerState,
  ) {
    const challengeRealm = this.resolveChallengeRealm(state, cultivator);
    const preparedEnemy = await towerEnemySetService.loadTowerEnemyForBattle({
      seasonKey: season.seasonKey,
      realm: challengeRealm,
      floor: state.currentFloor,
    });
    const { normalizedCondition } = buildTowerBattleInit({
      cultivator,
      condition: state.condition,
      blessings: state.blessings,
      encounterKind: preparedEnemy.encounter.kind,
    });

    const battleId = randomUUID();
    const session: TowerBattleSession = {
      battleId,
      cultivatorId,
      runId: state.runId,
      seasonKey: season.seasonKey,
      encounter: preparedEnemy.encounter,
    };

    await redis.set(
      getTowerBattleKey(battleId),
      JSON.stringify({
        session,
        enemyObject: preparedEnemy.enemy,
      } satisfies TowerBattleCachePayload),
      'EX',
      RUN_TTL_SECONDS,
    );

    return {
      session,
      enemyObject: preparedEnemy.enemy,
      normalizedCondition,
    };
  }

  private async grantMilestoneReward(args: {
    cultivatorId: string;
    cultivator: Cultivator;
    state: TowerState;
    floor: number;
    challengeRealm: RealmType;
    now: Date;
    tx?: DbTransaction;
  }): Promise<TowerMilestoneReward | undefined> {
    const commit = this.prepareMilestoneReward(args);
    if (!commit) {
      return undefined;
    }

    await this.sendMilestoneRewardMail(args.cultivatorId, commit, args.tx);
    this.applyMilestoneReward(args.state, commit.reward);
    return commit.reward;
  }

  private prepareMilestoneReward(args: {
    cultivator: Cultivator;
    state: TowerState;
    floor: number;
    challengeRealm: RealmType;
    now: Date;
  }): TowerMilestoneRewardCommit | undefined {
    if (args.state.claimedMilestones.includes(args.floor)) {
      return undefined;
    }

    const tier = resolveTowerMilestoneTier(args.floor);
    if (!tier) {
      return undefined;
    }

    const rewards = RewardFactory.generateBaseRewards(
      args.challengeRealm,
      tier,
      args.floor,
      buildRewardPlayerInfo(args.cultivator),
    );
    const reputationReward = TOWER_REPUTATION_REWARDS[tier];
    if (reputationReward > 0) {
      rewards.push({
        type: 'reputation',
        value: reputationReward,
      });
    }

    const attachments: MailAttachment[] = rewards.map((item) => {
      const name =
        item.name ??
        getResourceTypeLabel(item.type);

      return {
        type: item.type as MailAttachment['type'],
        name,
        quantity: item.value,
        ...(item.data ? { data: item.data as Material } : {}),
      };
    });

    const rewardLines = rewards.map(
      (r) =>
        `${getResourceTypeLabel(r.type)} +${r.value}`,
    );

    const mailTitle = `【蜃楼幻境】第 ${args.floor} 层 · ${tier} 级机缘`;
    const mailBody = [
      `道友在蜃楼幻境第 ${args.floor} 层达成里程碑，获得${tier}级机缘奖励：`,
      '',
      ...rewardLines,
      '',
      '所有奖励已附于此邮件，请及时领取。',
    ].join('\n');

    return {
      reward: {
        floor: args.floor,
        tier,
        realm: args.challengeRealm,
        grantedAt: args.now.toISOString(),
        rewards,
      },
      mail: {
        title: mailTitle,
        body: mailBody,
        attachments,
      },
    };
  }

  private async sendMilestoneRewardMail(
    cultivatorId: string,
    commit: TowerMilestoneRewardCommit,
    tx?: DbTransaction,
  ) {
    await MailService.sendMail(
      cultivatorId,
      commit.mail.title,
      commit.mail.body,
      commit.mail.attachments,
      'reward',
      tx,
    );
  }

  private applyMilestoneReward(
    state: TowerState,
    reward: TowerMilestoneReward,
  ) {
    state.claimedMilestones.push(reward.floor);
    state.milestoneRewardLog.push(reward);
  }

  async getState(
    cultivatorId: string,
    now: Date = new Date(),
    currentRealm?: RealmType,
  ) {
    const { season, state } = await this.loadState(cultivatorId, now);
    if (state && !state.challengeRealm && currentRealm && isTowerRealmEligible(currentRealm)) {
      state.challengeRealm = currentRealm;
      await this.saveState(cultivatorId, state);
    }

    return {
      season,
      state,
      ...buildTowerEligibility(currentRealm),
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

    const cultivatorBundle = await getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }
    if (!isTowerRealmEligible(cultivatorBundle.cultivator.realm)) {
      throw new Error(`蜃楼幻境仅向${TOWER_MIN_REALM}及以上境界开放`);
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
      challengeRealm: cultivatorBundle.cultivator.realm,
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

    const cultivatorBundle = await getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId);
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
    options: TowerBattleExecutionOptions = {},
  ) {
    const { state } = await this.loadState(cultivatorId, now);
    if (!state || state.activeBattleId !== battleId) {
      throw new Error('当前没有匹配的幻境战局');
    }

    const { key: battleKey, payload } = await this.getBattlePayload(battleId);
    if (!payload?.session || !payload.enemyObject) {
      throw new Error('幻境战局数据不存在或已失效');
    }

    const cultivatorBundle = await getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }
    const challengeRealm = this.resolveChallengeRealm(
      state,
      cultivatorBundle.cultivator,
    );
    if (cultivatorBundle.cultivator.realm !== challengeRealm) {
      throw new Error('当前境界已变化，请重开幻境以进入新的境界榜');
    }

    const { battleInit } = buildTowerBattleInit({
      cultivator: cultivatorBundle.cultivator,
      condition: state.condition,
      blessings: state.blessings,
      encounterKind: payload.session.encounter.kind,
      recoverResources: false,
    });
    const battleResult = simulateBattleV5(
      cultivatorBundle.cultivator,
      payload.enemyObject,
      withPlayerAbilityStrategySettings(
        battleInit,
        cultivatorBundle.cultivator,
      ),
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
      blessings: state.blessings,
      playerSnapshot,
      didLose: !isWin,
      now,
    });
    delete state.activeBattleId;

    let settlement: TowerSettlement | undefined;
    let milestoneReward: TowerMilestoneReward | undefined;
    let milestoneCommit: TowerMilestoneRewardCommit | undefined;
    let leaderboardUpdate:
      | {
          seasonKey: string;
          seasonEndAt: string;
          recordedRealm: RealmType;
          highestFloor: number;
          firstReachedAt: string;
        }
      | undefined;

    if (!isWin) {
      state.pendingBlessingChoices = [];
      state.status = 'FINISHED';
      settlement = buildTowerSettlement(state, 'defeat');
    } else {
      const clearedFloor = payload.session.encounter.floor;
      state.highestFloorCleared = Math.max(
        state.highestFloorCleared,
        clearedFloor,
      );

      leaderboardUpdate = {
        seasonKey: state.seasonKey,
        seasonEndAt: getTowerSeasonMeta(now).seasonEndsAt,
        recordedRealm: challengeRealm,
        highestFloor: state.highestFloorCleared,
        firstReachedAt: now.toISOString(),
      };

      if (options.deferPersistence) {
        milestoneCommit = this.prepareMilestoneReward({
          cultivator: cultivatorBundle.cultivator,
          state,
          floor: clearedFloor,
          challengeRealm,
          now,
        });
        if (milestoneCommit) {
          milestoneReward = milestoneCommit.reward;
          this.applyMilestoneReward(state, milestoneReward);
        }
      } else {
        milestoneReward = await this.grantMilestoneReward({
          cultivatorId,
          cultivator: cultivatorBundle.cultivator,
          state,
          floor: clearedFloor,
          challengeRealm,
          now,
        });
      }

      if (!options.deferPersistence && leaderboardUpdate) {
        await updateTowerWeeklyRecord({
          ...leaderboardUpdate,
          cultivatorId,
        });
      }

      if (clearedFloor >= TOWER_MAX_FLOOR) {
        state.pendingBlessingChoices = [];
        state.status = 'FINISHED';
        settlement = buildTowerSettlement(state, 'clear');
      } else {
        const externalCaps = ConditionService.getMaxResources(
          cultivatorBundle.cultivator,
        );
        const maxHp = state.condition.resources.hp.max ?? externalCaps.maxHp;
        const maxMp = state.condition.resources.mp.max ?? externalCaps.maxMp;
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
      }
    }

    if (!options.deferPersistence) {
      await this.saveState(cultivatorId, state);
      await redis.del(battleKey);
    }

    const persist = options.deferPersistence && milestoneCommit
      ? async (tx: DbTransaction) => {
          await this.sendMilestoneRewardMail(cultivatorId, milestoneCommit, tx);
        }
      : undefined;
    const afterCommit = options.deferPersistence
      ? async () => {
          await this.saveState(cultivatorId, state);
          if (leaderboardUpdate) {
            await updateTowerWeeklyRecord({
              ...leaderboardUpdate,
              cultivatorId,
            });
          }
          await redis.del(battleKey);
        }
      : undefined;

    return {
      battleResult,
      state,
      isFinished: state.status === 'FINISHED',
      settlement,
      milestoneReward,
      persist,
      afterCommit,
    };
  }

  async getLeaderboard(
    cultivatorId: string | undefined,
    realm: RealmType,
    limit: number,
    now: Date = new Date(),
  ) {
    if (!isTowerRealmEligible(realm)) {
      throw new Error(`蜃楼幻境榜仅开放${TOWER_MIN_REALM}及以上境界`);
    }

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
