import type { BattleState, StatusDef, Unit } from '@daoyou/combat-core/types';
import { effectiveAttrs } from '@daoyou/combat-core/units';

export type AutoObservation = { round: number; units: Unit[] };

/** Same ownership boundary and basis-point bars as the public arena view.
 * Unit is reused only for pure expression/formula evaluation. Hidden fields are
 * reconstructed, never copied. Unknown attributes use the observer's baseline.
 */
export function observeAutoBattle(
  state: BattleState,
  ownerId: string,
  statusDefs: readonly StatusDef[],
): AutoObservation {
  const owner = state.units.find((unit) => unit.id === ownerId)!;
  const controlledIds = new Set(
    state.units
      .filter((unit) => unit.id === ownerId || unit.ownerId === ownerId)
      .map((unit) => unit.id),
  );
  const definitions = new Map(statusDefs.map((status) => [status.id, status]));
  const baseline = effectiveAttrs(owner);
  return {
    round: state.round,
    units: state.units
      .filter((unit) => !unit.flags.benched)
      .map((unit) => {
        const owned = unit.id === ownerId || unit.ownerId === ownerId;
        const attrs = owned ? effectiveAttrs(unit) : { ...baseline };
        if (!owned) {
          attrs.hp =
            (Math.floor(
              (unit.attrs.hp / Math.max(1, unit.attrs.maxHp)) * 10000,
            ) /
              10000) *
            attrs.maxHp;
          attrs.mp =
            (Math.floor(
              (unit.attrs.mp / Math.max(1, unit.attrs.maxMp)) * 10000,
            ) /
              10000) *
            attrs.maxMp;
        }
        return {
          id: unit.id,
          name: unit.name,
          side: unit.side,
          slot: unit.slot,
          kind: unit.kind,
          ownerId: unit.ownerId,
          level: owned ? unit.level : owner.level,
          attrs,
          wound: owned ? unit.wound : 0,
          skills: owned ? [...unit.skills] : [],
          passives: owned ? [...unit.passives] : [],
          combatFacts: owned ? { ...unit.combatFacts }
            : unit.combatFacts?.isCharacter === 1 || unit.combatFacts?.isBeast === 1
              ? { isCharacter: Number(unit.combatFacts?.isCharacter === 1), isBeast: Number(unit.combatFacts?.isBeast === 1) }
              : undefined,
          skillUses: owned ? { ...unit.skillUses } : undefined,
          cooldowns: owned ? { ...unit.cooldowns } : undefined,
          entryRound: owned ? unit.entryRound : undefined,
          spellActionsSinceEntry: owned ? unit.spellActionsSinceEntry : undefined,
          skillLevels: owned ? { ...unit.skillLevels } : {},
          skillOverrides: owned ? structuredClone(unit.skillOverrides) : {},
          tags: owned ? [...unit.tags] : [],
          marks: [],
          resources: owned ? structuredClone(unit.resources) : [],
          barriers: unit.barriers.map((barrier) => ({
            id: barrier.id,
            kind: barrier.kind,
            name: barrier.name,
            current: owned
              ? barrier.current
              : (Math.floor(
                  (barrier.current / Math.max(1, unit.attrs.maxHp)) * 10000,
                ) /
                  10000) *
                attrs.maxHp,
            remainingRounds: barrier.remainingRounds,
            sourceId: '',
            appliedRound: 0,
          })),
          statuses: unit.statuses.map((status) => ({
            id: status.id,
            kind: definitions.get(status.id)?.kind ?? '',
            remainingRounds: status.remainingRounds,
            stacks: status.stacks,
            sourceId: controlledIds.has(status.sourceId) ? status.sourceId : '',
            appliedRound: 0,
            speedMod: 0,
            attrMods: {},
            damageTakenPhysical: 1,
            damageTakenSpell: 1,
            healTaken: 1,
            healDealt: 1,
          })),
          flags: {
            dead: unit.flags.dead,
            downed: unit.flags.downed,
            escaped: unit.flags.escaped,
            benched: false,
            defending: false,
            auto: false,
            skipNextAction: false,
          },
        };
      }),
  };
}
