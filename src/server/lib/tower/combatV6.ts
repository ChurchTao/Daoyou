import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Playback,
  combatV6Units,
  visibleUnitNames,
} from '@shared/combat-v6/presentation';
import { createCombatV6Replay } from '@shared/combat-v6/replay';
import type { CombatV6CommandGroup } from '@shared/contracts/combatV6';
import type {
  TowerReward,
  TowerSessionView,
  TowerView,
} from '@shared/contracts/combatV6Tower';
import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';
import {
  createTowerHost,
  projectTowerPlayer,
  TowerHost,
  towerResourceRatio,
  type TowerBattleSnapshot,
  type TowerResources,
} from '@shared/engine/combat-v6/tower/host';
import type { TowerBlessingId } from '@shared/lib/tower/blessings';
import {
  buildTowerBlessingChoices,
  hashTowerSeed,
  isTowerRealmEligible,
} from '@shared/lib/tower/helpers';
import { getTowerSeasonMeta } from '@shared/lib/tower/season';
import { towerReward } from '@shared/rewards/tower';
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
import { archiveCombatV6Replay } from '../repositories/combatV6ReplayRepository';
import { lockCultivatorForStateMutation } from '../repositories/playerStateRepository';
import { assembleCombatV6TrainingPlayer } from '../services/combat-v6/CombatV6BuildService';
import {
  assertInventoryIdle,
  grantInventory,
} from '../services/InventoryService';
import { ResourceEventCommitter } from '../services/ResourceEventCommitter';
import { updateTowerWeeklyRecord } from './leaderboard';
import { towerRunKey } from './occupancy';

export class TowerV6Error extends Error {}

type Actor = { userId: string; cultivatorId: string };
type Run = NonNullable<TowerView['state']> & {
  season: TowerView['season'];
  player: CombatV6TrainingPlayerInput;
  resources: TowerResources;
  battle?: {
    id: string;
    revision: number;
    startedAt: string;
    snapshot: TowerBattleSnapshot;
    settled: boolean;
  };
};
const weekKey = (owner: string, season: string) =>
  `tower:v6:week:${owner}:${season}`;
const expires = (run: Run) =>
  Math.ceil(Date.parse(run.season.seasonEndsAt) / 1000) + 86400;
async function read(owner: string) {
  const key = towerRunKey(owner);
  return parseRedisJson<Run>(await redis.get(key), key);
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
function publicView(run: Run | null, eligible = true): TowerView {
  if (!run) return { season: getTowerSeasonMeta(), eligible, state: null };
  return {
    season: run.season,
    eligible,
    state: {
      runId: run.runId,
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
      hp: run.hp,
      maxHp: run.maxHp,
      mp: run.mp,
      maxMp: run.maxMp,
    },
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
  if (run) {
    if (
      !run.battleId &&
      run.status !== 'FINISHED' &&
      Date.now() >= Date.parse(run.season.seasonEndsAt)
    ) {
      run.status = 'FINISHED';
      run.reason = 'expired';
    }
    return publicView(run, eligible);
  }
  return publicView(null, eligible);
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
function syncBars(run: Run) {
  const unit = projectTowerPlayer(run.player, run.blessings).unit;
  run.maxHp = unit.attrs!.maxHp!;
  run.maxMp = unit.attrs!.maxMp!;
  run.hp = run.resources[unit.id!]?.hp ?? run.maxHp;
  run.mp = run.resources[unit.id!]?.mp ?? run.maxMp;
}
export async function startTower(owner: string) {
  return locked(owner, async (lease) => {
    await assertInventoryIdle(owner);
    const { player } = await assembleCombatV6TrainingPlayer(owner, db);
    if (!isTowerRealmEligible(player.cultivator.realm))
      throw new TowerV6Error('蜃楼幻境仅向金丹及以上境界开放');
    const season = getTowerSeasonMeta();
    const key = weekKey(owner, season.seasonKey);
    const rewards =
      parseRedisJson<TowerReward[]>(await redis.get(key), key) ?? [];
    const run: Run = {
      runId: randomUUID(),
      revision: 0,
      realm: player.cultivator.realm,
      floor: 1,
      highestFloor: 0,
      status: 'READY',
      blessings: {},
      choices: [],
      rewards,
      hp: 0,
      maxHp: 0,
      mp: 0,
      maxMp: 0,
      season,
      player,
      resources: {},
    };
    syncBars(run);
    await save(owner, run, lease);
    return publicView(run);
  });
}
export async function advanceTower(
  owner: string,
  input: {
    runId: string;
    revision: number;
    action: 'battle' | 'blessing' | 'leave' | 'complete';
    blessingId?: TowerBlessingId;
  },
) {
  return locked(owner, async (lease) => {
    const run = await read(owner);
    if (!run || run.runId !== input.runId || run.revision !== input.revision)
      throw new TowerV6Error('挑战状态已变化，请刷新');
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
      const host = createTowerHost(
        run.player,
        run.realm,
        run.floor,
        run.blessings,
        run.resources,
        hashTowerSeed(`${run.season.seasonKey}:${run.realm}:${run.floor}:v1`),
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
    } else if (
      input.action === 'blessing' &&
      run.status === 'CHOOSING_BLESSING'
    ) {
      const choice = run.choices.find((c) => c.id === input.blessingId);
      if (!choice) throw new TowerV6Error('祝福选项无效');
      const oldHp = run.maxHp,
        oldMp = run.maxMp;
      run.blessings[choice.id] = choice.nextStacks;
      const unit = projectTowerPlayer(run.player, run.blessings).unit;
      run.resources[unit.id!] = {
        hp: towerResourceRatio(run.hp, oldHp, unit.attrs!.maxHp!),
        mp: towerResourceRatio(run.mp, oldMp, unit.attrs!.maxMp!),
      };
      syncBars(run);
      run.choices = [];
      run.floor++;
      run.status = 'READY';
    } else throw new TowerV6Error('当前阶段无法进行此操作');
    run.revision++;
    await save(owner, run, lease);
    return publicView(run);
  });
}
function battleView(run: Run, after = -1): TowerSessionView {
  const battle = run.battle!;
  const host = new TowerHost(battle.snapshot, battle.snapshot);
  return {
    apiVersion: 1,
    sessionId: battle.id,
    revision: battle.revision,
    expiresAt: new Date(expires(run) * 1000).toISOString(),
    combatVersions: host.state.versions,
    round: host.state.round,
    phase: host.state.phase,
    outcome: host.trace().outcome,
    units: combatV6Units(host.state, battle.snapshot.input.statusDefs ?? []),
    display: {
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
  return advanceTower(actor.cultivatorId, {
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
) {
  return locked(actor.cultivatorId, async (lease) => {
    const owner = actor.cultivatorId;
    const run = await read(owner);
    if (!run?.battle || run.battle.id !== id)
      throw new TowerV6Error('战斗不存在');
    const battle = run.battle;
    if (battle.revision !== revision)
      throw new TowerV6Error('战斗状态已变化，请刷新');
    const host = new TowerHost(battle.snapshot, battle.snapshot);
    if (battle.settled) return battleView(run);
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
      const key = weekKey(owner, run.season.seasonKey);
      const rewards =
        parseRedisJson<TowerReward[]>(await redis.get(key), key) ?? [];
      const reward =
        outcome === 'victory' && !rewards.some((r) => r.floor === run.floor)
          ? towerReward(
              run.floor,
              hashTowerSeed(`${run.runId}:${run.floor}`),
              run.realm,
            )
          : null;
      await db.transaction(async (tx) => {
        lease.assertHeld();
        await lockCultivatorForStateMutation(tx, owner);
        if (reward) {
          await grantInventory(owner, reward.items, tx);
          await new ResourceEventCommitter().commit(tx, {
            actor,
            source: 'tower-v6-reward',
            scopeDefaults: { cultivatorId: owner },
            changes: [
              {
                resourceTopic: 'player.currency',
                operation: 'invalidate',
                eventType: 'tower.milestone.granted',
              },
            ],
          });
          await tx
            .update(cultivators)
            .set({
              spirit_stones: sql`${cultivators.spirit_stones} + ${reward.spiritStones}`,
              reputation: sql`${cultivators.reputation} + ${reward.reputation}`,
            })
            .where(eq(cultivators.id, owner));
        }
        await archiveCombatV6Replay(
          createCombatV6Replay({
            battleId: id,
            participants: [
              { ...actor, unitId: host.playerId, side: 0, slot: 0 },
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
      });
      lease.assertHeld();
      if (reward) rewards.push(reward);
      await redis.set(key, JSON.stringify(rewards), 'EXAT', expires(run));
      run.rewards = rewards;
      for (const unit of host.state.units.filter((u) => u.side === 0))
        run.resources[unit.id] = { hp: unit.attrs.hp, mp: unit.attrs.mp };
      syncBars(run);
      battle.settled = true;
      run.revision++;
      if (outcome === 'victory') {
        run.highestFloor = run.floor;
        run.choices = buildTowerBlessingChoices({
          runId: run.runId,
          clearedFloor: run.floor,
          blessings: run.blessings,
          currentHp: run.hp,
          maxHp: run.maxHp,
          currentMp: run.mp,
          maxMp: run.maxMp,
        });
        run.status = 'CHOOSING_BLESSING';
        if (!run.choices.length) {
          run.floor++;
          run.status = 'READY';
        }
        if (run.highestFloor === 20) {
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
