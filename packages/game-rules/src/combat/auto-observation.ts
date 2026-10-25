import type { BattleState, StatusDef, Unit } from '@daoyou/combat-core/types';
import { effectiveAttrs } from '@daoyou/combat-core/units';
import { DAO_RAGE_RESOURCE_ID } from '@daoyou/game-domain/equipment';

export type AutoObservation = { round: number; units: Unit[] };

const PUBLIC_BAR = 10000;

function publicRatio(current: number, max: number): number {
  return (
    Math.floor((current / Math.max(1, max)) * PUBLIC_BAR) / PUBLIC_BAR
  );
}

/**
 * 己方人物和灵兽保留完整面板。敌方只保留可见事实：等级、气血和法力比例、
 * 人物战意、护盾剩余值、状态。攻防、命中、闪避、修为和速度不复制，也不用主人的面板填上。
 */
export function observeAutoBattle(
  state: BattleState,
  ownerId: string,
  statusDefs: readonly StatusDef[],
): AutoObservation {
  const owner = state.units.find((unit) => unit.id === ownerId);
  const controlledIds = new Set(
    state.units
      .filter((unit) => unit.id === ownerId || unit.ownerId === ownerId)
      .map((unit) => unit.id),
  );
  const definitions = new Map(statusDefs.map((status) => [status.id, status]));
  return {
    round: state.round,
    units: state.units
      .filter((unit) => !unit.flags.benched)
      .map((unit) => {
        const owned = owner ? unit.side === owner.side : unit.id === ownerId;
        const hpRatio = publicRatio(unit.attrs.hp, unit.attrs.maxHp);
        const mpRatio = publicRatio(unit.attrs.mp, unit.attrs.maxMp);
        const attrs = owned
          ? effectiveAttrs(unit)
          : {
              hp: hpRatio * PUBLIC_BAR,
              maxHp: PUBLIC_BAR,
              mp: mpRatio * PUBLIC_BAR,
              maxMp: PUBLIC_BAR,
              physicalAtk: 0,
              physicalDef: 0,
              magicAtk: 0,
              magicDef: 0,
              healPower: 0,
              speed: 0,
              hit: 0,
              dodge: 0,
              critRate: 0,
              spellCritRate: 0,
              physicalFuryRate: 0,
              sealHit: 0,
              sealResist: 0,
              attackCultivate: 0,
              defenseCultivate: 0,
              spellCultivate: 0,
              resistSpellCultivate: 0,
            };
        return {
          id: unit.id,
          name: unit.name,
          side: unit.side,
          slot: unit.slot,
          kind: unit.kind,
          ownerId: unit.ownerId,
          level: unit.level,
          attrs,
          wound: owned ? unit.wound : 0,
          skills: owned ? [...unit.skills] : [],
          passives: owned ? [...unit.passives] : [],
          combatFacts: owned
            ? { ...unit.combatFacts }
            : unit.combatFacts?.isCharacter === 1 ||
                unit.combatFacts?.isBeast === 1
              ? {
                  isCharacter: Number(unit.combatFacts.isCharacter === 1),
                  isBeast: Number(unit.combatFacts.isBeast === 1),
                }
              : undefined,
          skillUses: owned ? { ...unit.skillUses } : undefined,
          hpDamageThisRound: owned && unit.hpDamageThisRound ? { ...unit.hpDamageThisRound } : undefined,
          hpLossThisRound: owned && unit.hpLossThisRound ? { ...unit.hpLossThisRound } : undefined,
          cooldowns: owned ? { ...unit.cooldowns } : undefined,
          entryRound: owned ? unit.entryRound : undefined,
          spellActionsSinceEntry: owned ? unit.spellActionsSinceEntry : undefined,
          skillLevels: owned ? { ...unit.skillLevels } : {},
          skillOverrides: owned ? structuredClone(unit.skillOverrides) : {},
          tags: owned ? [...unit.tags] : [],
          marks: [],
          resources: owned
            ? structuredClone(unit.resources)
            : unit.kind === 'player'
              ? structuredClone(
                  unit.resources.filter(
                    (resource) => resource.id === DAO_RAGE_RESOURCE_ID,
                  ),
                )
              : [],
          barriers: unit.barriers.map((barrier) => ({
            id: barrier.id,
            kind: barrier.kind,
            name: barrier.name,
            current: barrier.current,
            remainingRounds: barrier.remainingRounds,
            sourceId: '',
            appliedRound: 0,
          })),
          statuses: unit.statuses.map((status) => ({
            id: status.id,
            kind: definitions.get(status.id)?.kind ?? status.kind,
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
            skipNextAction: owned ? unit.flags.skipNextAction : false,
          },
        };
      }),
  };
}
