import {
  COMBAT_V6_TRAINING_API_VERSION,
  type CombatV6DisplayEvent,
} from '@shared/contracts/combatV6';
import {
  ARENA_PUBLIC_VIEW,
  ARENA_V6_PROTOCOL,
  type ArenaRuntime,
  type ArenaSessionView,
} from '@shared/contracts/combatV6Arena';
import {
  createBattle,
  restoreBattle,
  type BattleEvent,
  type BattleState,
  type Command,
} from '@shared/engine/combat-v6/core';
import { canCollectCommand } from '@shared/engine/combat-v6/core/units';
import { daoyouRulesetV6 } from '@shared/engine/combat-v6/rules-daoyou';
import { COMBAT_V6_PHASE_9B_ARENA_VERSIONS } from '@shared/engine/combat-v6/version';
import { controlledUnits, validatePetCommand } from './controlled-commands';
import { diffUnits } from './playback';
import {
  combatV6Display,
  combatV6Units,
  visibleUnitNames,
} from './presentation';
import { replayRound } from './replay-timeline';

export function arenaBattle(
  runtime: Pick<ArenaRuntime, 'seed' | 'units' | 'skills' | 'statusDefs'> &
    Partial<Pick<ArenaRuntime, 'state' | 'events'>>,
) {
  const input = {
    seed: runtime.seed,
    units: runtime.units,
    skills: runtime.skills,
    statusDefs: runtime.statusDefs,
    versions: COMBAT_V6_PHASE_9B_ARENA_VERSIONS,
    ruleset: daoyouRulesetV6,
  };
  if (runtime.state) {
    if (
      JSON.stringify(runtime.state.versions) !==
      JSON.stringify(COMBAT_V6_PHASE_9B_ARENA_VERSIONS)
    )
      throw new Error('ARENA_VERSION_MISMATCH');
    return restoreBattle(input, runtime.state, runtime.events ?? []);
  }
  return createBattle(input);
}

export function arenaWaitingUnits(runtime: ArenaRuntime) {
  return runtime.state.units.filter((unit) => canCollectCommand(unit, true));
}

export function arenaDefaultCommand(
  runtime: ArenaRuntime,
  unitId: string,
): Command {
  const unit = runtime.state.units.find((u) => u.id === unitId)!;
  const target = runtime.state.units
    .filter(
      (u) =>
        u.side !== unit.side &&
        !u.flags.dead &&
        !u.flags.downed &&
        !u.flags.escaped &&
        !u.flags.benched,
    )
    .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))[0];
  return { type: 'attack', target: target?.id };
}

export function validateArenaCommand(
  runtime: ArenaRuntime,
  unitId: string,
  command: Command,
) {
  const options = arenaBattle(runtime).queryCommands(unitId);
  if (!options.canSubmit) throw new Error('当前单位不能下令');
  validatePetCommand(options, command);
  if (
    command.type === 'attack' &&
    command.target &&
    !options.attackTargetIds.includes(command.target)
  )
    throw new Error('攻击目标无效');
  if (
    command.type === 'protect' &&
    !options.protectTargetIds.includes(command.target)
  )
    throw new Error('保护目标无效');
  if (command.type === 'skill') {
    const skill = options.skills.find((s) => s.skillId === command.skillId);
    if (
      !skill ||
      !command.targets.length ||
      new Set(command.targets).size !== command.targets.length ||
      command.targets.some((id) => !skill.selectableTargetIds.includes(id)) ||
      command.targets.length > skill.targetCount
    )
      throw new Error('技能或目标无效');
  }
}

/** Public bars use basis points, never disguised exact attributes. */
export function arenaUnits(
  state: BattleState,
  runtime: Pick<ArenaRuntime, 'statusDefs'>,
  viewerId: string,
) {
  const viewerSide =
    viewerId === ARENA_PUBLIC_VIEW
      ? 0
      : state.units.find((u) => u.id === viewerId)!.side;
  return projectReplayUnits(
    combatV6Units(state, runtime.statusDefs),
    viewerId,
    viewerSide,
  );
}

export function projectReplayUnits(
  units: ReturnType<typeof combatV6Units>,
  viewerId: string,
  viewerSide: 0 | 1,
) {
  return units.map((unit) => {
    const side = (unit.side === viewerSide ? 0 : 1) as 0 | 1;
    if (unit.id === viewerId || unit.ownerId === viewerId)
      return { ...unit, side };
    return {
      ...unit,
      side,
      publicBars: true,
      hp: Math.floor((unit.hp / Math.max(1, unit.maxHp)) * 10000),
      maxHp: 10000,
      mp: Math.floor((unit.mp / Math.max(1, unit.maxMp)) * 10000),
      maxMp: 10000,
      attributes: undefined,
      wound: 0,
      resources: [],
      barriers: unit.barriers.map((b) => ({
        ...b,
        current: Math.floor((b.current / Math.max(1, unit.maxHp)) * 10000),
      })),
    };
  });
}

/** Filter before assigning the public cursor; private commands cannot create gaps. */
export function arenaEvents(events: readonly BattleEvent[]) {
  const privateTypes = new Set([
    'battleStart',
    'commandAccepted',
    'commandDefaulted',
    'mpCost',
    'hpCost',
    'resourceChanged',
    'wound',
    'woundChanged',
    'barrierChanged',
    'chanceResolved',
  ]);
  return events
    .filter((event) => !privateTypes.has(event.type))
    .map((event, seq) => {
      const publicEvent = { ...event } as Record<string, unknown>;
      for (const key of [
        'hp',
        'generationSeed',
        'hpAfter',
        'mpAfter',
        'maxHpAfter',
        'recoverableHpAfter',
      ])
        delete publicEvent[key];
      return { seq, event: publicEvent as CombatV6DisplayEvent };
    });
}

export function arenaView(
  runtime: ArenaRuntime,
  viewerId: string,
  now: number,
): ArenaSessionView {
  const viewer = runtime.participants.find((p) => p.unitId === viewerId);
  const spectator = viewerId === ARENA_PUBLIC_VIEW;
  if (!viewer && !spectator) throw new Error('ARENA_FORBIDDEN');
  const events = arenaEvents(runtime.events);
  const state = runtime.state;
  const result = state.result;
  const visibleSkills = new Set(
    state.units
      .filter((u) => u.id === viewerId || u.ownerId === viewerId)
      .flatMap((u) => u.skills),
  );
  const visibleStatuses = new Set(
    state.units.flatMap((u) => u.statuses.map((s) => s.id)),
  );
  for (const { event } of events)
    if ('statusId' in event) visibleStatuses.add(event.statusId);
  const display = combatV6Display(
    runtime.skills.filter((s) => visibleSkills.has(s.id)),
    runtime.statusDefs,
  );
  for (const { event } of events)
    if (event.type === 'actionStart' && event.command.type === 'skill')
      visibleSkills.add(event.command.skillId);
  const outcome =
    runtime.stage !== 'finished'
      ? undefined
      : !result
        ? 'aborted'
        : result.winner === 'draw'
          ? 'draw'
          : result.winner === (viewer?.side ?? 0)
            ? 'victory'
            : 'defeat';
  return {
    apiVersion: COMBAT_V6_TRAINING_API_VERSION,
    protocol: ARENA_V6_PROTOCOL,
    sessionId: runtime.battleId,
    revision: runtime.revision,
    expiresAt: new Date(runtime.expiresAt).toISOString(),
    combatVersions: state.versions,
    roomId: runtime.roomId,
    controlledUnitId: viewerId,
    spectator,
    round: state.round,
    phase: state.phase,
    stage: runtime.stage,
    outcome,
    units: arenaUnits(state, runtime, viewerId),
    events,
    latestEventSeq: events.length - 1,
    commandOptions:
      !spectator &&
      runtime.stage === 'collecting' &&
      !runtime.commands[viewerId]
        ? arenaBattle(runtime).queryCommands(viewerId)
        : undefined,
    pendingCommand: undefined,
    controlledCommandOptions:
      !spectator &&
      runtime.stage === 'collecting' &&
      !runtime.commands[viewerId]
        ? controlledUnits(state, viewerId).map((unit) =>
            arenaBattle(runtime).queryCommands(unit.id),
          )
        : undefined,
    display: {
      ...display,
      unitNames: visibleUnitNames(state, runtime.events, viewerId),
      skills: Object.fromEntries(
        runtime.skills
          .filter((s) => visibleSkills.has(s.id))
          .map((s) => [s.id, s.name]),
      ),
      statuses: Object.fromEntries(
        runtime.statusDefs
          .filter((s) => visibleStatuses.has(s.id))
          .map((s) => [s.id, s.name]),
      ),
    },
    serverNow: now,
    commandOpensAt: runtime.playbackEndsAt,
    commandDeadlineAt:
      runtime.stage === 'playback'
        ? runtime.playbackEndsAt + 30000
        : runtime.deadlineAt,
    playbackEndsAt: runtime.playbackEndsAt,
    submittedUnitIds: Object.keys(runtime.commands),
    terminalReason: runtime.terminalReason,
  };
}

export function resolveArena(runtime: ArenaRuntime, now: number): ArenaRuntime {
  const next = structuredClone(runtime);
  const recording = replayRound(
    next.timeline,
    next.state,
    next.statusDefs,
    next.events.length - 1,
  );
  const battle = arenaBattle(next);
  const commands = arenaWaitingUnits(next).map((unit) => ({
    unitId: unit.id,
    command:
      next.commands[unit.id]?.command ?? arenaDefaultCommand(next, unit.id),
  }));
  for (const entry of commands) battle.submit(entry.unitId, entry.command);
  next.rounds.push({ round: next.state.round, commands });
  const fromSeq = arenaEvents(next.events).length - 1;
  const frames = new Map(
    [...next.participants.map((p) => p.unitId), ARENA_PUBLIC_VIEW].map((id) => [
      id,
      {
        previous: arenaUnits(next.state, next, id),
        frames: [] as NonNullable<ArenaSessionView['playback']>['frames'],
        seq: fromSeq,
      },
    ]),
  );
  const capture = (state: BattleState) => {
    const seq = arenaEvents(battle.log()).length - 1;
    for (const [id, value] of frames) {
      if (seq <= value.seq) continue;
      const units = arenaUnits(state, next, id);
      value.frames.push(diffUnits(value.previous, units, seq, state.round));
      value.previous = units;
      value.seq = seq;
    }
  };
  battle.lockAndResolve((state, seq) => {
    recording.capture(state, seq);
    capture(state);
  });
  recording.finish(battle.snapshot(), battle.log().length - 1);
  capture(battle.snapshot());
  next.state = battle.snapshot();
  next.events = [...battle.log()];
  next.revision++;
  next.playbackEndsAt =
    now + Math.max(1, frames.values().next().value!.frames.length) * 1000;
  next.stage = battle.finished ? 'finished' : 'playback';
  next.deadlineAt = next.playbackEndsAt;
  if (battle.finished) next.terminalReason = 'battle-ended';
  next.lastResults = Object.fromEntries(
    [...next.participants.map((p) => p.unitId), ARENA_PUBLIC_VIEW].map((id) => [
      id,
      {
        ...arenaView(next, id, now),
        playback: {
          format: 'delta-v1' as const,
          fromEventSeq: fromSeq,
          frames: frames.get(id)!.frames,
        },
      },
    ]),
  );
  return next;
}
