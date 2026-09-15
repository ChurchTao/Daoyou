import type { BattleState, StatusDef, Unit } from '../engine/combat-v6/core';
import { effectiveAttrs } from '../engine/combat-v6/core/units';

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
          passives: [],
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
            sourceId: '',
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
