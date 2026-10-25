import { describe, expect, it } from 'vitest';
import { createUnit } from '@daoyou/combat-core';
import type { CombatV6CommandOptions, SkillDef, StatusDef, Unit } from '@daoyou/combat-core/types';
import { rankAutoActions } from './auto-utility.js';

const barrierPassive: SkillDef = {
  id: 'defense-ward',
  name: '防御生盾',
  tags: ['passive'],
  targeting: { side: 'self' },
  effects: [],
  hooks: [{
    on: 'afterDefend',
    sourceIsSelf: true,
    effects: [{
      type: 'applyBarrier',
      id: 'defense-ward.barrier',
      kind: 'defense-ward',
      name: '防御护盾',
      power: 'source.maxHp * 0.07',
      duration: 2,
    }],
  }],
};

function fixture(passives = [barrierPassive.id]) {
  const source = createUnit({
    id: 'player',
    name: '人物',
    side: 0,
    kind: 'player',
    level: 60,
    passives,
    attrs: { hp: 500, maxHp: 1000, physicalAtk: 10, speed: 10 },
  }, 0);
  const enemy = createUnit({
    id: 'enemy',
    name: '敌人',
    side: 1,
    kind: 'npc',
    level: 60,
    attrs: { hp: 10000, maxHp: 10000, physicalAtk: 0, speed: 0 },
  }, 1);
  const options: CombatV6CommandOptions = {
    unitId: source.id,
    canSubmit: true,
    reasons: [],
    attackTargetIds: [enemy.id],
    protectTargetIds: [],
    canDefend: true,
    canFlee: false,
    skills: [],
  };
  function rank(skills = [barrierPassive], statusDefs: StatusDef[] = []) {
    return rankAutoActions({ round: 1, units: [source, enemy] }, source.id, skills, statusDefs, options);
  }
  return { source, enemy, options, rank };
}

function shield(unit: Unit, id: string, kind: string, current: number) {
  unit.barriers.push({ id, kind, name: id, current, remainingRounds: 2, sourceId: unit.id, appliedRound: 1 });
}

describe('automatic defense barrier estimate', () => {
  it('can choose immediate protection over a weak attack, without mutating the observation', () => {
    const without = fixture([]);
    expect(without.rank()[0].command.type).toBe('attack');
    const withBarrier = fixture();
    const before = structuredClone(withBarrier.source);
    expect(withBarrier.rank()[0].command.type).toBe('defend');
    expect(withBarrier.source).toEqual(before);
  });

  it('does not value replacing an existing barrier of the same kind twice', () => {
    const { source, rank } = fixture();
    shield(source, 'another-id', 'defense-ward', 70);
    const defense = rank().find(candidate => candidate.command.type === 'defend')!;
    expect(defense.benefits.survival).toBe(0.001);
    expect(rank()[0].command.type).toBe('attack');
  });

  it('does not defend for passive shields at full health or when existing shields cover the deficit', () => {
    const full = fixture();
    full.source.attrs.hp = full.source.attrs.maxHp;
    expect(full.rank()[0].command.type).toBe('attack');
    expect(full.rank().find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBe(0.001);

    const covered = fixture();
    shield(covered.source, 'other', 'other', 500);
    expect(covered.rank()[0].command.type).toBe('attack');
  });

  it('still attacks when the available offense is worth more than the new shield', () => {
    const { source, rank } = fixture();
    source.attrs.physicalAtk = 1000;
    expect(rank()[0].command.type).toBe('attack');
    expect(rank().find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBeGreaterThan(0.001);
  });

  it('does not infer future damage reduction from a preparation marker', () => {
    const { rank } = fixture();
    const preparation: SkillDef = {
      ...barrierPassive,
      hooks: [{ on: 'afterDefend', sourceIsSelf: true, effects: [{ type: 'applyStatus', statusId: 'prepared', duration: 2, self: true }] }],
    };
    expect(rank([preparation])[0].command.type).toBe('attack');
    expect(rank([preparation]).find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBe(0.001);
  });

  it('does not use hidden enemy attack, defenses, speed or dodge to value defense', () => {
    const { enemy, rank } = fixture();
    const before = rank();
    Object.assign(enemy.attrs, { physicalAtk: 999999, magicAtk: 999999, physicalDef: 999999, magicDef: 999999, speed: 999999, dodge: 999999 });
    expect(rank()).toEqual(before);
  });
});

const preparationPassive: SkillDef = {
  id: 'prepare-counter', name: '守后折锋', tags: ['passive'], targeting: { side: 'self' }, effects: [],
  hooks: [
    { on: 'afterDefend', sourceIsSelf: true, aim: 'self', effects: [
      { type: 'modifyFact', key: 'counter.readyRound', value: 'round + 1' },
      { type: 'applyStatus', statusId: 'counter.ready', duration: 1 },
    ] },
    { on: 'afterHit', sourceIsSelf: true, requireKind: 'physical',
      when: { skillIds: ['followup-strike'], requireStatusIds: ['counter.ready'], expression: 'round == fact.counter.readyRound', targetSlot: 'primary', damageOrigins: ['action-direct'] },
      effects: [{ type: 'applyStatus', statusId: 'counter.weaken', duration: 1 }],
    },
  ],
};
const preparationDefs: StatusDef[] = [
  { id: 'counter.ready', kind: 'counter.ready', name: '待发', category: 'buff' },
  { id: 'counter.weaken', kind: 'counter.weaken', name: '折锋', category: 'debuff',
    damageDealtPhysical: 0.75, damageDealtSpell: 0.75, consumeAfterDamagingAction: true },
  { id: 'sealed', kind: 'sealed', name: '封术', category: 'control', blocksPhysical: true, blocksSpell: true },
];
function status(unit: Unit, id: string) {
  unit.statuses.push({ id, kind: id, sourceId: unit.id, remainingRounds: 2, appliedRound: 1, stacks: 1,
    speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1 });
}
function preparationFixture() {
  const base = fixture([preparationPassive.id]);
  const attack: SkillDef = { id: 'followup-strike', name: '攻击', tags: ['physical'], targeting: { side: 'enemy' }, effects: [{ type: 'physicalHit', coeff: 1 }] };
  base.source.skills = [attack.id];
  base.source.hpDamageThisRound = { round: 0, amount: 500 };
  base.options.skills.push({ skillId: attack.id, name: attack.name, ready: true, reasons: [], costs: { hp: 0, mp: 0, resources: [] }, selectableTargetIds: [base.enemy.id], targetMode: 'explicit', targetCount: 1 });
  return { ...base, attack, rank: (passive = preparationPassive) => base.rank([passive, attack], preparationDefs) };
}

describe('automatic defense preparation estimate', () => {
  it('values a declared next-attack weakness against visible recent damage without mutating the actor', () => {
    const withPreparation = preparationFixture();
    const before = structuredClone(withPreparation.source);
    expect(withPreparation.rank()[0].command.type).toBe('defend');
    expect(withPreparation.source).toEqual(before);
    const withoutPreparation = preparationFixture();
    withoutPreparation.source.passives = [];
    expect(withoutPreparation.rank()[0].command.type).toBe('attack');
  });

  it('does not assign direct protection to an inert preparation marker', () => {
    const { rank } = preparationFixture();
    const markerOnly = { ...preparationPassive, hooks: preparationPassive.hooks!.slice(0, 1) };
    expect(rank(markerOnly).find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBe(0.001);
  });

  it('does not count an identical attached weakening hook twice', () => {
    const { rank } = preparationFixture();
    const single = rank().find(candidate => candidate.command.type === 'defend')!;
    const duplicate = { ...preparationPassive, hooks: [...preparationPassive.hooks!, preparationPassive.hooks![1]] };
    expect(rank(duplicate).find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBe(single.benefits.survival);
  });

  it('does not reward an existing preparation or an already weakened target twice', () => {
    for (const prepared of [true, false]) {
      const { source, enemy, rank } = preparationFixture();
      status(prepared ? source : enemy, prepared ? 'counter.ready' : 'counter.weaken');
      expect(rank().find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBe(0.001);
    }
  });

  it('does not prepare at full health or without recent actual HP loss', () => {
    for (const caseName of ['full', 'none', 'stale'] as const) {
      const { source, rank } = preparationFixture();
      if (caseName === 'full') source.attrs.hp = source.attrs.maxHp;
      if (caseName === 'none') source.hpDamageThisRound = undefined;
      if (caseName === 'stale') source.hpDamageThisRound = { round: -1, amount: 500 };
      expect(rank().find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBe(0.001);
      expect(rank()[0].command.type).toBe('attack');
    }
  });

  it('can use the actual HP-loss ledger when the damage ledger is absent', () => {
    const { source, rank } = preparationFixture();
    source.hpDamageThisRound = undefined;
    source.hpLossThisRound = { round: 0, amount: 500 };
    expect(rank().find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBeGreaterThan(0.001);
  });

  it('does not prepare without a usable damaging followup or while sealed', () => {
    for (const caseName of ['none', 'blocked', 'sealed', 'resting', 'healing', 'zero'] as const) {
      const { source, options, attack, rank } = preparationFixture();
      if (caseName === 'none') options.skills = [];
      if (caseName === 'blocked') options.skills[0].ready = false;
      if (caseName === 'sealed') status(source, 'sealed');
      if (caseName === 'resting') source.flags.skipNextAction = true;
      if (caseName === 'healing') attack.effects = [{ type: 'physicalHit', coeff: 1, healInstead: true }];
      if (caseName === 'zero') attack.effects[0].when = { expression: 0 };
      expect(rank().find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBe(0.001);
    }
  });

  it('still chooses a valuable attack over the conservative preparation benefit', () => {
    const { source, rank } = preparationFixture();
    source.attrs.physicalAtk = 1000;
    expect(rank()[0].command.type).toBe('attack');
    expect(rank().find(candidate => candidate.command.type === 'defend')!.benefits.survival).toBeGreaterThan(0.001);
  });

  it('does not inspect hidden enemy panels to value preparation', () => {
    const { enemy, rank } = preparationFixture();
    const before = rank();
    Object.assign(enemy.attrs, { physicalAtk: 999999, magicAtk: 999999, physicalDef: 999999, magicDef: 999999, speed: 999999, dodge: 999999 });
    expect(rank()).toEqual(before);
  });
});
