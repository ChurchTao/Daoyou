import type {
  BattlePublicSnapshotV1,
  BattlePublicUnitStateV1,
} from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import type {
  BattleMatchPlayerViewV1,
} from '@shared/engine/battle-v5/match/types';
import type { BattleRoundResolutionV1 } from '@shared/engine/battle-v5/round/types';
import type {
  CombatControlVisual,
  CombatVisualFact,
  CombatVisualCommand,
  CombatVisualSpec,
} from '@shared/engine/battle-v5/presentation';
import {
  adaptCombatSequenceV3ToVisualAction,
  projectCombatVisualAction,
  type CombatVisualActionInput,
  type CombatVisualTimeline,
} from '@shared/engine/battle-v5/presentation';
import type { CombatSequenceV3 } from '@shared/engine/battle-v5/v3/types';

export type BattlePresentationTeamV1 = 'allies' | 'enemies';

export interface BattlePresentationEffectV1 {
  readonly id: string;
  readonly label: string;
  readonly tone: 'buff' | 'debuff';
  readonly statusType: 'buff' | 'debuff' | 'control';
  readonly layers: number;
  readonly until: number;
  readonly controlVisual?: CombatControlVisual;
}

export interface BattlePresentationResourceV1 {
  readonly id: string;
  readonly name: string;
  readonly current: number;
  readonly max: number;
}

export interface BattlePresentationActionStateV1 {
  readonly id: string;
  readonly label: string;
  readonly tone: 'preparing' | 'control' | 'mode';
  readonly until: number;
}

/**
 * Renderer-facing entity data. This deliberately contains only public
 * presentation data; it is not a battle-v5 save or runtime unit snapshot.
 */
export interface BattlePresentationEntityV1 {
  readonly id: string;
  readonly name: string;
  readonly team: BattlePresentationTeamV1;
  readonly kind: 'cultivator' | 'spirit-pet';
  readonly slot?: 0 | 1 | 2 | 3;
  readonly ownerId?: string;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly qi: number;
  readonly maxQi: number;
  readonly shield: number;
  readonly alive: boolean;
  readonly effects: readonly BattlePresentationEffectV1[];
  readonly combatResources: readonly BattlePresentationResourceV1[];
  readonly actionStates: readonly BattlePresentationActionStateV1[];
}

export interface BattlePresentationSnapshotV1 {
  readonly version: 'battle_presentation_snapshot_v1';
  readonly elapsedMs: number;
  readonly cycle: number;
  readonly phase: string;
  readonly focusedEntityId: string;
  readonly latestAction?: CombatVisualActionInput;
  readonly entities: readonly BattlePresentationEntityV1[];
}

export interface BattlePlaybackBeatV1 {
  readonly index: number;
  readonly actorId: string;
  readonly actionId: string;
  readonly sequenceIds: readonly string[];
  readonly startAt: number;
  readonly duration: number;
  readonly timeline: CombatVisualTimeline;
}

export interface BattleRoundPlaybackPlanV1 {
  readonly version: 'battle_round_playback_plan_v1';
  readonly commandSetId: string;
  readonly round: number;
  readonly durationMs: number;
  readonly beats: readonly BattlePlaybackBeatV1[];
}

export interface BattlePresentationWindowV1 {
  readonly protocolVersion: 1;
  readonly resultId: string;
  readonly commandSetId: string;
  readonly startedAt: number;
  readonly readyAcceptedAt: number;
  readonly scheduledEndsAt: number;
  readonly startingPublicSnapshot: BattlePublicSnapshotV1;
  readonly plan: BattleRoundPlaybackPlanV1;
}

type CompactVisualCommand =
  | Exclude<CombatVisualCommand, { kind: 'resolve' | 'reaction' }>
  | (Omit<Extract<CombatVisualCommand, { kind: 'resolve' | 'reaction' }>, 'fact'> & {
      readonly factId: string;
    });

export interface CompactBattlePresentationWindowV1 {
  readonly protocolVersion: 1;
  readonly resultId: string;
  readonly commandSetId: string;
  readonly startedAt: number;
  readonly readyAcceptedAt: number;
  readonly scheduledEndsAt: number;
  readonly startingPublicSnapshot: BattlePublicSnapshotV1;
  readonly facts: readonly CombatVisualFact[];
  readonly plan: Omit<BattleRoundPlaybackPlanV1, 'beats'> & {
    readonly beats: ReadonlyArray<
      Omit<BattlePlaybackBeatV1, 'timeline'> & {
        readonly timeline: Omit<CombatVisualTimeline, 'action' | 'commands'> & {
          readonly action: Omit<CombatVisualActionInput, 'facts'> & {
            readonly factIds: readonly string[];
          };
          readonly commands: readonly CompactVisualCommand[];
        };
      }
    >;
  };
}

const BEAT_GAP_MS = 220;
export const BATTLE_PRESENTATION_MIN_MS = 1_500;
export const BATTLE_PRESENTATION_DEFAULT_MAX_MS = 8_000;
export const BATTLE_PRESENTATION_ABSOLUTE_MAX_MS = 10_000;
/** Leaves headroom for the surrounding player snapshot and WebSocket envelope. */
export const BATTLE_PRESENTATION_MAX_SERIALIZED_BYTES = 192 * 1024;

function teamForViewer(
  unit: BattlePublicUnitStateV1,
  viewerTeamId: string,
): BattlePresentationTeamV1 {
  return unit.teamId === viewerTeamId ? 'allies' : 'enemies';
}

function phaseLabel(view: BattleMatchPlayerViewV1): string {
  switch (view.status) {
    case 'waiting':
      return '等待玩家';
    case 'planning':
      return '选招';
    case 'resolving':
      return '统一结算';
    case 'presenting':
      return '回合演出';
    case 'resolution_failed':
      return '结算冻结';
    case 'finished':
      return '战局已定';
    case 'cancelled':
      return '战局取消';
  }
}

export function createBattlePresentationWindow(input: {
  readonly resultId: string;
  readonly startedAt: number;
  readonly startingPublicSnapshot: BattlePublicSnapshotV1;
  readonly plan: BattleRoundPlaybackPlanV1;
  readonly maxDurationMs?: number;
}): BattlePresentationWindowV1 {
  const maxDurationMs = Math.min(
    BATTLE_PRESENTATION_ABSOLUTE_MAX_MS,
    input.maxDurationMs ?? BATTLE_PRESENTATION_DEFAULT_MAX_MS,
  );
  if (
    !input.resultId ||
    !Number.isFinite(input.startedAt) ||
    !Number.isFinite(maxDurationMs) ||
    maxDurationMs < BATTLE_PRESENTATION_MIN_MS
  ) {
    throw new Error('Invalid battle presentation window');
  }
  const plan = fitBattlePresentationPlan(input.plan, maxDurationMs);
  const durationMs = Math.max(
    BATTLE_PRESENTATION_MIN_MS,
    plan.durationMs,
  );
  return {
    protocolVersion: 1,
    resultId: input.resultId,
    commandSetId: plan.commandSetId,
    startedAt: input.startedAt,
    readyAcceptedAt: input.startedAt + BATTLE_PRESENTATION_MIN_MS,
    scheduledEndsAt: input.startedAt + durationMs,
    startingPublicSnapshot: input.startingPublicSnapshot,
    plan,
  };
}

/** Fits every renderer timestamp into the authoritative server window. */
export function fitBattlePresentationPlan(
  plan: BattleRoundPlaybackPlanV1,
  maxDurationMs: number,
): BattleRoundPlaybackPlanV1 {
  if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
    throw new Error('Battle presentation duration budget must be positive');
  }
  if (plan.durationMs <= maxDurationMs) return plan;
  const scale = maxDurationMs / plan.durationMs;
  const beats = plan.beats.map((beat) => {
    const startAt = Math.floor(beat.startAt * scale);
    const endAt = Math.min(
      maxDurationMs,
      Math.ceil((beat.startAt + beat.duration) * scale),
    );
    const duration = Math.max(0, endAt - startAt);
    const scaleLocalTime = (value: number) =>
      Math.min(duration, Math.max(0, Math.floor(value * scale)));
    const commands = beat.timeline.commands.map((command) => {
      const at = scaleLocalTime(command.at);
      const commandEnd = Math.min(
        duration,
        Math.max(at, Math.ceil((command.at + command.duration) * scale)),
      );
      const scaled = {
        ...command,
        at,
        duration: commandEnd - at,
      };
      return command.kind === 'delivery'
        ? { ...scaled, impactAt: scaleLocalTime(command.impactAt) }
        : scaled;
    });
    return {
      ...beat,
      startAt,
      duration,
      timeline: {
        ...beat.timeline,
        duration,
        impactAt: scaleLocalTime(beat.timeline.impactAt),
        commands,
      },
    };
  });
  return {
    ...plan,
    durationMs: maxDurationMs,
    beats,
  };
}

export function compactBattlePresentationWindow(
  window: BattlePresentationWindowV1,
): CompactBattlePresentationWindowV1 {
  const facts = new Map<string, CombatVisualFact>();
  const beats = window.plan.beats.map((beat) => ({
    ...beat,
    timeline: {
      ...beat.timeline,
      action: {
        ...beat.timeline.action,
        facts: undefined,
        factIds: beat.timeline.action.facts.map((fact) => {
          facts.set(fact.id, fact);
          return fact.id;
        }),
      },
      commands: beat.timeline.commands.map((command) => {
        if (command.kind !== 'resolve' && command.kind !== 'reaction') {
          return command;
        }
        facts.set(command.fact.id, command.fact);
        const { fact, ...rest } = command;
        return { ...rest, factId: fact.id };
      }),
    },
  }));
  return {
    ...window,
    facts: [...facts.values()],
    plan: { ...window.plan, beats },
  } as CompactBattlePresentationWindowV1;
}

export function battlePresentationSerializedBytes(
  window: CompactBattlePresentationWindowV1,
): number {
  return new TextEncoder().encode(JSON.stringify(window)).byteLength;
}

export function expandBattlePresentationWindow(
  compact: CompactBattlePresentationWindowV1,
): BattlePresentationWindowV1 {
  const facts = new Map(compact.facts.map((fact) => [fact.id, fact]));
  const requireFact = (factId: string) => {
    const fact = facts.get(factId);
    if (!fact) throw new Error(`Missing battle presentation fact: ${factId}`);
    return fact;
  };
  return {
    protocolVersion: compact.protocolVersion,
    resultId: compact.resultId,
    commandSetId: compact.commandSetId,
    startedAt: compact.startedAt,
    readyAcceptedAt: compact.readyAcceptedAt,
    scheduledEndsAt: compact.scheduledEndsAt,
    startingPublicSnapshot: compact.startingPublicSnapshot,
    plan: {
      ...compact.plan,
      beats: compact.plan.beats.map((beat) => ({
        ...beat,
        timeline: {
          ...beat.timeline,
          action: (() => {
            const { factIds, ...action } = beat.timeline.action;
            return { ...action, facts: factIds.map(requireFact) };
          })(),
          commands: beat.timeline.commands.map((command) => {
            if (!('factId' in command)) return command;
            const { factId, ...rest } = command;
            return { ...rest, fact: requireFact(factId) } as CombatVisualCommand;
          }),
        },
      })),
    },
  };
}

function elapsedPlanningMs(view: BattleMatchPlayerViewV1): number {
  if (!view.deadlineAt || view.status !== 'planning') return 0;
  return Math.max(
    0,
    Math.min(30_000, view.serverNow - (view.deadlineAt - 30_000)),
  );
}

function toEntity(
  unit: BattlePublicUnitStateV1,
  viewerTeamId: string,
  elapsedMs: number,
): BattlePresentationEntityV1 {
  return {
    id: unit.unitId,
    name: unit.name,
    team: teamForViewer(unit, viewerTeamId),
    kind: 'cultivator',
    slot: unit.slot,
    x: 0,
    y: 0,
    hp: unit.hp.current,
    maxHp: unit.hp.max,
    qi: unit.mp.current,
    maxQi: unit.mp.max,
    shield: unit.shield,
    alive: unit.alive,
    effects: unit.effects.map((effect) => ({
      id: effect.id,
      label: effect.label,
      tone: effect.statusType === 'buff' ? 'buff' : 'debuff',
      statusType: effect.statusType,
      layers: effect.layers,
      until: effect.permanent
        ? Number.MAX_SAFE_INTEGER
        : elapsedMs + effect.remainingActions * 30_000,
      ...(effect.statusType === 'control'
        ? { controlVisual: 'generic' as const }
        : {}),
    })),
    combatResources: unit.combatResources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      current: resource.current,
      max: resource.max,
    })),
    actionStates: unit.actionStates.map((state) => ({
      id: state.id,
      label: state.label,
      tone:
        state.type === 'rest'
          ? 'control'
          : state.type === 'queued_action'
            ? 'preparing'
            : 'mode',
      until: elapsedMs + state.remainingActions * 30_000,
    })),
  };
}

export function createBattlePresentationSnapshot(
  view: BattleMatchPlayerViewV1,
  focusedEntityId?: string,
): BattlePresentationSnapshotV1 {
  const units = view.publicSnapshot.units;
  const elapsedMs = elapsedPlanningMs(view);
  const fallbackFocus =
    units.find((unit) => unit.teamId === view.teamId && unit.alive)?.unitId ??
    units[0]?.unitId ??
    '';
  return {
    version: 'battle_presentation_snapshot_v1',
    elapsedMs,
    cycle: view.round,
    phase: phaseLabel(view),
    focusedEntityId:
      focusedEntityId && units.some((unit) => unit.unitId === focusedEntityId)
        ? focusedEntityId
        : fallbackFocus,
    entities: units.map((unit) => toEntity(unit, view.teamId, elapsedMs)),
  };
}

/**
 * Creates one deterministic, serializable playback plan. Consecutive engine
 * sequences belonging to the same actor turn are folded into one visual beat;
 * beats never overlap, while targets inside an AOE beat still resolve together.
 */
export function createBattleRoundPlaybackPlan(
  resolution: Pick<
    BattleRoundResolutionV1,
    'commandSetId' | 'round' | 'outcome' | 'sequences'
  >,
  resolveVisual?: (sequence: CombatSequenceV3) => CombatVisualSpec | undefined,
): BattleRoundPlaybackPlanV1 {
  const groups: Array<{
    turn: number;
    actorId: string;
    actions: CombatVisualActionInput[];
    sequenceIds: string[];
    primaryAction?: CombatVisualActionInput;
  }> = [];
  for (const sequence of resolution.sequences) {
    const action = adaptCombatSequenceV3ToVisualAction(sequence, resolveVisual);
    if (!action) continue;
    const actorId = sequence.actor?.id ?? action.sourceId;
    const previous = groups[groups.length - 1];
    if (
      previous &&
      previous.turn === sequence.turn &&
      previous.actorId === actorId
    ) {
      previous.actions.push(action);
      previous.sequenceIds.push(sequence.id);
      if (sequence.phase === 'action') previous.primaryAction = action;
    } else {
      groups.push({
        turn: sequence.turn,
        actorId,
        actions: [action],
        sequenceIds: [sequence.id],
        primaryAction: sequence.phase === 'action' ? action : undefined,
      });
    }
  }

  let cursor = 0;
  const beats = groups.map((group, index): BattlePlaybackBeatV1 => {
    const action = mergeVisualActions(
      group.actions,
      index,
      group.primaryAction,
    );
    const timeline = projectCombatVisualAction(action);
    const beat = {
      index,
      actorId: group.actorId,
      actionId: action.id,
      sequenceIds: group.sequenceIds,
      startAt: cursor,
      duration: timeline.duration,
      timeline,
    };
    cursor += timeline.duration + BEAT_GAP_MS;
    return beat;
  });
  return {
    version: 'battle_round_playback_plan_v1',
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    durationMs: Math.max(0, cursor - (beats.length > 0 ? BEAT_GAP_MS : 0)),
    beats,
  };
}

function mergeVisualActions(
  actions: readonly CombatVisualActionInput[],
  index: number,
  explicitPrimary?: CombatVisualActionInput,
): CombatVisualActionInput {
  const primary =
    explicitPrimary ??
    actions.find((action) => action.facts.length > 0) ??
    actions[0];
  return {
    ...primary,
    id: `${primary.id}:beat-${index}`,
    targetIds: [...new Set(actions.flatMap((action) => action.targetIds))],
    facts: actions.flatMap((action) => action.facts),
  };
}

export function createBattlePresentationSnapshotFromPublic(
  publicSnapshot: BattlePublicSnapshotV1,
  viewerTeamId: string,
  options: {
    elapsedMs?: number;
    cycle?: number;
    phase?: string;
    focusedEntityId?: string;
  } = {},
): BattlePresentationSnapshotV1 {
  const elapsedMs = options.elapsedMs ?? 0;
  const units = publicSnapshot.units;
  const fallbackFocus =
    units.find((unit) => unit.teamId === viewerTeamId && unit.alive)?.unitId ??
    units[0]?.unitId ??
    '';
  return {
    version: 'battle_presentation_snapshot_v1',
    elapsedMs,
    cycle: options.cycle ?? publicSnapshot.round,
    phase: options.phase ?? '回合演算',
    focusedEntityId:
      options.focusedEntityId &&
      units.some((unit) => unit.unitId === options.focusedEntityId)
        ? options.focusedEntityId
        : fallbackFocus,
    entities: units.map((unit) => toEntity(unit, viewerTeamId, elapsedMs)),
  };
}

/** Applies one already-resolved public fact to the renderer's temporary state. */
export function applyCombatVisualFactToSnapshot(
  snapshot: BattlePresentationSnapshotV1,
  fact: CombatVisualFact,
  elapsedMs: number,
): BattlePresentationSnapshotV1 {
  const targets = new Set(fact.targetIds);
  return {
    ...snapshot,
    elapsedMs,
    entities: snapshot.entities.map((entity) => {
      if (!targets.has(entity.id)) return entity;
      switch (fact.kind) {
        case 'damage': {
          const absorbed = Math.min(
            entity.shield,
            Math.max(0, fact.shieldAbsorbed ?? 0),
          );
          const hpDamage = Math.max(0, fact.hpDamage ?? fact.amount - absorbed);
          return {
            ...entity,
            shield: Math.max(0, entity.shield - absorbed),
            hp: Math.max(0, entity.hp - hpDamage),
          };
        }
        case 'recovery':
          return fact.resource === 'hp'
            ? { ...entity, hp: Math.min(entity.maxHp, entity.hp + fact.amount) }
            : {
                ...entity,
                qi: Math.min(entity.maxQi, entity.qi + fact.amount),
              };
        case 'shield':
          return {
            ...entity,
            shield:
              fact.operation === 'break'
                ? 0
                : fact.operation === 'gain'
                  ? entity.shield + fact.amount
                  : Math.max(0, entity.shield - fact.amount),
          };
        case 'resource': {
          if (fact.resourceId === 'mp')
            return {
              ...entity,
              qi: Math.max(0, Math.min(entity.maxQi, fact.after)),
            };
          return {
            ...entity,
            combatResources: entity.combatResources.map((resource) =>
              resource.id === fact.resourceId
                ? { ...resource, current: fact.after }
                : resource,
            ),
          };
        }
        case 'status': {
          const effects = entity.effects.filter(
            (effect) => effect.id !== fact.statusId,
          );
          if (fact.operation === 'remove' || fact.operation === 'immune')
            return { ...entity, effects };
          return {
            ...entity,
            effects: [
              ...effects,
              {
                id: fact.statusId,
                label: fact.statusName,
                tone: fact.statusType === 'buff' ? 'buff' : 'debuff',
                statusType: fact.statusType,
                layers: fact.layers ?? 1,
                until: elapsedMs + (fact.durationMs ?? 30_000),
                controlVisual: fact.controlVisual,
              },
            ],
          };
        }
        case 'action_state': {
          const id = `${fact.stateType}:${fact.stateName}`;
          const actionStates = entity.actionStates.filter(
            (state) => state.id !== id,
          );
          if (fact.phase !== 'entered') return { ...entity, actionStates };
          return {
            ...entity,
            actionStates: [
              ...actionStates,
              {
                id,
                label: fact.stateName,
                tone:
                  fact.stateType === 'rest'
                    ? 'control'
                    : fact.stateType === 'queued_action'
                      ? 'preparing'
                      : 'mode',
                until: elapsedMs + (fact.durationMs ?? 30_000),
              },
            ],
          };
        }
        case 'unit_died':
          return {
            ...entity,
            hp: 0,
            shield: 0,
            alive: false,
            actionStates: [],
          };
        case 'death_prevented':
          return { ...entity, alive: true, hp: Math.max(1, entity.hp) };
        default:
          return entity;
      }
    }),
  };
}
