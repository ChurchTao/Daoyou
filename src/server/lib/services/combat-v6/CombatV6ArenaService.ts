import { hasActiveSectTaskBattle } from './CombatV6SectTaskOccupancy';
import { db } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { hasActiveDungeon } from '@server/lib/dungeon/occupancy';
import { getJetStreamClient } from '@server/lib/nats';
import { redis } from '@server/lib/redis';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { hasActiveRanking } from '@server/lib/redis/rankingChallenge';
import {
  archiveCombatV6Replay,
  findOwnedCombatV6Replay,
} from '@server/lib/repositories/combatV6ReplayRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import { hasActiveTower } from '@server/lib/tower/occupancy';
import {
  arenaBattle,
  arenaDefaultCommand,
  arenaWaitingUnits,
  resolveArena,
  validateArenaCommand,
} from '@shared/combat-v6/arena';
import { automaticCommands } from '@shared/combat-v6/auto';
import { validateCommandGroup } from '@shared/combat-v6/controlled-commands';
import {
  combatV6ReplayView,
  createCombatV6Replay,
} from '@shared/combat-v6/replay';
import { startReplayTimeline } from '@shared/combat-v6/replay-timeline';
import type { ArenaRoomV1 } from '@shared/contracts/arena';
import {
  ARENA_PUBLIC_VIEW,
  ARENA_V6_PROTOCOL,
  type ArenaRuntime,
  type ArenaV6Submit,
} from '@shared/contracts/combatV6Arena';
import {
  DOMAIN_EVENT_DEFINITIONS,
  DOMAIN_EVENT_STREAM,
  parseDomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import {
  BEAST_SKILLS,
  projectBeastRoster,
} from '@shared/engine/combat-v6/beasts';
import type { SkillDef, StatusDef } from '@shared/engine/combat-v6/core';
import { projectCultivatorMultiSectV5ToCombatV6 } from '@shared/engine/combat-v6/projection';
import { and, eq } from 'drizzle-orm';
import { JSONCodec } from 'nats';
import { ArenaRoomService } from '../ArenaRoomService';
import { publishArenaRoomChanges } from '../arenaRoomBroadcaster';
import { broadcastArenaV6 } from './CombatV6ArenaBroadcast';
import { arenaDueKey, CombatV6ArenaStore } from './CombatV6ArenaStore';
import { assembleCombatV6TrainingPlayer } from './CombatV6BuildService';

export class ArenaV6Error extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 409,
  ) {
    super(message);
  }
}
const store = new CombatV6ArenaStore();
const rooms = new ArenaRoomService();
type Actor = { userId: string; cultivatorId: string };

function mergeDefinitions<T extends SkillDef | StatusDef>(
  target: Map<string, T>,
  values: T[],
) {
  for (const value of values) {
    const previous = target.get(value.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(value))
      throw new ArenaV6Error(`战斗定义冲突：${value.id}`);
    target.set(value.id, value);
  }
}

export async function createArenaV6(room: ArenaRoomV1): Promise<string> {
  const frozen = room.frozenRoster;
  if (!frozen || !room.startRequestId) throw new ArenaV6Error('缺少冻结阵容');
  const existing = await store.source(room.roomId, room.startRequestId);
  if (existing) return existing;
  const seats = [...frozen.seats].sort((a, b) =>
    a.cultivatorId.localeCompare(b.cultivatorId),
  );
  return withRedisLock(
    {
      keys: seats.map((seat) =>
        redisLockKeys.cultivatorMutation(seat.cultivatorId),
      ),
      context: 'combat-v6-arena-create',
      timeoutMs: 60000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        for (const seat of seats)
          await lockCultivatorForStateMutation(tx, seat.cultivatorId);
        const skills = new Map<string, SkillDef>();
        const statuses = new Map<string, StatusDef>();
        const units: ArenaRuntime['units'] = [];
        const participants: ArenaRuntime['participants'] = [];
        for (const seat of seats) {
          if (
            (await hasActiveTower(seat.cultivatorId)) ||
            (await hasActiveRanking(seat.cultivatorId)) ||
            (await hasActiveDungeon(seat.cultivatorId)) ||
            ((await hasActiveSectTaskBattle(seat.cultivatorId)) || (await hasActiveBreakthroughBattle(seat.cultivatorId)))
          )
            throw new ArenaV6Error('参战角色尚在秘境探索或结算中');
          const identity = await tx.query.cultivators.findFirst({
            where: and(
              eq(cultivators.id, seat.cultivatorId),
              eq(cultivators.userId, seat.userId),
              eq(cultivators.status, 'active'),
            ),
          });
          if (!identity) throw new ArenaV6Error('参战角色归属已变化');
          const { player } = await assembleCombatV6TrainingPlayer(
            seat.cultivatorId,
            tx,
          );
          const side = seat.teamId === 'alpha' ? 0 : 1;
          const projection = projectCultivatorMultiSectV5ToCombatV6({
            ...player,
            side,
            slot: seat.slot,
            resourcePolicy: 'full',
          });
          if (!projection.ok) throw new ArenaV6Error('参战构筑无法编译');
          units.push(projection.unit);
          units.push(
            ...projectBeastRoster(
              player.beasts,
              projection.unit.id!,
              projection.unit.side,
              projection.unit.slot ?? 0,
              projection.unit.level,
            ),
          );
          mergeDefinitions(skills, BEAST_SKILLS);
          participants.push({
            userId: seat.userId,
            cultivatorId: seat.cultivatorId,
            unitId: projection.unit.id!,
            side,
            slot: seat.slot,
          });
          mergeDefinitions(skills, projection.skills);
          mergeDefinitions(statuses, projection.statusDefs);
        }
        units.sort((a, b) => a.side - b.side || (a.slot ?? 0) - (b.slot ?? 0));
        const now = Date.now();
        const battleId = crypto.randomUUID();
        const input = {
          seed: crypto.getRandomValues(new Uint32Array(1))[0],
          units,
          skills: [...skills.values()],
          statusDefs: [...statuses.values()],
        };
        const battle = arenaBattle(input);
        const runtime: ArenaRuntime = {
          ...input,
          protocol: ARENA_V6_PROTOCOL,
          battleId,
          roomId: room.roomId,
          startRequestId: room.startRequestId!,
          participants,
          state: battle.snapshot(),
          timeline: startReplayTimeline(
            battle.snapshot(),
            input.statusDefs,
            battle.log().length - 1,
          ),
          events: [...battle.log()],
          rounds: [],
          revision: 0,
          stage: 'collecting',
          createdAt: now,
          expiresAt: now + 7200000,
          deadlineAt: now + 30000,
          playbackEndsAt: now,
          commands: {},
          receipts: {},
          lastResults: {},
        };
        lease.assertHeld();
        const id = await store.create(runtime);
        if (id === 'BUSY')
          throw new ArenaV6Error('有参战角色正在战斗或等待结算');
        return id;
      }),
  );
}

export async function ownedArenaV6(id: string, actor: Actor) {
  const runtime = await store.get(id);
  if (!runtime) throw new ArenaV6Error('战斗不存在或已过期', 404);
  const participant = runtime.participants.find(
    (p) => p.userId === actor.userId && p.cultivatorId === actor.cultivatorId,
  );
  if (!participant) throw new ArenaV6Error('无权访问此战斗', 403);
  return { runtime, participant };
}

export async function watchedArenaV6(id: string, actor: Actor) {
  const runtime = await store.get(id);
  if (!runtime) throw new ArenaV6Error('战斗不存在或已过期', 404);
  const room = await new ArenaRoomService().getRoom(runtime.roomId);
  if (
    room?.battleMatchId !== id ||
    !room.spectators?.some(
      (s) => s.userId === actor.userId && s.cultivatorId === actor.cultivatorId,
    )
  )
    throw new ArenaV6Error('请先凭邀请码进入房间观战席', 403);
  return { runtime, participant: { unitId: ARENA_PUBLIC_VIEW } };
}

export async function submitArenaV6(
  id: string,
  actor: Actor,
  input: ArenaV6Submit,
) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const { runtime, participant } = await ownedArenaV6(id, actor);
    const receipt = runtime.receipts[input.requestId];
    if (receipt) {
      if (
        receipt.unitId !== participant.unitId ||
        receipt.round !== input.round ||
        JSON.stringify(receipt.commands) !== JSON.stringify(input.commands)
      )
        throw new ArenaV6Error('请求 ID 已用于其他指令');
      return {
        accepted: true,
        round: receipt.round,
        requestId: input.requestId,
      };
    }
    if (
      runtime.stage !== 'collecting' ||
      runtime.state.round !== input.round ||
      Date.now() >= runtime.deadlineAt ||
      Date.now() >= runtime.expiresAt
    )
      throw new ArenaV6Error('本回合已锁定，请同步最新战况');
    if (runtime.commands[participant.unitId])
      throw new ArenaV6Error('本回合指令已提交');
    const commands =
      input.commands === 'AUTO'
        ? automaticCommands(
            runtime.state,
            participant.unitId,
            runtime.skills,
            (unitId) => arenaBattle(runtime).queryCommands(unitId),
          )
        : input.commands;
    try {
      validateCommandGroup(runtime.state, participant.unitId, commands);
      for (const entry of commands)
        validateArenaCommand(runtime, entry.unitId, entry.command);
    } catch (error) {
      throw new ArenaV6Error(
        error instanceof Error ? error.message : '指令无效',
        400,
      );
    }
    const next = structuredClone(runtime);
    for (const entry of commands)
      next.commands[entry.unitId] = {
        requestId: input.requestId,
        command: entry.command,
      };
    next.receipts[input.requestId] = {
      round: input.round,
      unitId: participant.unitId,
      commands: input.commands,
    };
    next.revision++;
    if (arenaWaitingUnits(next).every((u) => next.commands[u.id]))
      next.deadlineAt = Date.now();
    if (!(await store.save(next, runtime.revision, true))) continue;
    await broadcastArenaV6(next);
    await advanceArenaV6(id);
    return { accepted: true, round: input.round, requestId: input.requestId };
  }
  throw new ArenaV6Error('多人同时提交，请重试相同请求');
}

export async function advanceArenaV6(id: string) {
  let runtime = await store.get(id);
  if (!runtime) {
    await redis.zrem(arenaDueKey, id);
    return;
  }
  const now = Date.now();
  if (runtime.stage === 'finished') {
    await finalizeArenaV6(runtime);
    return;
  }
  const room = await rooms.getRoom(runtime.roomId);
  if (
    room?.status === 'starting' &&
    room.startRequestId === runtime.startRequestId
  ) {
    const attached = await rooms.attachBattleMatch(
      runtime.roomId,
      runtime.startRequestId,
      runtime.battleId,
    );
    publishArenaRoomChanges(
      runtime.participants.map((p) => p.userId),
      {
        roomId: attached.roomId,
        revision: attached.revision,
        status: attached.status,
      },
    );
  }
  if (now >= runtime.expiresAt) {
    const next: ArenaRuntime = {
      ...runtime,
      revision: runtime.revision + 1,
      stage: 'finished',
      terminalReason: 'expired',
      deadlineAt: now,
      lastResults: {},
    };
    if (await store.save(next, runtime.revision)) {
      await broadcastArenaV6(next);
      await finalizeArenaV6(next);
    }
    return;
  }
  if (runtime.stage === 'playback') {
    if (now < runtime.playbackEndsAt) return;
    const next: ArenaRuntime = {
      ...runtime,
      commands: {},
      stage: 'collecting',
      revision: runtime.revision + 1,
      deadlineAt: runtime.playbackEndsAt + 30000,
    };
    for (const unit of arenaWaitingUnits(next)) {
      if (
        !(await store.online(
          `${runtime.battleId}:${unit.ownerId ?? unit.id}`,
          now,
        ))
      )
        next.commands[unit.id] = {
          requestId: `offline:${next.state.round}:${unit.id}`,
          command: arenaDefaultCommand(next, unit.id),
          automatic: true,
        };
    }
    if (arenaWaitingUnits(next).every((u) => next.commands[u.id]))
      next.deadlineAt = now;
    if (!(await store.save(next, runtime.revision))) return;
    await broadcastArenaV6(next);
    runtime = next;
  }
  if (runtime.stage === 'collecting') {
    if (now < runtime.deadlineAt) return;
    const next: ArenaRuntime = {
      ...runtime,
      commands: { ...runtime.commands },
      stage: 'resolving',
      revision: runtime.revision + 1,
      deadlineAt: now,
    };
    for (const unit of arenaWaitingUnits(next))
      if (!next.commands[unit.id])
        next.commands[unit.id] = {
          requestId: `timeout:${next.state.round}:${unit.id}`,
          command: arenaDefaultCommand(next, unit.id),
          automatic: true,
        };
    if (!(await store.save(next, runtime.revision))) return;
    await broadcastArenaV6(next);
    runtime = next;
  }
  if (runtime.stage === 'resolving') {
    let next: ArenaRuntime;
    try {
      next = resolveArena(runtime, Date.now());
    } catch (error) {
      console.error('[arena-v6] deterministic resolution failed', {
        battleId: id,
        error,
      });
      next = {
        ...runtime,
        revision: runtime.revision + 1,
        stage: 'finished',
        terminalReason: 'technical-abort',
        deadlineAt: now,
        lastResults: {},
      };
    }
    if (!(await store.save(next, runtime.revision))) return;
    await broadcastArenaV6(next);
    if (next.stage === 'finished') await finalizeArenaV6(next);
  }
}

async function finalizeArenaV6(runtime: ArenaRuntime) {
  // Cleanup precedes archival so PostgreSQL outages cannot retain player locks.
  await store.release(runtime);
  const released = await rooms.forceReleaseTerminalBattle({
    kind: 'arena_sparring',
    matchId: runtime.battleId,
    roomId: runtime.roomId,
    playerIds: runtime.participants.map((p) => p.userId),
    cultivatorIds: runtime.participants.map((p) => p.cultivatorId),
  });
  if (released.released)
    publishArenaRoomChanges(released.userIds, {
      roomId: runtime.roomId,
      revision: released.revision,
      status: 'finished',
    });
  await archiveCombatV6Replay(
    createCombatV6Replay({
      battleId: runtime.battleId,
      participants: runtime.participants,
      metadata: {
        schemaVersion: 1,
        sourceType: 'arena-sparring',
        battleType: 'pvp',
        idempotencyKey: runtime.startRequestId,
        payload: { roomId: runtime.roomId },
      },
      startedAt: new Date(runtime.createdAt).toISOString(),
      finishedAt: new Date(runtime.deadlineAt).toISOString(),
      reason: runtime.terminalReason!,
      trace: {
        seed: runtime.seed,
        initialUnits: runtime.units,
        skills: runtime.skills,
        statusDefs: runtime.statusDefs,
        rounds: runtime.rounds,
        events: runtime.events,
        finalState: runtime.state,
        timeline: runtime.timeline,
      },
    }),
  );
  const definition = DOMAIN_EVENT_DEFINITIONS['combat.v6.battle.finished'];
  const event = parseDomainEventEnvelope({
    id: runtime.battleId,
    type: 'combat.v6.battle.finished',
    version: definition.version,
    subject: definition.subject,
    occurredAt: new Date(runtime.deadlineAt).toISOString(),
    aggregate: { type: 'combat-v6-battle', id: runtime.battleId },
    correlationId: runtime.startRequestId,
    data: { battleId: runtime.battleId, sourceType: 'arena-sparring' },
  });
  await (
    await getJetStreamClient()
  ).publish(event.subject, JSONCodec().encode(event), {
    msgID: event.id,
    expect: { streamName: DOMAIN_EVENT_STREAM },
    timeout: 5000,
  });
  await store.acknowledge(runtime);
}

export async function arenaReplayV6(id: string, actor: Actor) {
  const row = await findOwnedCombatV6Replay(id, actor.cultivatorId);
  if (
    !row ||
    !row.replay.participants.some(
      (p) => p.userId === actor.userId && p.cultivatorId === actor.cultivatorId,
    )
  )
    throw new ArenaV6Error('回放不存在或无权访问', 404);
  return combatV6ReplayView(row.replay, actor.cultivatorId, actor.userId);
}

let stopped = true;
let task: Promise<void> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
export function startArenaV6Coordinator() {
  if (!stopped) return;
  stopped = false;
  const run = async () => {
    try {
      const ids = await redis.zrangebyscore(
        arenaDueKey,
        0,
        Date.now(),
        'LIMIT',
        0,
        100,
      );
      for (const id of ids)
        try {
          await advanceArenaV6(id);
        } catch (error) {
          console.error('[arena-v6] advance failed', { battleId: id, error });
          await redis.zadd(arenaDueKey, 'XX', Date.now() + 5000, id);
        }
    } catch (error) {
      console.error('[arena-v6] coordinator failed', error);
    } finally {
      if (!stopped)
        timer = setTimeout(() => {
          task = run();
        }, 500);
    }
  };
  task = run();
}
export async function stopArenaV6Coordinator() {
  stopped = true;
  clearTimeout(timer);
  await task;
}
import { hasActiveBreakthroughBattle } from './CombatV6BreakthroughOccupancy';
