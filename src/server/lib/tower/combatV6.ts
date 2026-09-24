import { automaticCommands } from '@shared/combat-v6/auto';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Playback,
  combatV6Units,
  visibleUnitNames,
} from '@shared/combat-v6/presentation';
import { createCombatV6Replay } from '@shared/combat-v6/replay';
import { liveReplayDelta } from '@shared/combat-v6/replay-timeline';
import { publicUnitAppearances } from '@shared/combat-v6/unit-appearance';
import type { CombatV6CommandGroup } from '@shared/contracts/combatV6';
import type {
  TowerReward,
  TowerSessionView,
  TowerView,
} from '@shared/contracts/combatV6Tower';
import type { ResourceChange } from '@shared/contracts/resources';
import { canDeployBeast } from '@shared/engine/combat-v6/beasts';
import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import {
  createTowerHost,
  TowerHost,
  type TowerBattleSnapshot,
} from '@shared/engine/combat-v6/tower/host';
import { publishedTowerPreviews } from '@shared/engine/combat-v6/tower/published';
import type { TowerBlessingId } from '@shared/lib/tower/blessings';
import {
  buildTowerBlessingChoices,
  hashTowerSeed,
  isTowerRealmEligible,
  TOWER_MAX_FLOOR,
  TOWER_MIN_REALM,
} from '@shared/lib/tower/helpers';
import { shouldExpireTowerRun } from '@shared/lib/tower/lifecycle';
import {
  advanceTowerRewardWeek,
  towerRewards,
  TowerRewardSchema,
} from '@shared/lib/tower/reward-state';
import { getTowerSeasonMeta } from '@shared/lib/tower/season';
import { planTowerReward, towerRewardPreviews } from '@shared/rewards/tower';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../drizzle/db';
import { cultivators } from '../drizzle/schema';
import { redis } from '../redis';
import { parseRedisJson } from '../redis/json';
import {
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '../redis/lock';
import {
  archiveCombatV6Replay,
  combatV6ReplayExists,
} from '../repositories/combatV6ReplayRepository';
import { claimMessageForConsumer } from '../repositories/messageConsumptionRepository';
import { lockCultivatorForStateMutation } from '../repositories/playerStateRepository';
import {
  getOrPublishTowerWeek,
  readTowerPublishedWeek,
  readTowerRewardState,
  writeTowerRewardState,
} from '../repositories/towerRepository';
import { assembleCombatV6TrainingPlayer } from '../services/combat-v6/CombatV6BuildService';
import { ConditionService } from '../services/ConditionService';
import {
  assertInventoryIdle,
  grantInventory,
} from '../services/InventoryService';
import { publishResourceEvents } from '../services/playerStateBroadcaster';
import { ResourceEventCommitter } from '../services/ResourceEventCommitter';
import { updateTowerWeeklyRecord } from './leaderboard';
import { towerRunKey } from './occupancy';

export class TowerV6Error extends Error {}

type Actor = { userId: string; cultivatorId: string };
type Run = NonNullable<TowerView['state']> & {
  season: TowerView['season'];
  hasBeasts?: boolean;
  battle?: {
    id: string;
    revision: number;
    startedAt: string;
    snapshot: TowerBattleSnapshot;
    settled: boolean;
    admitted?: boolean;
    reward?: TowerReward;
  };
};
const expires = (run: Run) =>
  Math.ceil(Date.parse(run.season.seasonEndsAt) / 1000) + 86400;
async function read(owner: string) {
  const key = towerRunKey(owner);
  const run = parseRedisJson<Run>(await redis.get(key), key);
  // Expiry is a read projection, shared with occupancy checks. No unlocked Redis write.
  // Unfinished old battles are discarded; terminal pending results still settle normally.
  if (run && shouldExpireTowerRun(run, Date.now())) {
    delete run.battle;
    delete run.battleId;
    run.choices = [];
    if (run.status !== 'FINISHED') {
      run.status = 'FINISHED';
      run.reason = 'expired';
    }
  }
  return run;
}
async function save(owner: string, run: Run, lease: RedisLeaseContext) {
  lease.assertHeld();
  await redis.set(
    towerRunKey(owner),
    JSON.stringify(run),
    'EXAT',
    expires(run),
  );
}
async function publicView(
  owner: string,
  run: Run | null,
  eligible = true,
  rewardRealm: RealmType = run?.realm ?? TOWER_MIN_REALM,
): Promise<TowerView> {
  const published = await currentWeek();
  const receipt = await readTowerRewardState(owner);
  const runPack =
    run?.season.seasonKey === published.season.seasonKey
      ? published
      : run
        ? await readTowerPublishedWeek(run.season.seasonKey)
        : null;
  return {
    season: published.season,
    rewardRealm,
    rewardPreviews: towerRewardPreviews(rewardRealm),
    eligible,
    rewards: towerRewards(receipt, published.season.seasonKey),
    weeklyEnemies: publishedTowerPreviews(published).filter(
      (p) => p.kind !== 'normal',
    ),
    state: run
      ? {
          runId: run.runId,
          season: run.season,
          revision: run.revision,
          realm: run.realm,
          floor: run.floor,
          highestFloor: run.highestFloor,
          status: run.status,
          reason: run.reason,
          blessings: run.blessings,
          choices: run.choices,
          rewards: run.rewards,
          battleId: run.battleId,
          enemy: runPack
            ? publishedTowerPreviews(runPack)[run.floor - 1]
            : undefined,
        }
      : null,
  };
}
export async function getTowerView(owner: string) {
  const [run, [row]] = await Promise.all([
    read(owner),
    db
      .select({ realm: cultivators.realm })
      .from(cultivators)
      .where(eq(cultivators.id, owner)),
  ]);
  const eligible = !!row && isTowerRealmEligible(row.realm as RealmType);
  return publicView(
    owner,
    run,
    eligible,
    run &&
      run.status !== 'FINISHED' &&
      run.season.seasonKey === getTowerSeasonMeta().seasonKey
      ? run.realm
      : eligible
        ? (row.realm as RealmType)
        : TOWER_MIN_REALM,
  );
}
function locked<T>(
  owner: string,
  action: (lease: RedisLeaseContext) => Promise<T>,
) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'tower-v6',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const value = await action(lease);
      lease.assertHeld();
      return value;
    },
  );
}
async function currentWeek(season = getTowerSeasonMeta()) {
  return getOrPublishTowerWeek(season);
}
function hasBeasts(player: CombatV6TrainingPlayerInput) {
  const level = combatCharacterLevel(
    player.cultivator.realm,
    player.cultivator.realm_stage,
  );
  return !!player.beasts?.lineup.carriedBeastIds.some((id) =>
    player.beasts?.beasts.some(
      (b) =>
        b.id === id &&
        b.ownerCultivatorId === player.cultivator.id &&
        canDeployBeast(b, level),
    ),
  );
}
async function admitBattle(actor: Actor, run: Run, lease: RedisLeaseContext) {
  const battle = run.battle!;
  if (battle.admitted) return;
  const unit = battle.snapshot.input.units.find(
    (u) => u.id === battle.snapshot.playerId,
  )!;
  const attrs = unit.attrs;
  const changes = await db.transaction(async (tx) => {
    await lockCultivatorForStateMutation(tx, actor.cultivatorId);
    const claimed = await claimMessageForConsumer(
      {
        consumerName: 'tower-v2-entry',
        messageId: battle.id,
        messageKey: 'tower.entry',
      },
      tx,
    );
    if (!claimed) return [];
    const [row] = await tx
      .select({ condition: cultivators.condition })
      .from(cultivators)
      .where(eq(cultivators.id, actor.cultivatorId));
    if (!row?.condition) throw new TowerV6Error('角色状态尚未初始化');
    const condition = ConditionService.applyCombatV6Resources(
      row.condition as CultivatorCondition,
      {
        hp: attrs.maxHp!,
        mp: attrs.maxMp!,
        maxHp: attrs.maxHp!,
        maxMp: attrs.maxMp!,
      },
    );
    await tx
      .update(cultivators)
      .set({ condition })
      .where(eq(cultivators.id, actor.cultivatorId));
    const committed = await new ResourceEventCommitter().commit(tx, {
      actor,
      source: 'tower-v6-entry',
      scopeDefaults: { cultivatorId: actor.cultivatorId },
      changes: [
        {
          resourceTopic: 'player.condition',
          operation: 'invalidate',
          eventType: 'tower.condition.restored',
        },
      ],
    });
    lease.assertHeld();
    return committed.changes;
  });
  publishResourceEvents(changes);
  battle.admitted = true;
  await save(actor.cultivatorId, run, lease);
}
export async function startTower(owner: string) {
  return locked(owner, async (lease) => {
    await assertInventoryIdle(owner, undefined, db, 'run');
    const { player } = await assembleCombatV6TrainingPlayer(owner, db);
    if (!isTowerRealmEligible(player.cultivator.realm))
      throw new TowerV6Error(`蜃楼幻境仅向${TOWER_MIN_REALM}及以上境界开放`);
    const season = getTowerSeasonMeta();
    await currentWeek(season);
    const receipt = await db.transaction(async (tx) => {
      await lockCultivatorForStateMutation(tx, owner);
      const current = await readTowerRewardState(owner, tx);
      const next = advanceTowerRewardWeek(current, season.seasonKey);
      await writeTowerRewardState(owner, next, tx);
      return next;
    });
    const rewards = towerRewards(receipt, season.seasonKey);
    const run: Run = {
      runId: randomUUID(),
      revision: 0,
      realm: player.cultivator.realm,
      floor: 1,
      highestFloor: 0,
      status: 'CHOOSING_BLESSING',
      blessings: {},
      choices: [],
      rewards,
      season,

      hasBeasts: hasBeasts(player),
    };
    run.choices = buildTowerBlessingChoices({
      runId: run.runId,
      clearedFloor: 0,
      blessings: {},
      hasBeasts: run.hasBeasts!,
    });
    await save(owner, run, lease);
    return publicView(owner, run);
  });
}
export async function advanceTower(
  actor: Actor,
  input: {
    runId: string;
    revision: number;
    action: 'battle' | 'blessing' | 'leave' | 'complete';
    blessingId?: TowerBlessingId;
  },
) {
  const owner = actor.cultivatorId;
  return locked(owner, async (lease) => {
    const run = await read(owner);
    if (!run || run.runId !== input.runId || run.revision !== input.revision)
      throw new TowerV6Error('挑战状态已变化，请刷新');
    if (run.battleId && input.action !== 'complete')
      throw new TowerV6Error('请先结束当前战斗与结算');
    const expired = Date.now() >= Date.parse(run.season.seasonEndsAt);
    if (input.action === 'complete' && run.battle?.settled) {
      delete run.battle;
      delete run.battleId;
      if (expired && run.status !== 'FINISHED') {
        run.status = 'FINISHED';
        run.reason = 'expired';
      }
    } else if (expired && run.status !== 'WAITING_BATTLE') {
      run.status = 'FINISHED';
      run.reason = 'expired';
    } else if (
      input.action === 'leave' &&
      (run.status === 'READY' || run.status === 'CHOOSING_BLESSING')
    ) {
      run.status = 'FINISHED';
      run.reason = 'retreated';
    } else if (input.action === 'battle' && run.status === 'READY') {
      await assertInventoryIdle(owner);
      const { player } = await db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, owner);
        return assembleCombatV6TrainingPlayer(owner, tx);
      });
      if (player.cultivator.realm !== run.realm) {
        run.status = 'FINISHED';
        run.reason = 'realm_changed';
        run.revision++;
        await save(owner, run, lease);
        return publicView(owner, run);
      }
      run.hasBeasts = hasBeasts(player);
      const published = await readTowerPublishedWeek(run.season.seasonKey);
      if (!published) throw new TowerV6Error('幻境发布配置缺失');
      const host = createTowerHost(
        player,
        run.realm,
        run.floor,
        run.blessings,
        undefined,
        hashTowerSeed(`${run.runId}:${run.floor}:battle`),
        published,
      );
      const id = randomUUID();
      run.battleId = id;
      run.battle = {
        id,
        revision: 0,
        startedAt: new Date().toISOString(),
        snapshot: host.runtimeSnapshot(),
        settled: false,
      };
      run.status = 'WAITING_BATTLE';
      // Persist identity and full entry snapshot before recovery. Retrying admission cannot refill an ongoing fight.
      run.revision++;
      await save(owner, run, lease);
      await admitBattle(actor, run, lease);
      return publicView(owner, run);
    } else if (
      input.action === 'blessing' &&
      run.status === 'CHOOSING_BLESSING'
    ) {
      const choice = run.choices.find((c) => c.id === input.blessingId);
      if (!choice) throw new TowerV6Error('祝福选项无效');
      run.blessings[choice.id] = choice.nextStacks;
      run.choices = [];
      run.status = 'READY';
    } else throw new TowerV6Error('当前阶段无法进行此操作');
    run.revision++;
    await save(owner, run, lease);
    return publicView(owner, run);
  });
}
function battleView(run: Run, after = -1): TowerSessionView {
  const battle = run.battle!;
  const host = new TowerHost(battle.snapshot, battle.snapshot);
  return {
    apiVersion: 1,
    controlledUnitId: host.playerId,
    settlement: host.finished
      ? battle.settled
        ? 'settled'
        : 'pending'
      : 'not-started',
    playback: liveReplayDelta(battle.snapshot.timeline, after),
    sessionId: battle.id,
    revision: battle.revision,
    expiresAt: new Date(expires(run) * 1000).toISOString(),
    combatVersions: host.state.versions,
    round: host.state.round,
    phase: host.state.phase,
    outcome: host.trace().outcome,
    units: combatV6Units(host.state, battle.snapshot.input.statusDefs ?? []),
    display: {
      unitAppearances: publicUnitAppearances(
        battle.snapshot.timeline.unitAppearances,
        visibleUnitNames(host.state, battle.snapshot.events, host.playerId),
      ),
      ...combatV6Display(
        battle.snapshot.input.skills ?? [],
        battle.snapshot.input.statusDefs ?? [],
      ),
      unitNames: visibleUnitNames(
        host.state,
        battle.snapshot.events,
        host.playerId,
      ),
    },
    commandOptions: host.finished ? undefined : host.queryCommands(),
    controlledCommandOptions: host.finished
      ? undefined
      : host.controlledCommandOptions(),
    pendingCommand: host.state.units.find((u) => u.id === host.playerId)
      ?.command as TowerSessionView['pendingCommand'],
    events: battle.snapshot.events.flatMap((event, seq) =>
      seq > after ? [{ seq, event: combatV6DisplayEvent(event) }] : [],
    ),
    latestEventSeq: battle.snapshot.events.length - 1,
  };
}
export async function getTowerBattle(owner: string, id?: string, after = -1) {
  const run = await read(owner);
  return run?.battle && (!id || run.battle.id === id)
    ? battleView(run, after)
    : null;
}
export async function completeTower(
  actor: Actor,
  input: { runId: string; revision: number },
) {
  const run = await read(actor.cultivatorId);
  if (!run || run.runId !== input.runId || run.revision !== input.revision)
    throw new TowerV6Error('挑战状态已变化，请刷新');
  if (run.battle && !run.battle.settled) {
    if (!new TowerHost(run.battle.snapshot, run.battle.snapshot).finished)
      throw new TowerV6Error('战斗尚未结束');
    await changeTowerBattle(actor, run.battle.id, run.battle.revision);
  }
  const latest = await read(actor.cultivatorId);
  if (!latest || latest.runId !== input.runId)
    throw new TowerV6Error('挑战已失效');
  return advanceTower(actor, {
    ...input,
    revision: latest.revision,
    action: 'complete',
  });
}
export async function changeTowerBattle(
  actor: Actor,
  id: string,
  revision: number,
  command?: { unitId: string; commands: CombatV6CommandGroup },
  autoRound?: number,
) {
  return locked(actor.cultivatorId, async (lease) => {
    const owner = actor.cultivatorId;
    const run = await read(owner);
    if (!run?.battle || run.battle.id !== id)
      throw new TowerV6Error('战斗不存在');
    await admitBattle(actor, run, lease);
    const battle = run.battle;
    if (battle.revision !== revision)
      throw new TowerV6Error('战斗状态已变化，请刷新');
    const host = new TowerHost(battle.snapshot, battle.snapshot);
    if (battle.settled) return battleView(run);
    if (autoRound !== undefined && !host.finished) {
      if (host.state.round !== autoRound)
        throw new TowerV6Error('战斗回合已变化，请刷新');
      const commands = automaticCommands(
        host.state,
        host.playerId,
        battle.snapshot.input.skills ?? [],
        (id) => host.controlledCommandOptions().find((o) => o.unitId === id)!,
        { statusDefs: battle.snapshot.input.statusDefs },
      );
      if (commands.length) host.submitGroup(commands);
    }
    const after = battle.snapshot.events.length - 1;
    const playback = combatV6Playback(
      after,
      battle.snapshot.input.statusDefs ?? [],
      host.state,
    );
    if (!host.finished) {
      if (command) {
        if (command.unitId !== host.playerId)
          throw new TowerV6Error('无权提交此人物指令');
        host.submitGroup(command.commands);
      } else host.resolveRound(playback.capture);
      battle.snapshot = host.runtimeSnapshot();
      battle.revision++;
      if (!command)
        playback.capture(host.state, battle.snapshot.events.length - 1);
    }
    // Persist the terminal snapshot before the cross-store reward step so retries keep the same outcome.
    await save(owner, run, lease);
    if (host.finished) {
      const outcome = host.trace().outcome;
      let receipt = await readTowerRewardState(owner);
      if (!receipt || receipt.seasonKey !== run.season.seasonKey)
        throw new TowerV6Error('领奖记录与挑战周次不一致');
      const rewards = towerRewards(receipt, run.season.seasonKey);
      let reward: TowerReward | null = null;
      if (
        outcome === 'victory' &&
        !rewards.some((r) => r.floor === run.floor)
      ) {
        reward = battle.reward ?? null;
        if (!reward) {
          reward = planTowerReward(
            run.floor,
            hashTowerSeed(`${run.runId}:${run.floor}`),
            run.realm,
          );
          // Freeze the exact drops before settlement; retries must not resample.
          battle.reward = reward;
          await save(owner, run, lease);
        }
      }
      const changes = await db.transaction(async (tx) => {
        const changes: ResourceChange[] = [];
        lease.assertHeld();
        await lockCultivatorForStateMutation(tx, owner);
        // The archive commits with rewards. A failed Redis acknowledgement must
        // rebuild the run from this terminal snapshot without granting again.
        if (await combatV6ReplayExists(id, tx)) return changes;
        {
          const unit = host.state.units.find((u) => u.id === host.playerId)!;
          const [row] = await tx
            .select({ condition: cultivators.condition })
            .from(cultivators)
            .where(eq(cultivators.id, owner));
          if (!row?.condition) throw new TowerV6Error('角色状态尚未初始化');
          const condition = ConditionService.applyCombatV6Resources(
            row.condition as CultivatorCondition,
            unit.attrs,
          );
          await tx
            .update(cultivators)
            .set({ condition })
            .where(eq(cultivators.id, owner));
          const committed = await new ResourceEventCommitter().commit(tx, {
            actor,
            source: 'tower-v6-condition',
            scopeDefaults: { cultivatorId: owner },
            changes: [
              {
                resourceTopic: 'player.condition',
                operation: 'invalidate',
                eventType: 'tower.condition.settled',
              },
            ],
          });
          changes.push(...committed.changes);
        }
        receipt = await readTowerRewardState(owner, tx);
        if (!receipt || receipt.seasonKey !== run.season.seasonKey)
          throw new TowerV6Error('领奖记录与挑战周次不一致');
        if (
          reward &&
          towerRewards(receipt, run.season.seasonKey).some(
            (r) => r.floor === run.floor,
          )
        )
          reward = null;
        if (reward) {
          await grantInventory(owner, reward.items, tx);
          const committed = await new ResourceEventCommitter().commit(tx, {
            actor,
            source: 'tower-v6-reward',
            scopeDefaults: { cultivatorId: owner },
            changes: [
              {
                resourceTopic: 'inventory.bag',
                operation: 'invalidate',
                eventType: 'inventory.tower.rewarded',
              },
              {
                resourceTopic: 'player.currency',
                operation: 'invalidate',
                eventType: 'tower.milestone.granted',
              },
            ],
          });
          changes.push(...committed.changes);
          await tx
            .update(cultivators)
            .set({
              spirit_stones: sql`${cultivators.spirit_stones} + ${reward.spiritStones}`,
              reputation: sql`${cultivators.reputation} + ${reward.reputation}`,
            })
            .where(eq(cultivators.id, owner));
        }
        if (reward) {
          const parsedReward = TowerRewardSchema.parse(reward);
          receipt.claims[
            String(parsedReward.floor) as keyof typeof receipt.claims
          ] = {
            battleId: id,
            claimedAt: new Date().toISOString(),
            reward: parsedReward,
          };
          await writeTowerRewardState(owner, receipt, tx);
        }
        await archiveCombatV6Replay(
          createCombatV6Replay({
            battleId: id,
            participants: [
              {
                userId: actor.userId,
                cultivatorId: actor.cultivatorId,
                unitId: host.playerId,
                side: 0,
                slot: 0,
              },
            ],
            metadata: {
              schemaVersion: 1,
              sourceType: 'tower',
              battleType: 'pve',
              idempotencyKey: id,
              payload: { runId: run.runId, floor: run.floor },
            },
            startedAt: battle.startedAt,
            finishedAt: new Date().toISOString(),
            reason: outcome === 'aborted' ? 'fled' : 'battle-ended',
            trace: { ...host.trace(), seed: battle.snapshot.input.seed! },
          }),
          tx,
        );
        lease.assertHeld();
        return changes;
      });
      publishResourceEvents(changes);
      lease.assertHeld();
      receipt = await readTowerRewardState(owner);
      run.rewards = towerRewards(receipt, run.season.seasonKey);
      battle.settled = true;
      run.revision++;
      if (outcome === 'victory') {
        run.highestFloor = run.floor;
        run.choices = buildTowerBlessingChoices({
          runId: run.runId,
          clearedFloor: run.floor,
          blessings: run.blessings,
          hasBeasts: run.hasBeasts ?? false,
        });
        run.floor = Math.min(TOWER_MAX_FLOOR, run.floor + 1);
        run.status = run.choices.length ? 'CHOOSING_BLESSING' : 'READY';
        if (run.highestFloor === TOWER_MAX_FLOOR) {
          run.status = 'FINISHED';
          run.reason = 'clear';
        } else if (Date.now() >= Date.parse(run.season.seasonEndsAt)) {
          run.status = 'FINISHED';
          run.reason = 'expired';
        }
      } else {
        run.status = 'FINISHED';
        run.reason =
          outcome === 'aborted'
            ? 'fled'
            : outcome === 'defeat'
              ? 'defeat'
              : 'draw';
      }
      await save(owner, run, lease);
      if (outcome === 'victory') {
        try {
          await updateTowerWeeklyRecord({
            seasonKey: run.season.seasonKey,
            seasonEndAt: run.season.seasonEndsAt,
            cultivatorId: owner,
            recordedRealm: run.realm,
            highestFloor: run.highestFloor,
            firstReachedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error('tower leaderboard update failed', error);
        }
      }
    }
    return {
      ...battleView(run, after),
      ...(!command ? { playback: playback.playback } : {}),
    };
  });
}
