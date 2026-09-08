import { db, type DbTransaction } from '@server/lib/drizzle/db';
import { cultivators, cultivatorTasks } from '@server/lib/drizzle/schema';
import { dungeonPlayer } from '@server/lib/dungeon/combatV6';
import { redis } from '@server/lib/redis';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { settleBeastDeaths } from '@server/lib/repositories/combatV6BeastRepository';
import { archiveCombatV6Replay } from '@server/lib/repositories/combatV6ReplayRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  findCultivatorTaskById,
  updateCultivatorTask,
} from '@server/lib/repositories/taskRepository';
import { automaticCommands } from '@shared/combat-v6/auto';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Units,
  visibleUnitNames,
} from '@shared/combat-v6/presentation';
import { createCombatV6Replay } from '@shared/combat-v6/replay';
import { liveReplayDelta } from '@shared/combat-v6/replay-timeline';
import type { CombatV6CommandGroup } from '@shared/contracts/combatV6';
import {
  BreakthroughBattlePointerSchema,
  type BreakthroughRuntime,
  type BreakthroughSessionView,
} from '@shared/contracts/combatV6Breakthrough';
import { beastDeathIds } from '@shared/engine/combat-v6/beasts';
import {
  BREAKTHROUGH_CHALLENGES,
  BreakthroughHost,
  createBreakthroughHost,
  type BreakthroughChallengeId,
} from '@shared/engine/combat-v6/breakthrough/host';
import { hasActiveConditionStatus } from '@shared/lib/condition';
import type { CultivatorCondition } from '@shared/types/condition';
import type { TaskInstanceMetadata } from '@shared/types/task';
import { eq } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import { ConditionService } from '../ConditionService';
import { assertInventoryIdle } from '../InventoryService';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { TaskService } from '../TaskService';

type Actor = { userId: string; cultivatorId: string };
const key = (id: string) => `combat:v6:breakthrough:${id}`;
const saveScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if cjson.decode(raw).revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

async function ownedRuntime(owner: string, taskId: string, id?: string) {
  const record = await findCultivatorTaskById(owner, taskId);
  if (!record) throw new Error('任务不存在');
  const pointer = (record.metadata as TaskInstanceMetadata).breakthroughBattle;
  if (!pointer) {
    if (id) throw new Error('战局不存在');
    return null;
  }
  const parsed = BreakthroughBattlePointerSchema.parse(pointer);
  if (id && parsed.battleId !== id)
    throw new Error('战斗已结束或已开启新的挑战');
  const raw = await redis.get(key(parsed.battleId));
  if (!raw) {
    if (parsed.settled && !id) return null;
    throw new Error('战局数据缺失，请联系维护处理');
  }
  const runtime = JSON.parse(raw) as BreakthroughRuntime;
  if (
    runtime.version !== 'breakthrough-session-v1' ||
    runtime.cultivatorId !== owner ||
    runtime.taskId !== taskId ||
    runtime.battleId !== parsed.battleId ||
    runtime.objectiveId !== parsed.objectiveId
  )
    throw new Error('无权操作此战局');
  return { runtime, settled: parsed.settled };
}
function view(
  runtime: BreakthroughRuntime,
  settled: boolean,
  after = -1,
): BreakthroughSessionView {
  const host = new BreakthroughHost(runtime.snapshot, runtime.snapshot);
  const snapshot = runtime.snapshot;
  return {
    apiVersion: 1,
    sessionId: runtime.battleId,
    taskId: runtime.taskId,
    challengeTitle: BREAKTHROUGH_CHALLENGES[runtime.challengeId].title,
    revision: runtime.revision,
    expiresAt: '9999-12-31T23:59:59.000Z',
    settlement: settled ? 'settled' : host.finished ? 'pending' : undefined,
    combatVersions: host.state.versions,
    round: host.state.round,
    phase: host.state.phase,
    outcome: host.trace().outcome,
    units: combatV6Units(host.state, snapshot.input.statusDefs ?? []),
    display: {
      ...combatV6Display(
        snapshot.input.skills ?? [],
        snapshot.input.statusDefs ?? [],
      ),
      unitNames: visibleUnitNames(host.state, snapshot.events, host.playerId),
    },
    commandOptions: host.finished ? undefined : host.queryCommands(),
    controlledCommandOptions: host.finished
      ? undefined
      : host.controlledCommandOptions(),
    pendingCommand: host.state.units.find((u) => u.id === host.playerId)
      ?.command as BreakthroughSessionView['pendingCommand'],
    events: snapshot.events.flatMap((event, seq) =>
      seq > after ? [{ seq, event: combatV6DisplayEvent(event) }] : [],
    ),
    latestEventSeq: snapshot.events.length - 1,
    playback: liveReplayDelta(snapshot.timeline, after),
  };
}

export async function getBreakthroughBattle(
  owner: string,
  taskId: string,
  id?: string,
  after = -1,
) {
  const found = await ownedRuntime(owner, taskId, id);
  return found ? view(found.runtime, found.settled, after) : null;
}
export async function startBreakthroughBattle(actor: Actor, taskId: string) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'breakthrough-start',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const existing = await ownedRuntime(actor.cultivatorId, taskId);
      if (existing && !existing.settled) return view(existing.runtime, false);
      await assertInventoryIdle(actor.cultivatorId);
      const runtime = await db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, actor.cultivatorId);
        const prepared = await TaskService.prepareTaskChallenge(
          actor.cultivatorId,
          taskId,
          { tx },
        );
        if (!(prepared.challengeId in BREAKTHROUGH_CHALLENGES))
          throw new Error('试炼配置不存在');
        const { player } = await dungeonPlayer(actor.cultivatorId, tx);
        const challengeId = prepared.challengeId as BreakthroughChallengeId;
        const host = createBreakthroughHost(
          player,
          challengeId,
          hasActiveConditionStatus(player.cultivator.condition, 'clear_mind'),
          randomInt(0, 0x7fffffff),
        );
        const runtime: BreakthroughRuntime = {
          version: 'breakthrough-session-v1',
          battleId: randomUUID(),
          ...actor,
          taskId,
          objectiveId: prepared.objectiveId,
          challengeId,
          revision: 0,
          startedAt: new Date().toISOString(),
          snapshot: host.runtimeSnapshot(),
        };
        await tx
          .update(cultivators)
          .set({ condition: player.cultivator.condition })
          .where(eq(cultivators.id, actor.cultivatorId));
        await updateCultivatorTask(
          taskId,
          actor.cultivatorId,
          {
            metadata: {
              ...(prepared.record.metadata as TaskInstanceMetadata),
              breakthroughBattle: {
                battleId: runtime.battleId,
                objectiveId: runtime.objectiveId,
                settled: false,
              },
            },
          },
          tx,
        );
        // Only the committed task pointer can occupy the player; an orphan cannot.
        await redis.set(key(runtime.battleId), JSON.stringify(runtime));
        lease.assertHeld();
        return runtime;
      });
      return view(runtime, false);
    },
  );
}
async function settle(
  actor: Actor,
  runtime: BreakthroughRuntime,
  host: BreakthroughHost,
  tx: DbTransaction,
) {
  await lockCultivatorForStateMutation(tx, actor.cultivatorId);
  const record = await findCultivatorTaskById(
    actor.cultivatorId,
    runtime.taskId,
    tx,
  );
  const pointer = BreakthroughBattlePointerSchema.parse(
    (record?.metadata as TaskInstanceMetadata | undefined)?.breakthroughBattle,
  );
  if (
    pointer.battleId !== runtime.battleId ||
    pointer.objectiveId !== runtime.objectiveId
  )
    throw new Error('任务战局不匹配');
  if (pointer.settled) return;
  const [player] = await tx
    .select({ condition: cultivators.condition })
    .from(cultivators)
    .where(eq(cultivators.id, actor.cultivatorId));
  if (!player?.condition) throw new Error('角色资源缺失');
  const final = host.state.units.find((unit) => unit.id === host.playerId)!;
  await tx
    .update(cultivators)
    .set({
      condition: ConditionService.applyCombatV6Resources(
        player.condition as CultivatorCondition,
        {
          hp: Math.max(1, final.attrs.hp),
          mp: final.attrs.mp,
          maxHp: final.attrs.maxHp,
          maxMp: final.attrs.maxMp,
        },
      ),
    })
    .where(eq(cultivators.id, actor.cultivatorId));
  await settleBeastDeaths(
    actor.cultivatorId,
    beastDeathIds(runtime.snapshot.events),
    tx,
  );
  if (host.trace().outcome === 'victory')
    await TaskService.completeTaskChallenge(
      actor.cultivatorId,
      runtime.taskId,
      runtime.objectiveId,
      tx,
    );
  await archiveCombatV6Replay(
    createCombatV6Replay({
      battleId: runtime.battleId,
      participants: [{ userId: actor.userId, cultivatorId: actor.cultivatorId,
        unitId: host.playerId, side: 0, slot: 0 }],
      metadata: {
        schemaVersion: 1,
        sourceType: 'breakthrough',
        battleType: 'pve',
        idempotencyKey: runtime.battleId,
        payload: { taskId: runtime.taskId, challengeId: runtime.challengeId },
      },
      startedAt: runtime.startedAt,
      finishedAt: new Date().toISOString(),
      reason: host.trace().outcome === 'aborted' ? 'fled' : 'battle-ended',
      trace: { ...host.trace(), seed: runtime.snapshot.input.seed! },
    }),
    tx,
  );
  await tx
    .update(cultivatorTasks)
    .set({
      metadata: {
        ...(record!.metadata as TaskInstanceMetadata),
        breakthroughBattle: { ...pointer, settled: true },
      },
      updatedAt: new Date(),
    })
    .where(eq(cultivatorTasks.id, runtime.taskId));
  await new ResourceEventCommitter().commit(tx, {
    actor,
    source: 'breakthrough-terminal',
    scopeDefaults: { cultivatorId: actor.cultivatorId },
    changes: (
      ['player.condition', 'player.tasks', 'player.task-summary'] as const
    ).map((resourceTopic) => ({
      resourceTopic,
      operation: 'invalidate' as const,
      eventType: 'tasks.challenge_resolved',
    })),
  });
}
export async function changeBreakthroughBattle(
  actor: Actor,
  taskId: string,
  id: string,
  revision: number,
  command?: { unitId: string; commands: CombatV6CommandGroup },
  autoRound?: number,
) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'breakthrough-battle',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const found = await ownedRuntime(actor.cultivatorId, taskId, id);
      if (!found) throw new Error('战局不存在');
      const { runtime } = found;
      if (found.settled) return view(runtime, true);
      if (revision !== runtime.revision)
        throw new Error('战斗状态已变化，请刷新');
      const host = new BreakthroughHost(runtime.snapshot, runtime.snapshot);
      const after = runtime.snapshot.events.length - 1;
      if (!host.finished) {
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
        lease.assertHeld();
        if (
          (await redis.eval(
            saveScript,
            1,
            key(id),
            revision,
            JSON.stringify(runtime),
          )) !== 1
        )
          throw new Error('战斗状态已变化，请刷新');
      }
      if (host.finished) {
        await db.transaction(async (tx) => {
          await settle(actor, runtime, host, tx);
          lease.assertHeld();
        });
        await redis.expire(key(id), 86400);
      }
      return view(runtime, host.finished, after);
    },
  );
}
