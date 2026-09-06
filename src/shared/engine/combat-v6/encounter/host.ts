import {
  controlledUnits,
  validateCommandGroup,
  validatePetCommand,
} from '../../../combat-v6/controlled-commands';
import {
  replayRound,
  startReplayTimeline,
} from '../../../combat-v6/replay-timeline';
import type { CombatV6ReplayTimeline } from '../../../contracts/combatV6Replay';
import {
  BattlePhase,
  CommandType,
  MatchWinner,
  ResultReason,
  TargetSide,
  Team,
  createBattle,
  isStanding,
  restoreBattle,
  type BattleEvent,
  type BattleSession,
  type Command,
  type SkillDef,
  type Unit,
} from '../core/index.ts';
import { canCollectCommand } from '../core/units';
import { compileCombatV6TrainingEncounterV1 } from './compiler.ts';
import type {
  CombatV6EncounterTraceV1,
  CombatV6TrainingHostV1,
  CombatV6TrainingRuntimeSnapshotV1,
  CompileCombatV6TrainingEncounterV1Input,
  CompileCombatV6TrainingEncounterV1Result,
  CompiledCombatV6TrainingEncounterV1,
  PveCommandStrategyV1,
  TrainingEncounterOutcome,
} from './types.ts';

export const TrainingHostErrorCode = {
  NotCommandPhase: 'training-not-command-phase',
  UnknownUnit: 'training-unknown-unit',
  UnitNotControlled: 'training-unit-not-controlled',
  UnitCannotAct: 'training-unit-cannot-act',
  UnknownSkill: 'training-unknown-skill',
  UnknownTarget: 'training-unknown-target',
  UnsupportedCommand: 'training-unsupported-command',
  PlayerCommandMissing: 'training-player-command-missing',
} as const;

export class TrainingHostError extends Error {
  constructor(
    readonly code: (typeof TrainingHostErrorCode)[keyof typeof TrainingHostErrorCode],
    message: string,
  ) {
    super(message);
    this.name = 'TrainingHostError';
  }
}

export type CreateCombatV6TrainingHostV1Result =
  | {
      ok: true;
      host: CombatV6TrainingHostSessionV1;
      diagnostics: CompileCombatV6TrainingEncounterV1Result['diagnostics'];
      versions: CompiledCombatV6TrainingEncounterV1['battleInput']['versions'];
    }
  | Extract<CompileCombatV6TrainingEncounterV1Result, { ok: false }>;

export function createCombatV6TrainingHostV1(
  input: CompileCombatV6TrainingEncounterV1Input,
): CreateCombatV6TrainingHostV1Result {
  const result = compileCombatV6TrainingEncounterV1(input);
  if (!result.ok) return result;
  return {
    ok: true,
    host: new CombatV6TrainingHostSessionV1(result.compiled),
    diagnostics: result.diagnostics,
    versions: result.versions,
  };
}

export function restoreCombatV6TrainingHostV1(
  runtime: CombatV6TrainingRuntimeSnapshotV1,
): CreateCombatV6TrainingHostV1Result {
  const result = compileCombatV6TrainingEncounterV1(runtime.input);
  if (!result.ok) return result;
  return {
    ok: true,
    host: new CombatV6TrainingHostSessionV1(result.compiled, runtime),
    diagnostics: result.diagnostics,
    versions: result.versions,
  };
}

export type CompiledPveEncounter = Pick<
  CompiledCombatV6TrainingEncounterV1,
  'playerId' | 'battleInput' | 'npcStrategies' | 'sourceProjectionVersions'
>;
export type PveRestoredState = Pick<
  CombatV6TrainingRuntimeSnapshotV1,
  'state' | 'events' | 'rounds' | 'timeline'
>;

/** Shared command orchestration. Source-specific compilation and serialization stay outside. */
export class CombatV6PveHostSession {
  protected readonly timeline?: CombatV6ReplayTimeline;
  readonly playerId: string;
  protected readonly battle: BattleSession;
  protected readonly initialUnits: CompiledCombatV6TrainingEncounterV1['battleInput']['units'];
  protected readonly skills: SkillDef[];
  protected readonly statusDefs: NonNullable<
    CompiledCombatV6TrainingEncounterV1['battleInput']['statusDefs']
  >;
  protected readonly rounds: CombatV6EncounterTraceV1['rounds'] = [];

  constructor(
    private readonly encounter: CompiledPveEncounter,
    restored?: PveRestoredState,
  ) {
    const compiled = encounter;
    this.playerId = compiled.playerId;
    this.initialUnits = clone(compiled.battleInput.units);
    this.skills = clone(compiled.battleInput.skills ?? []);
    this.statusDefs = clone(compiled.battleInput.statusDefs ?? []);
    this.battle = restored
      ? restoreBattle(compiled.battleInput, restored.state, restored.events)
      : createBattle(compiled.battleInput);
    this.timeline = restored
      ? clone(restored.timeline)
      : startReplayTimeline(
          this.battle.snapshot(),
          this.statusDefs,
          this.battle.log().length - 1,
        );
    if (restored) this.rounds.push(...clone(restored.rounds));
  }

  get finished(): boolean {
    return this.battle.finished;
  }
  get state() {
    return this.battle.snapshot();
  }

  queryCommands(unitId = this.playerId) {
    return this.battle.queryCommands(unitId);
  }

  controlledCommandOptions() {
    return controlledUnits(this.battle.state, this.playerId).map((unit) =>
      this.queryCommands(unit.id),
    );
  }

  submitGroup(entries: Array<{ unitId: string; command: Command }>) {
    try {
      validateCommandGroup(this.battle.state, this.playerId, entries);
    } catch (error) {
      throw new TrainingHostError(
        TrainingHostErrorCode.UnitNotControlled,
        error instanceof Error ? error.message : '指令组无效',
      );
    }
    for (const entry of entries)
      this.validateCommand(this.battle.unit(entry.unitId), entry.command);
    for (const entry of entries) this.submit(entry.unitId, entry.command);
  }

  submit(unitId: string, command: Command): void {
    if (this.battle.state.phase !== BattlePhase.Command)
      throw new TrainingHostError(
        TrainingHostErrorCode.NotCommandPhase,
        '当前不在训练指令阶段',
      );
    const unit = this.battle.state.units.find(
      (candidate) => candidate.id === unitId,
    );
    if (!unit)
      throw new TrainingHostError(
        TrainingHostErrorCode.UnknownUnit,
        `未知训练单位：${unitId}`,
      );
    if (
      unitId !== this.playerId &&
      !(unit.kind === 'pet' && unit.ownerId === this.playerId)
    )
      throw new TrainingHostError(
        TrainingHostErrorCode.UnitNotControlled,
        `单位 ${unitId} 不由玩家控制`,
      );
    if (!canCollectCommand(unit, true))
      throw new TrainingHostError(
        TrainingHostErrorCode.UnitCannotAct,
        `单位 ${unitId} 当前不能提交指令`,
      );
    this.validateCommand(unit, command);
    this.battle.submit(unitId, clone(command));
  }

  resolveRound(
    afterAction?: (
      state: ReturnType<BattleSession['snapshot']>,
      eventSeq: number,
    ) => void,
  ): BattleEvent[] {
    if (this.battle.finished) return [];
    if (this.battle.state.phase !== BattlePhase.Command)
      throw new TrainingHostError(
        TrainingHostErrorCode.NotCommandPhase,
        '当前不在训练指令阶段',
      );
    if (
      controlledUnits(this.battle.state, this.playerId).some(
        (unit) => !unit.command,
      )
    )
      throw new TrainingHostError(
        TrainingHostErrorCode.PlayerCommandMissing,
        '玩家尚未提交本回合指令',
      );

    const npcs = this.battle.state.units
      .filter(
        (unit) =>
          unit.id !== this.playerId &&
          unit.ownerId !== this.playerId &&
          isStanding(unit),
      )
      .sort(stableUnitOrder);
    for (const npc of npcs) {
      if (npc.command) continue;
      const strategy = this.encounter.npcStrategies[npc.id];
      if (strategy)
        this.battle.submit(npc.id, this.decideNpcCommand(npc, strategy));
    }

    const round = this.battle.state.round;
    const commands = this.battle.state.units
      .filter((unit) => canCollectCommand(unit, true) && unit.command)
      .sort(stableUnitOrder)
      .map((unit) => ({ unitId: unit.id, command: clone(unit.command!) }));
    const before = this.battle.log().length;
    const recording = replayRound(
      this.timeline,
      this.battle.snapshot(),
      this.statusDefs,
      before - 1,
    );
    this.battle.lockAndResolve((state, seq) => {
      recording.capture(state, seq);
      afterAction?.(state, seq);
    });
    recording.finish(this.battle.snapshot(), this.battle.log().length - 1);
    this.rounds.push({ round, commands });
    return clone(this.battle.log().slice(before));
  }

  snapshot() {
    return this.battle.snapshot();
  }

  protected recordedState(): PveRestoredState {
    return clone({
      state: this.battle.snapshot(),
      rounds: this.rounds,
      events: [...this.battle.log()],
      timeline: this.timeline,
    });
  }

  protected traceData() {
    return clone({
      seed: this.encounter.battleInput.seed,
      combatVersions: this.encounter.battleInput.versions,
      sourceProjectionVersions: this.encounter.sourceProjectionVersions,
      initialUnits: this.initialUnits,
      skills: this.skills,
      statusDefs: this.statusDefs,
      rounds: this.rounds,
      events: [...this.battle.log()],
      timeline: this.timeline,
      finalState: this.finished ? this.snapshot() : undefined,
      outcome: this.finished
        ? trainingEncounterOutcome(this.battle.state, this.playerId)
        : undefined,
    });
  }

  private validateCommand(unit: Unit, command: Command): void {
    try {
      validatePetCommand(this.queryCommands(unit.id), command);
    } catch (error) {
      throw new TrainingHostError(
        TrainingHostErrorCode.UnsupportedCommand,
        error instanceof Error ? error.message : '召唤指令无效',
      );
    }
    if (
      ![
        CommandType.Attack,
        CommandType.Skill,
        CommandType.Defend,
        CommandType.Protect,
        CommandType.Flee,
        CommandType.Summon,
        CommandType.Recall,
      ].includes(command.type as never)
    )
      throw new TrainingHostError(
        TrainingHostErrorCode.UnsupportedCommand,
        `不支持指令：${command.type}`,
      );
    if (
      command.type === CommandType.Skill &&
      !unit.skills.includes(command.skillId)
    )
      throw new TrainingHostError(
        TrainingHostErrorCode.UnknownSkill,
        `未拥有技能 ${command.skillId}`,
      );
    const ids =
      command.type === CommandType.Skill
        ? command.targets
        : command.type === CommandType.Attack ||
            command.type === CommandType.Protect
          ? [command.target]
          : [];
    for (const id of ids)
      if (!this.battle.state.units.some((candidate) => candidate.id === id))
        throw new TrainingHostError(
          TrainingHostErrorCode.UnknownTarget,
          `未知目标：${id}`,
        );
  }

  private decideNpcCommand(
    unit: Unit,
    strategy: PveCommandStrategyV1,
  ): Command {
    if (strategy.type === 'defend') return { type: CommandType.Defend };
    const enemies = this.battle.state.units
      .filter(
        (candidate) => candidate.side !== unit.side && isStanding(candidate),
      )
      .sort(stableUnitOrder);
    if (strategy.type === 'attack')
      return enemies[0]
        ? { type: CommandType.Attack, target: enemies[0].id }
        : { type: CommandType.Defend };
    const skillId =
      strategy.skillIds[
        (this.battle.state.round - 1) % strategy.skillIds.length
      ];
    const skill = this.skills.find((candidate) => candidate.id === skillId);
    if (!skill) return { type: CommandType.Defend };
    const option = this.battle
      .queryCommands(unit.id)
      .skills.find((candidate) => candidate.skillId === skillId);
    const rawPool =
      skill.targeting.side === TargetSide.Self
        ? [unit]
        : this.battle.state.units
            .filter(
              (candidate) =>
                isStanding(candidate) &&
                (skill.targeting.side === TargetSide.Any ||
                  (skill.targeting.side === TargetSide.Enemy
                    ? candidate.side !== unit.side
                    : candidate.side === unit.side)),
            )
            .sort(stableUnitOrder);
    const target = option?.selectableTargetIds[0] ?? rawPool[0]?.id;
    return {
      type: CommandType.Skill,
      skillId,
      targets: target ? [target] : [],
    };
  }
}

export class CombatV6TrainingHostSessionV1
  extends CombatV6PveHostSession
  implements CombatV6TrainingHostV1
{
  constructor(
    private readonly compiled: CompiledCombatV6TrainingEncounterV1,
    restored?: CombatV6TrainingRuntimeSnapshotV1,
  ) {
    super(compiled, restored);
  }

  runtimeSnapshot(): CombatV6TrainingRuntimeSnapshotV1 {
    return clone({
      schemaVersion: 1 as const,
      hostVersion: 'combat_v6_training_runtime_v1' as const,
      input: {
        encounterId: this.compiled.encounterId,
        tier: this.compiled.tier,
        seed: this.compiled.seed,
        player: this.compiled.sourcePlayerInput,
      },
      timeline: this.timeline,
      state: this.battle.snapshot(),
      rounds: this.rounds,
      events: [...this.battle.log()],
    });
  }

  trace(): CombatV6EncounterTraceV1 {
    const finished = this.battle.finished;
    return clone({
      schemaVersion: 1 as const,
      hostVersion: 'combat_v6_encounter_host_v1' as const,
      encounterId: this.compiled.encounterId,
      timeline: this.timeline,
      tier: this.compiled.tier,
      seed: this.compiled.seed,
      combatVersions: this.compiled.battleInput.versions,
      sourceProjectionVersions: this.compiled.sourceProjectionVersions,
      initialUnits: this.initialUnits,
      skills: this.skills,
      statusDefs: this.statusDefs,
      rounds: this.rounds,
      events: [...this.battle.log()],
      finalState: finished ? this.battle.snapshot() : undefined,
      outcome: finished
        ? trainingEncounterOutcome(this.battle.state, this.playerId)
        : undefined,
    });
  }
}

export function trainingEncounterOutcome(
  state: ReturnType<BattleSession['snapshot']>,
  playerId: string,
): TrainingEncounterOutcome | undefined {
  if (!state.result) return undefined;
  const player = state.units.find((unit) => unit.id === playerId);
  if (player?.flags.escaped || state.result.reason === ResultReason.Flee)
    return 'aborted';
  if (state.result.winner === MatchWinner.Draw) return 'draw';
  return state.result.winner === Team.A ? 'victory' : 'defeat';
}

function stableUnitOrder(a: Unit, b: Unit): number {
  return a.side - b.side || a.slot - b.slot || a.id.localeCompare(b.id);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
