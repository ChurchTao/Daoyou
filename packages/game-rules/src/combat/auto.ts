

import type { CombatV6CommandGroup } from '@daoyou/game-domain/combat';

import type { BattleState, CombatV6CommandOptions, SkillDef, StatusDef } from '@daoyou/combat-core/types';
import { isActiveAttackSkill } from '@daoyou/combat-core';

import { observeAutoBattle } from './auto-observation.js';

import {
  AUTO_POLICY_VERSION,
  type AutoStrategy,
} from '@daoyou/game-domain/combat/auto';


import { chooseStrategyCandidate } from './auto-strategy.js';

import {
  rankAutoActions,
  type AutoCandidate,
  type AutoIntent,
} from './auto-utility.js';

import { controlledUnits } from './controlled-commands.js';


export { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';

export const AUTO_DELAY_MS = 3000;


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
      ? chooseBeastCandidate(candidates, skills, unit.skillOverrides, options.statusDefs ?? [])
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
  statusDefs: readonly StatusDef[],
): AutoCandidate | undefined {
  const attack = candidates.find((entry) => entry.command.type === 'attack');
  const skillAction = candidates.find((entry) => {
    if (entry.command.type !== 'skill') return false;
    const skillId = entry.command.skillId;
    const skill = overrides[skillId] ?? skills.find((item) => item.id === skillId);
    return skill && (isActiveAttackSkill(skill) || skill.effects.some(effect =>
      effect.type === 'invokeAttackSkills' ||
      (effect.type === 'applyStatus' && statusDefs.some(status =>
        status.id === effect.statusId &&
        ((status.damageTakenSpell ?? 1) < 1 || (status.damageTakenPhysical ?? 1) < 1),
      )),
    ));
  });
  // Offense and protective arts compete with ordinary attacks after target,
  // current protection, health and resource cost have been valued.
  return skillAction && (!attack || skillAction.score > attack.score) ? skillAction : attack ?? candidates[0];
}
