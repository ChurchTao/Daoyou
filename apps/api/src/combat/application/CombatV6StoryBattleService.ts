import { settlePersistentBattle } from './CombatV6PersistentCondition.js';
import { storyBattleKey } from './CombatV6StoryOccupancy.js';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository.js';
import type { CombatV6CommandGroup } from '@daoyou/game-domain/combat';
import type {
  StoryBattleRuntime,
  StoryBattleSessionView,
} from '@daoyou/contracts/combat/story-battle';
import {
  getStoryBattle,
  MINE_BAISHUI_ROGUE_BATTLE,
  MINE_SPARRING_BATTLE,
} from '@daoyou/game-content/story/battles';
import { publicUnitAppearances } from '@daoyou/game-rules/combat/appearance';
import { automaticCommands } from '@daoyou/game-rules/combat/auto';
import { liveReplayDelta } from '@daoyou/game-rules/combat/playback';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Units,
  visibleUnitNames,
} from '@daoyou/game-rules/combat/presentation';
import {
  createStoryBattleHost,
  mineSparringEffects,
  StoryBattleHost,
  storyBattleOutcome,
  storyBattleResourceLoss,
} from '@daoyou/game-rules/story';
import { dungeonPlayer } from '@server/dungeon/combat-player.js';
import { assertInventoryIdle } from '@server/inventory/operations.js';
import { db } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { redis } from '@server/lib/redis/index.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { StoryService } from '@server/story/application/StoryService.js';
import { randomInt, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

/**
 * 剧情战：对手和胜负规则由主线指定。
 * 每个角色同一时间只有一场，存在 Redis 里。
 */
type Actor = { userId: string; cultivatorId: string };

const saveScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if cjson.decode(raw).revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

async function readRuntime(cultivatorId: string) {
  const raw = await redis.get(storyBattleKey(cultivatorId));
  if (!raw) return null;
  const runtime = JSON.parse(raw) as StoryBattleRuntime;
  if (
    runtime.version !== 'story-session-v1' ||
    runtime.cultivatorId !== cultivatorId
  )
    return null;
  return runtime;
}

function view(runtime: StoryBattleRuntime, after = -1): StoryBattleSessionView {
  const host = new StoryBattleHost(runtime.snapshot, runtime.snapshot);
  const snapshot = runtime.snapshot;
  const battle = getStoryBattle(runtime.battleId);
  const over = Boolean(runtime.result);
  const names = visibleUnitNames(host.state, snapshot.events, host.playerId);
  return {
    apiVersion: 1,
    controlledUnitId: host.playerId,
    sessionId: runtime.sessionId,
    battleId: runtime.battleId,
    title: battle.title,
    revision: runtime.revision,
    expiresAt: '9999-12-31T23:59:59.000Z',
    settlement: runtime.settled ? 'settled' : over ? 'pending' : undefined,
    result: runtime.result,
    retry: runtime.result === 'lost' && battle.defeat === 'retry',
    combatVersions: host.state.versions,
    round: host.state.round,
    phase: host.state.phase,
    // 有人出手收场时战局本身没分胜负，界面上按平局收。
    outcome: runtime.result === 'rescued' ? 'draw' : host.trace().outcome,
    units: combatV6Units(host.state, snapshot.input.statusDefs ?? []),
    display: {
      unitAppearances: publicUnitAppearances(
        snapshot.timeline.unitAppearances,
        names,
      ),
      ...combatV6Display(
        snapshot.input.skills ?? [],
        snapshot.input.statusDefs ?? [],
      ),
      unitNames: names,
    },
    commandOptions: over ? undefined : host.queryCommands(),
    controlledCommandOptions: over
      ? undefined
      : host.controlledCommandOptions(),
    pendingCommand: host.state.units.find((u) => u.id === host.playerId)
      ?.command as StoryBattleSessionView['pendingCommand'],
    events: snapshot.events.flatMap((event, seq) =>
      seq > after ? [{ seq, event: combatV6DisplayEvent(event) }] : [],
    ),
    latestEventSeq: snapshot.events.length - 1,
    playback: liveReplayDelta(snapshot.timeline, after),
  };
}

/** 主线眼下等着的那一场。打完并记下的旧战局不算。 */
export async function getStoryBattleSession(
  cultivatorId: string,
  id?: string,
  after = -1,
) {
  const runtime = await readRuntime(cultivatorId);
  if (!runtime) {
    if (id) throw new Error('战局不存在');
    return null;
  }
  if (id && runtime.sessionId !== id)
    throw new Error('战斗已结束或已开启新的一场');
  return view(runtime, after);
}

export async function startStoryBattle(actor: Actor) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'story-battle-start',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const runtime = await db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, actor.cultivatorId);
        const story = await StoryService.read(actor.cultivatorId, tx);
        if (!story.battleId) throw new Error('主线眼下没有要打的一场');
        const existing = await readRuntime(actor.cultivatorId);
        if (
          existing &&
          existing.battleId === story.battleId &&
          !existing.settled
        )
          return existing;
        await assertInventoryIdle(actor.cultivatorId, tx);
        const { player } = await dungeonPlayer(actor.cultivatorId, tx);
        await tx.update(cultivators).set({ condition: player.cultivator.condition })
          .where(eq(cultivators.id, actor.cultivatorId));
        const host = createStoryBattleHost(
          player,
          getStoryBattle(story.battleId),
          randomInt(0, 0x7fffffff),
        );
        const created: StoryBattleRuntime = {
          version: 'story-session-v1',
          sessionId: randomUUID(),
          userId: actor.userId,
          cultivatorId: actor.cultivatorId,
          battleId: story.battleId,
          revision: 0,
          startedAt: new Date().toISOString(),
          snapshot: host.runtimeSnapshot(),
          settled: false,
        };
        await redis.set(storyBattleKey(actor.cultivatorId), JSON.stringify(created));
        lease.assertHeld();
        return created;
      });
      return view(runtime);
    },
  );
}

async function settle(actor: Actor, runtime: StoryBattleRuntime) {
  const battle = getStoryBattle(runtime.battleId);
  const state = await db.transaction(async (tx) => {
    await lockCultivatorForStateMutation(tx, actor.cultivatorId);
    if (!(await claimMessageForConsumer({
      consumerName: 'story-battle-condition-v1', messageId: runtime.sessionId, messageKey: 'story.battle.finished',
    }, tx))) return { changes: [] };
    await settlePersistentBattle(tx, actor.cultivatorId, runtime.snapshot.state,
      runtime.snapshot.events, runtime.snapshot.playerId);
    const effects = runtime.battleId === MINE_SPARRING_BATTLE
      ? [...mineSparringEffects(runtime.snapshot)]
      : [];
    if (runtime.battleId === MINE_BAISHUI_ROGUE_BATTLE && runtime.result === 'won' &&
        storyBattleResourceLoss(runtime.snapshot).hp > 0) effects.push('baishui.battle-hurt');
    const story = runtime.result === 'lost' && battle.defeat === 'retry' ? null
      : await StoryService.completeBattle(actor.cultivatorId, runtime.battleId, runtime.result!, tx, effects);
    return new ResourceEventCommitter().commit(tx, {
      actor, source: 'story-battle', scopeDefaults: { cultivatorId: actor.cultivatorId },
      changes: [...(story?.changes ?? []), {
        resourceTopic: 'player.condition', operation: 'invalidate', eventType: 'combat_v6.condition.settled',
      }],
    });
  });
  publishResourceEvents(state.changes);
  runtime.settled = true;
  await redis.set(storyBattleKey(actor.cultivatorId), JSON.stringify(runtime), 'EX', 86400);
}

export async function changeStoryBattle(
  actor: Actor,
  id: string,
  revision: number,
  command?: { unitId: string; commands: CombatV6CommandGroup },
  autoRound?: number,
) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'story-battle',
      timeoutMs: 30000,
      // 首次点击攻击也会提交教程完成，等同一角色的短事务释放锁。
      retries: 4,
    },
    async (lease) => {
      const runtime = await readRuntime(actor.cultivatorId);
      if (!runtime || runtime.sessionId !== id) throw new Error('战局不存在');
      if (runtime.settled) return view(runtime);
      const after = runtime.snapshot.events.length - 1;
      if (!runtime.result) {
        if (revision !== runtime.revision)
          throw new Error('战斗状态已变化，请刷新');
        const host = new StoryBattleHost(runtime.snapshot, runtime.snapshot);
        if (autoRound !== undefined) {
          if (host.state.round !== autoRound)
            throw new Error('战斗回合已变化，请刷新');
          const commands = automaticCommands(
            host.state,
            host.playerId,
            runtime.snapshot.input.skills ?? [],
            (unitId) =>
              host
                .controlledCommandOptions()
                .find((option) => option.unitId === unitId)!,
            {
              statusDefs: runtime.snapshot.input.statusDefs,
              strategies: { [host.playerId]: host.playerAutoStrategy },
            },
          );
          if (commands.length) host.submitGroup(commands);
        }
        if (command) {
          if (command.unitId !== host.playerId)
            throw new Error('无权提交此人物指令');
          host.submitGroup(command.commands);
        } else host.resolveRound();
        runtime.snapshot = host.runtimeSnapshot();
        runtime.revision++;
        runtime.result =
          storyBattleOutcome(getStoryBattle(runtime.battleId), {
            finished: host.finished,
            outcome: host.trace().outcome,
            round: host.state.round,
          }) ?? undefined;
        lease.assertHeld();
        if (
          (await redis.eval(
            saveScript,
            1,
            storyBattleKey(actor.cultivatorId),
            revision,
            JSON.stringify(runtime),
          )) !== 1
        )
          throw new Error('战斗状态已变化，请刷新');
      }
      if (runtime.result) {
        await settle(actor, runtime);
        lease.assertHeld();
      }
      return view(runtime, after);
    },
  );
}
