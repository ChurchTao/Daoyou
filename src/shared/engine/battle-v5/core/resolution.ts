import type { Unit } from '../units/Unit';
import { getBattleRuntimeState } from './runtimeState';

/**
 * Stable identity for one combat action and its nested resolution tree.
 *
 * These identities are deliberately separate from EventBus trace ids: a
 * trace answers "what caused this event", while this context answers "which
 * action/cast/hit does this event belong to".
 */
export interface CombatResolutionContext {
  readonly actionId: string;
  readonly castId: string;
  readonly hitId: string;
  readonly caster: Unit;
  readonly target: Unit;
  readonly segmentIndex?: number;
  readonly segmentCount?: number;
}

export interface CombatResolutionSeed {
  readonly actionId: string;
  readonly castId: string;
  readonly caster: Unit;
  readonly target: Unit;
  readonly hitIndex?: number;
}

export function requireResolution(input: {
  resolution?: CombatResolutionContext;
  triggerEvent?: { resolution?: CombatResolutionContext };
}): CombatResolutionContext {
  const resolution = input.resolution ?? input.triggerEvent?.resolution;
  if (!resolution) {
    throw new Error('Combat effect requires an explicit resolution context');
  }
  return resolution;
}
export function createHitResolution(
  seed: CombatResolutionSeed,
  target: Unit = seed.target,
): CombatResolutionContext {
  const hitIndex = seed.hitIndex ?? 0;
  if (!Number.isInteger(hitIndex) || hitIndex < 0) {
    throw new Error('Hit index must be a non-negative integer');
  }
  return Object.freeze({
    ...seed,
    target,
    hitId: `${seed.castId}:hit:${target.id}:${hitIndex}`,
  });
}

export function withDamageSegment(
  context: CombatResolutionContext,
  segmentIndex: number,
  segmentCount?: number,
): CombatResolutionContext {
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
    throw new Error('Damage segment index must be a non-negative integer');
  }
  if (
    segmentCount !== undefined &&
    (!Number.isInteger(segmentCount) || segmentCount <= segmentIndex)
  ) {
    throw new Error('Damage segment count must be greater than its index');
  }
  return Object.freeze({ ...context, segmentIndex, segmentCount });
}

/** Allocate the next segment identity for a hit in execution order. */
export function nextDamageSegment(
  context: CombatResolutionContext,
  segmentCount?: number,
): CombatResolutionContext {
  const state = getBattleRuntimeState(context.caster);
  const segmentIndex = state.damageSegmentCounters.get(context.hitId) ?? 0;
  state.damageSegmentCounters.set(context.hitId, segmentIndex + 1);
  return withDamageSegment(context, segmentIndex, segmentCount);
}

export function consumeDamageSegmentCount(
  context: CombatResolutionContext,
): number {
  const state = getBattleRuntimeState(context.caster);
  const count = state.damageSegmentCounters.get(context.hitId) ?? 0;
  state.damageSegmentCounters.delete(context.hitId);
  return count;
}
