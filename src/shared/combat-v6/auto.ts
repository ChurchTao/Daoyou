import { z } from 'zod';
import type { CombatV6CommandGroup } from '../contracts/combatV6';
import type {
  BattleState,
  CombatV6CommandOptions,
  SkillDef,
  StatusDef,
} from '../engine/combat-v6/core';
import { observeAutoBattle } from './auto-observation';
import { AUTO_POLICY_VERSION, type AutoPolicy } from './auto-policy';
import {
  rankAutoActions,
  type AutoCandidate,
  type AutoIntent,
} from './auto-utility';
import { controlledUnits } from './controlled-commands';

export { AUTO_POLICIES, AUTO_POLICY_VERSION } from './auto-policy';
export const AUTO_DELAY_MS = 3000;
export const CombatAutoRequestSchema = z
  .object({
    type: z.literal('AUTO'),
    round: z.number().int().positive(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type AutoOptions = {
  statusDefs?: readonly StatusDef[];
  policy?: AutoPolicy;
  /** Internal opt-in diagnostics, never persisted or sent to players by default. */
  explain?: (decision: {
    unitId: string;
    version: typeof AUTO_POLICY_VERSION;
    candidates: AutoCandidate[];
  }) => void;
};

/** Explicit AUTO only. The core's timeout/default-command semantics stay separate. */
export function automaticCommands(
  state: BattleState,
  ownerId: string,
  skills: readonly SkillDef[],
  query: (id: string) => CombatV6CommandOptions,
  options: AutoOptions = {},
): CombatV6CommandGroup {
  const observation = observeAutoBattle(
    state,
    ownerId,
    options.statusDefs ?? [],
  );
  const intents: AutoIntent[] = [];
  return controlledUnits(state, ownerId).map((unit) => {
    // Only the controlled group's own already-submitted commands are inspected.
    if (unit.command)
      return {
        unitId: unit.id,
        command: unit.command as CombatV6CommandGroup[number]['command'],
      };
    const candidates = rankAutoActions(
      observation,
      unit.id,
      skills,
      options.statusDefs ?? [],
      query(unit.id),
      options.policy,
      intents,
    );
    options.explain?.({
      unitId: unit.id,
      version: AUTO_POLICY_VERSION,
      candidates,
    });
    const selected = candidates[0];
    if (selected) intents.push(...selected.intents);
    return {
      unitId: unit.id,
      command: (selected?.command ?? {
        type: 'defend',
      }) as CombatV6CommandGroup[number]['command'],
    };
  });
}
