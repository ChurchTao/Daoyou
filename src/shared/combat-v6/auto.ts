import { z } from 'zod';
import type { CombatV6CommandGroup } from '../contracts/combatV6';
import type {
  BattleState,
  CombatV6CommandOptions,
  SkillDef,
  SkillEffect,
  Unit,
} from '../engine/combat-v6/core';
import { controlledUnits } from './controlled-commands';

export const AUTO_POLICY_VERSION = 'combat_auto_v1' as const;
export const AUTO_DELAY_MS = 3000;
export const CombatAutoRequestSchema = z
  .object({
    type: z.literal('AUTO'),
    round: z.number().int().positive(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

/** Content order is frozen with the build. Querying candidates never advances battle RNG. */
export function automaticCommands(
  state: BattleState,
  ownerId: string,
  skills: readonly SkillDef[],
  query: (id: string) => CombatV6CommandOptions,
): CombatV6CommandGroup {
  const definitions = new Map(skills.map((skill) => [skill.id, skill]));
  return controlledUnits(state, ownerId).map((unit) => {
    if (unit.command)
      return {
        unitId: unit.id,
        command: unit.command as CombatV6CommandGroup[number]['command'],
      };
    const options = query(unit.id);
    const candidates = options.skills
      .flatMap((option, order) => {
        const skill =
          unit.skillOverrides[option.skillId] ??
          definitions.get(option.skillId);
        // Deferred player commands may be "ready" even without enough MP. Do not spend a turn on them.
        if (!skill || skill.capture || !option.ready || option.reasons.length)
          return [];
        const targets = option.selectableTargetIds.flatMap((id) => {
          const target = state.units.find((u) => u.id === id);
          return target ? [target] : [];
        });
        const effects = flattenEffects([
          ...skill.effects,
          ...(skill.successEffects ?? []),
        ]);
        const revive = effects.some((e) => e.type === 'revive');
        const heal = effects.some(
          (e) => e.type === 'heal' || e.type === 'restoreHp',
        );
        const offense = effects.some((e) =>
          ['physicalHit', 'spellHit', 'fixedHit', 'damageMp', 'wound'].includes(
            e.type,
          ),
        );
        const statuses = effects.flatMap((e) =>
          e.type === 'applyStatus' ? [e.statusId] : [],
        );
        const useful = targets
          .filter((target) => {
            if (revive)
              return (
                target.side === unit.side &&
                target.flags.downed &&
                !target.flags.dead
              );
            if (target.flags.dead || target.flags.downed) return false;
            if (heal) return target.side === unit.side && hpRatio(target) < 0.6;
            if (offense) return target.side !== unit.side;
            if (statuses.length)
              return statuses.some(
                (id) => !target.statuses.some((s) => s.id === id),
              );
            return false;
          })
          .sort(
            (a, b) =>
              (heal ? hpRatio(a) - hpRatio(b) : 0) ||
              a.slot - b.slot ||
              (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
          );
        if (!useful.length) return [];
        return [
          {
            option,
            targets: useful,
            priority: revive ? 0 : heal ? 1 : offense ? 2 : 3,
            order,
          },
        ];
      })
      .sort((a, b) => a.priority - b.priority || a.order - b.order);
    const selected = candidates[0];
    if (selected)
      return {
        unitId: unit.id,
        command: {
          type: 'skill' as const,
          skillId: selected.option.skillId,
          targets: selected.targets
            .slice(0, selected.option.targetCount)
            .map((u) => u.id),
        },
      };
    const target = options.attackTargetIds[0];
    return {
      unitId: unit.id,
      command: target
        ? { type: 'attack' as const, target }
        : { type: 'defend' as const },
    };
  });
}
function hpRatio(unit: Unit) {
  return unit.attrs.hp / Math.max(1, unit.attrs.maxHp);
}
function flattenEffects(effects: readonly SkillEffect[]): SkillEffect[] {
  return effects.flatMap((effect) =>
    effect.type === 'randomBranch'
      ? flattenEffects([...effect.successEffects, ...effect.failureEffects])
      : [effect],
  );
}
