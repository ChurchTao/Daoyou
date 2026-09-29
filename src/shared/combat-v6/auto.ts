import { z } from 'zod';
import type { CombatV6CommandGroup } from '../contracts/combatV6';
import type {
  BattleState,
  CombatV6CommandOptions,
  SkillDef,
  StatusDef,
} from '../engine/combat-v6/core';
import { observeAutoBattle } from './auto-observation';
import { AUTO_POLICY_VERSION } from './auto-policy';
import { chooseStrategyCandidate, type AutoStrategy } from './auto-strategy';
import {
  rankAutoActions,
  type AutoCandidate,
  type AutoIntent,
} from './auto-utility';
import { controlledUnits } from './controlled-commands';

export { AUTO_POLICY_VERSION } from './auto-policy';
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
  strategies?: Readonly<Record<string, AutoStrategy | undefined>>;
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
  // Frozen rules from an older policy cannot be replayed under this selector.
  // Keep the battle playable with the ordinary utility fallback.
  const strategies =
    state.versions.autoPolicyVersion !== AUTO_POLICY_VERSION
      ? undefined
      : options.strategies;
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
      intents,
    ).filter((candidate) => {
      if (candidate.command.type !== 'skill') return true;
      const skillId = candidate.command.skillId;
      const skill =
        unit.skillOverrides[skillId] ??
        skills.find((item) => item.id === skillId);
      if (!skill) return true;
      // A transfer skill removes this caster's old status before applying it
      // elsewhere. An absent-status target alone must not trigger recasting.
      const transferredKinds = skill.effects.flatMap((effect) =>
        effect.type === 'removeStatus' &&
        effect.ownedOnly &&
        effect.targeting?.side === 'ally' &&
        effect.targeting.mode === 'all'
          ? effect.kinds ?? []
          : [],
      );
      if (!transferredKinds.length) return true;
      const statusIds = skill.effects.flatMap((effect) =>
        effect.type === 'applyStatus' &&
        options.statusDefs?.some(
          (status) =>
            status.id === effect.statusId &&
            transferredKinds.includes(status.kind),
        )
          ? [effect.statusId]
          : [],
      );
      if (!statusIds.length) return true;
      return !observation.units.some((target) =>
        target.side === unit.side &&
        !target.flags.dead &&
        !target.flags.downed &&
        !target.flags.escaped &&
        target.statuses.some(
          (status) =>
            statusIds.includes(status.id) && status.sourceId === unit.id,
        ),
      );
    });
    options.explain?.({
      unitId: unit.id,
      version: AUTO_POLICY_VERSION,
      candidates,
    });
    const selected = unit.kind === 'pet'
      ? chooseBeastCandidate(candidates, skills, unit.skillOverrides)
      : chooseStrategyCandidate(observation, unit.id, candidates, strategies?.[unit.id]);
    if (selected) intents.push(...selected.intents);
    return {
      unitId: unit.id,
      command: (selected?.command ?? {
        type: 'defend',
      }) as CombatV6CommandGroup[number]['command'],
    };
  });
}

function chooseBeastCandidate(
  candidates: AutoCandidate[],
  skills: readonly SkillDef[],
  overrides: Record<string, SkillDef>,
): AutoCandidate | undefined {
  const attack = candidates.find((entry) => entry.command.type === 'attack');
  const spell = candidates.find((entry) => {
    if (entry.command.type !== 'skill') return false;
    const skillId = entry.command.skillId;
    const skill = overrides[skillId] ?? skills.find((item) => item.id === skillId);
    return skill?.effects.some((effect) => effect.type === 'spellHit');
  });
  // A pet's active offensive spell must outperform its physical attack after
  // target, hit chance and resource cost; defensive arts do not mark it a caster.
  return spell && (!attack || spell.score > attack.score) ? spell : attack ?? candidates[0];
}
