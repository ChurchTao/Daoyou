import { TOWER_ENCOUNTER_PACK } from '../../../lib/tower/encounter-pack';
import { TOWER_FORMATIONS } from '../../../lib/tower/formations';
import { resolveTowerFloorKind } from '../../../lib/tower/helpers';
import {
  towerCombination,
  towerEnemyPreview,
  type TowerWeek,
} from '../../../lib/tower/weekly';
import type { RealmType } from '../../../types/constants';
import {
  UnitKind,
  type CreateBattleInput,
  type SkillDef,
  type StatusDef,
} from '../core';
import { combatCharacterLevel } from '../projection/character-level';

// Fixed realm baselines, independently editable. No player/blessing input participates.
export const TOWER_REALM_BASELINES = TOWER_ENCOUNTER_PACK.baselines;
export type TowerNpcPlan = { cycle: string[] };
export const TOWER_STATUS_DEFS: StatusDef[] = [
  {
    id: 'tower.mirror-anchor',
    name: '镜阵核心',
    kind: 'tower.mirror-anchor',
    untilBattleEnd: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'tower.mirror-cover',
    name: '镜侍护主',
    kind: 'tower.mirror-cover',
    category: 'buff',
    maxStacks: 2,
    expireSameRound: true,
    dispellable: false,
    extendable: false,
  },
  {
    id: 'tower.fury',
    name: '碎梦',
    kind: 'tower.fury',
    category: 'buff',
    untilBattleEnd: true,
    damageDealtPhysical: 1.15,
    damageDealtSpell: 1.15,
  },
  {
    id: 'tower.exposed',
    name: '破绽',
    kind: 'tower.exposed',
    category: 'debuff',
    damageTakenPhysical: 1.25,
    damageTakenSpell: 1.25,
  },
  {
    id: 'tower.bound',
    name: '缚梦',
    kind: 'tower.bound',
    category: 'control',
    blocksSpell: true,
    blocksPhysical: true,
  },
];
export const TOWER_SKILLS: SkillDef[] = [
  {
    id: 'tower.mirror-master',
    name: '镜阵',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    innate: {
      entryStatus: {
        statusId: 'tower.mirror-anchor',
        minDuration: 1,
        maxDuration: 1,
      },
    },
    hooks: [
      {
        on: 'onHitCalc',
        targetIsSelf: true,
        when: { targetStatusStack: { statusId: 'tower.mirror-cover', min: 1 } },
        effects: [
          { type: 'modifyStrike', factor: '1 - 0.15 * targetStatusStacks' },
        ],
      },
    ],
  },
  {
    id: 'tower.mirror-guard',
    name: '镜侍护主',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        when: { sourceStanding: true },
        targeting: {
          side: 'ally',
          mode: 'all',
          count: 1,
          requireStatusIds: ['tower.mirror-anchor'],
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'tower.mirror-cover',
            duration: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'tower.support-strike',
    name: '幻影轻击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1, resultFactors: [0.25] }],
  },
  {
    id: 'tower.last-stand',
    name: '碎梦',
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onRoundStart',
        aim: 'self',
        when: {
          sourceHpRatioBelow: 0.4,
          sourceStanding: true,
          oncePerBattle: true,
        },
        effects: [
          {
            type: 'applyStatus',
            statusId: 'tower.fury',
            duration: 1,
            self: true,
          },
        ],
      },
    ],
  },
  {
    id: 'tower.strike',
    name: '裂影斩',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', coeff: 1.15 }],
  },
  {
    id: 'tower.double',
    name: '叠浪双斩',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'physicalHit', hits: 2, coeff: 0.72 }],
  },
  {
    id: 'tower.charge',
    name: '蓄势',
    tags: ['support'],
    targeting: { side: 'self' },
    effects: [
      { type: 'emitMechanic', mechanicId: 'tower.charge', name: '蓄势' },
    ],
  },
  {
    id: 'tower.heavy',
    name: '负碑重击',
    tags: ['physical'],
    targeting: { side: 'enemy', count: 1 },
    effects: [
      { type: 'physicalHit', coeff: 1.8 },
      {
        type: 'applyStatus',
        statusId: 'tower.exposed',
        duration: 1,
        self: true,
      },
    ],
  },
  {
    id: 'tower.bolt',
    name: '碎镜灵光',
    tags: ['spell'],
    costMp: 8,
    targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'spellHit', coeff: 1, power: 30 }],
  },
  {
    id: 'tower.wave',
    name: '照影潮',
    tags: ['spell'],
    costMp: 18,
    targeting: { side: 'enemy', mode: 'fill', count: 2 },
    effects: [
      { type: 'spellHit', coeff: 0.7, power: 30 },
      {
        type: 'applyStatus',
        statusId: 'tower.exposed',
        duration: 1,
        self: true,
      },
    ],
  },
  {
    id: 'tower.seal',
    name: '缚梦咒',
    tags: ['spell', 'seal'],
    costMp: 15,
    sealBase: 55,
    targeting: { side: 'enemy', count: 1 },
    effects: [
      {
        type: 'applyStatus',
        statusId: 'tower.bound',
        duration: 1,
        hit: 'seal',
      },
    ],
  },
  {
    id: 'tower.heal',
    name: '续灯',
    tags: ['spell', 'support'],
    costMp: 12,
    targeting: { side: 'ally', mode: 'lowestHp', count: 1 },
    effects: [{ type: 'heal', power: 'source.maxHp * 0.2', fixedBase: true }],
  },
];

export function compileTowerEncounter(
  realm: RealmType,
  floor: number,
  week: TowerWeek,
) {
  if (
    !Number.isInteger(floor) ||
    floor < 1 ||
    floor > 20 ||
    !(realm in TOWER_REALM_BASELINES)
  )
    throw new Error('幻境境界或层数无效');
  const base =
    TOWER_REALM_BASELINES[realm as keyof typeof TOWER_REALM_BASELINES];
  const kind = resolveTowerFloorKind(floor);
  const row = week.floors.find((r) => r.floor === floor);
  const combo =
    kind === 'normal'
      ? undefined
      : row
        ? towerCombination(row.combinationId)
        : undefined;
  if (kind !== 'normal' && !combo) throw new Error('幻境关键层缺少组合');
  const level = combatCharacterLevel(realm, '中期');
  const n = ((floor - 1) % 10) + 1;
  const preview = towerEnemyPreview(floor, week);
  const formation = TOWER_FORMATIONS[preview.formationId];
  const count = formation.roles.length;
  const guarded = formation.roles.some((role) => role === 'guard');
  const style = combo?.style ?? ([3, 7].includes(n) ? 'spell' : 'physical');
  const scaling = TOWER_ENCOUNTER_PACK.scaling;
  const typeHp = scaling.types[kind].hp;
  const typeOutput = scaling.types[kind].output;
  const hpMod = combo?.survival === 'vital' ? 1.15 : combo ? 0.92 : 1;
  const hpPool = Math.round(
    base.hp *
      (1 + scaling.hpGrowth * (floor - 1)) *
      typeHp *
      hpMod *
      formation.hpScale,
  );
  const output =
    (1 + scaling.outputGrowth * (floor - 1)) *
    typeOutput *
    (kind === 'boss' ? 0.95 : 1) *
    (style === 'seal' ? 0.65 : 1);
  const plans: Record<string, TowerNpcPlan> = {};
  let assignedHp = 0;
  const units: CreateBattleInput['units'] = Array.from(
    { length: count },
    (_, slot) => {
      const role = formation.roles[slot];
      const support = role === 'healer' || role === 'guard';
      const traits = support ? undefined : combo;
      const share = formation.hpShares[slot];
      const hp =
        slot === count - 1 ? hpPool - assignedHp : Math.round(hpPool * share);
      assignedHp += hp;
      const physicalDef = Math.round(
        base.physicalDef *
          (1 + scaling.defenseGrowth * (floor - 1)) *
          (support
            ? 0.65
            : traits?.survival === 'armor'
              ? 1.25
              : traits
                ? 0.8
                : 1),
      );
      const magicDef = Math.round(
        base.magicDef *
          (1 + scaling.defenseGrowth * (floor - 1)) *
          (support
            ? 0.65
            : traits?.survival === 'ward'
              ? 1.2
              : traits
                ? 0.8
                : 1),
      );
      // Grow the damage above reference defense, not the entire attack field.
      const atkShare = formation.outputShares[slot];
      const physicalAtk = Math.round(
        base.referencePhysicalDef +
          (base.physicalAtk - base.referencePhysicalDef) * output * atkShare,
      );
      const magicAtk = Math.round(
        base.referenceMagicDef +
          (base.magicAtk - base.referenceMagicDef) * output * atkShare,
      );
      const cycle =
        role === 'healer'
          ? ['tower.support-strike', 'tower.support-strike', 'tower.heal']
          : role === 'guard'
            ? ['tower.support-strike']
            : combo?.tempo === 'charge'
              ? ['tower.charge', 'tower.heavy', 'attack']
              : style === 'seal'
                ? ['tower.seal', 'tower.bolt', 'tower.bolt']
                : style === 'spell'
                  ? ['tower.bolt', 'tower.bolt', 'tower.wave']
                  : kind === 'normal'
                    ? ['attack', 'attack', 'tower.strike']
                    : ['tower.strike', 'tower.strike', 'tower.double'];
      const id = `tower.enemy.${slot}`;
      plans[id] = { cycle };
      return {
        id,
        name: preview.members[slot].name,
        side: 1,
        slot,
        kind: UnitKind.Npc,
        level,
        attrs: {
          hp,
          maxHp: hp,
          mp: role === 'healer' ? 36 : 1500,
          maxMp: role === 'healer' ? 36 : 1500,
          physicalAtk,
          magicAtk,
          physicalDef,
          magicDef,
          speed: Math.round(
            base.speed *
              (support
                ? 0.85
                : traits?.tempo === 'swift'
                  ? 1.1
                  : traits?.tempo === 'charge'
                    ? 0.8
                    : 0.95),
          ),
          hit: base.hit,
          dodge: base.dodge,
          critRate: 0.03,
          spellCritRate: 0.03,
          sealHit: 45,
          sealResist: traits?.tempo === 'calm' ? 60 : 50,
        },
        skills: [...new Set(cycle.filter((s) => s !== 'attack'))],
        passives: [
          ...(kind === 'boss' && role === 'leader' ? ['tower.last-stand'] : []),
          ...(guarded && role === 'leader'
            ? ['tower.mirror-master']
            : role === 'guard'
              ? ['tower.mirror-guard']
              : []),
        ],
        tags: [],
      };
    },
  );
  return { units, plans, skills: TOWER_SKILLS, statusDefs: TOWER_STATUS_DEFS };
}
