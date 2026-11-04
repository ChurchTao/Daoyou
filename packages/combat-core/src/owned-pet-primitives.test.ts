import { describe, expect, it } from 'vitest';
import { createBattle } from './session.js';
import type { CreateBattleInput, Ruleset, SkillDef } from './types.js';

const rules: Ruleset = {
  name: 'owned-pet-primitives',
  maxRounds: 4,
  formulas: {
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    critMultiplier: 2,
    furyAtkMultiplier: 1,
    defendPhysicalFactor: 1,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense) => Math.max(1, attack - defense),
    baseDamage: ({ source, target, coeff, power }) =>
      Math.max(1, (source.attrs.physicalAtk - target.attrs.physicalDef) * coeff + power),
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    sealHitChance: () => 1,
    fleeChance: () => 0,
  },
  hpZeroOutcome: unit => unit.kind === 'player' ? 'downed' : 'dead',
  decideCommand: () => ({ type: 'defend' }),
};

const versions = {
  engineVersion: 'combat-v6',
  rulesetVersion: 'test',
  contentVersion: 'test',
  projectionVersion: 'test',
} as const;

function battle(skills: SkillDef[] = [], ownerSkills: string[] = [], extra: Partial<CreateBattleInput> = {}) {
  return createBattle({
    seed: 7,
    versions,
    ruleset: rules,
    skills,
    units: [
      { id: 'owner', name: 'owner', kind: 'player', side: 0, slot: 0, skills: ownerSkills, attrs: { hp: 100, maxHp: 100, mp: 100, maxMp: 100, speed: 100, physicalAtk: 100 } },
      { id: 'ally', name: 'ally', kind: 'player', side: 0, slot: 1, attrs: { hp: 100, maxHp: 100, speed: 10 } },
      { id: 'own-pet', name: 'own-pet', kind: 'pet', ownerId: 'owner', side: 0, slot: 0, attrs: { hp: 100, maxHp: 100, speed: 80, physicalAtk: 100 } },
      { id: 'ally-pet', name: 'ally-pet', kind: 'pet', ownerId: 'ally', side: 0, slot: 1, attrs: { hp: 100, maxHp: 100, speed: 70, physicalAtk: 100 } },
      { id: 'foe', name: 'foe', kind: 'npc', side: 1, slot: 0, attrs: { hp: 1000, maxHp: 1000, speed: 10 } },
    ],
    ...extra,
  });
}

describe('owned pet combat primitives', () => {
  it('limits allied pet targeting and owner auras to the acting player\'s pet', () => {
    const care: SkillDef = {
      id: 'care', name: 'care', tags: ['support'],
      targeting: { side: 'ally', requireOwnedPet: true },
      effects: [{ type: 'heal', power: 10 }],
    };
    const aura: SkillDef = {
      id: 'aura', name: 'aura', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      modifiers: [{ ownedPetAura: true, physicalAttackAdd: 40 }],
    };
    const b = battle([care, aura], ['care', 'aura']);
    expect(b.queryCommands('owner').skills.find(s => s.skillId === 'care')?.selectableTargetIds).toEqual(['own-pet']);
    b.submit('own-pet', { type: 'attack', target: 'foe' });
    b.submit('ally-pet', { type: 'attack', target: 'foe' });
    b.lockAndResolve();
    const amounts = b.log().filter(event => event.type === 'damage' && event.targetId === 'foe').map(event => event.amount);
    expect(amounts).toEqual([140, 100]);
  });

  it('adds defense to the owned pet before the incoming damage formula', () => {
    const sturdy: SkillDef = {
      id: 'sturdy', name: 'sturdy', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      modifiers: [{ ownedPetAura: true, physicalDefenseAdd: 40 }],
    };
    const hit = (target: string) => {
      const b = battle([sturdy], ['sturdy']);
      b.unit('foe').attrs.physicalAtk = 100;
      b.submit('foe', { type: 'attack', target });
      b.lockAndResolve();
      return b.log().find(event => event.type === 'damage' && event.sourceId === 'foe');
    };
    expect(hit('own-pet')).toMatchObject({ amount: 60 });
    expect(hit('ally-pet')).toMatchObject({ amount: 100 });
  });

  it('reports effective healing and does not recursively trigger a transferred heal', () => {
    const selfHeal: SkillDef = {
      id: 'self-heal', name: 'self-heal', tags: ['support'], targeting: { side: 'self' },
      effects: [{ type: 'heal', power: 30, fixedBase: true }],
    };
    const bond: SkillDef = {
      id: 'bond', name: 'bond', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      hooks: [{
        on: 'afterHeal', targetIsSelf: true, aim: 'ownedPet',
        effects: [{ type: 'heal', power: 'heal * 0.5', fixedBase: true }],
      }],
    };
    const b = battle([selfHeal, bond], ['self-heal', 'bond']);
    b.unit('owner').attrs.hp = 50;
    b.unit('own-pet').attrs.hp = 40;
    b.submit('owner', { type: 'skill', skillId: 'self-heal', targets: ['owner'] });
    b.lockAndResolve();
    expect(b.unit('owner').attrs.hp).toBe(80);
    expect(b.unit('own-pet').attrs.hp).toBe(55);
    expect(b.log().filter(event => event.type === 'heal').map(event => event.amount)).toEqual([30, 15]);
  });

  it('distinguishes the initial pet from a later switch without affecting an ally pet', () => {
    const entry: SkillDef = {
      id: 'entry', name: 'entry', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      hooks: [
        { on: 'onPetSummoned', sourceIsSelf: true, targetIsOwnedPet: true, when: { petEntryKind: 'initial' }, aim: 'self', effects: [{ type: 'modifyFact', key: 'initial', value: 1 }] },
        { on: 'onPetSummoned', sourceIsSelf: true, targetIsOwnedPet: true, when: { petEntryKind: 'switch' }, aim: 'self', effects: [{ type: 'modifyFact', key: 'switch', value: 1 }] },
      ],
    };
    const b = battle([entry], ['entry'], { units: [
      { id: 'owner', name: 'owner', kind: 'player', side: 0, slot: 0, skills: ['entry'], attrs: { hp: 100, speed: 100 } },
      { id: 'ally', name: 'ally', kind: 'player', side: 0, slot: 1, attrs: { hp: 100, speed: 10 } },
      { id: 'own-pet', name: 'own-pet', kind: 'pet', ownerId: 'owner', side: 0, slot: 0, attrs: { hp: 100, speed: 80 } },
      { id: 'reserve', name: 'reserve', kind: 'pet', ownerId: 'owner', side: 0, slot: 0, benched: true, attrs: { hp: 100, speed: 80 } },
      { id: 'ally-pet', name: 'ally-pet', kind: 'pet', ownerId: 'ally', side: 0, slot: 1, attrs: { hp: 100, speed: 70 } },
      { id: 'foe', name: 'foe', kind: 'npc', side: 1, slot: 0, attrs: { hp: 1000, speed: 10 } },
    ] });
    expect(b.unit('owner').combatFacts?.initial).toBe(1);
    expect(b.unit('owner').combatFacts?.switch).toBeUndefined();
    b.submit('owner', { type: 'summon', petId: 'reserve' });
    b.lockAndResolve();
    expect(b.unit('owner').combatFacts?.switch).toBe(1);
    expect(b.unit('own-pet').flags.benched).toBe(true);
    expect(b.unit('reserve').flags.benched).toBe(false);
  });

  it('pays exact owned pet HP only when revival can succeed', () => {
    const rescue: SkillDef = {
      id: 'rescue', name: 'rescue', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      hooks: [{ on: 'onRoundEnd', aim: 'self', when: { sourceHasStandingPet: true, expression: 'ownPetHp > floor((ownPetMaxHp * 3 + 9) / 10)', oncePerBattle: true }, effects: [{ type: 'revive', hpRatio: 0.1, ownedPetHpCostRatio: 0.3 }] }],
    };
    const b = battle([rescue], ['rescue']);
    b.unit('owner').attrs.hp = 0;
    b.unit('owner').flags.downed = true;
    b.unit('own-pet').attrs.hp = 31;
    b.lockAndResolve();
    expect(b.unit('owner').attrs.hp).toBe(10);
    expect(b.unit('owner').flags.downed).toBe(false);
    expect(b.unit('own-pet').attrs.hp).toBe(1);
    expect(b.log().filter(event => event.type === 'hpCost').map(event => event.amount)).toEqual([30]);

    const blocked = battle([rescue], ['rescue'], { statusDefs: [{ id: 'no-revive', name: 'no-revive', kind: 'no-revive', blocksRevive: true, persistWhenDowned: true }] });
    blocked.applyStatus('owner', 'no-revive', 3);
    blocked.unit('owner').attrs.hp = 0;
    blocked.unit('owner').flags.downed = true;
    blocked.unit('own-pet').attrs.hp = 31;
    blocked.lockAndResolve();
    expect(blocked.unit('owner').flags.downed).toBe(true);
    expect(blocked.unit('own-pet').attrs.hp).toBe(31);
    expect(blocked.log().filter(event => event.type === 'hpCost')).toEqual([]);

    const edge = battle([rescue], ['rescue']);
    edge.unit('owner').attrs.hp = 0;
    edge.unit('owner').flags.downed = true;
    edge.unit('own-pet').attrs.maxHp = 101;
    edge.unit('own-pet').attrs.hp = 31;
    edge.lockAndResolve();
    expect(edge.unit('owner').flags.downed).toBe(true);
    expect(edge.log().filter(event => event.type === 'hpCost')).toEqual([]);
    edge.unit('own-pet').attrs.hp = 32;
    edge.lockAndResolve();
    expect(edge.unit('owner').flags.downed).toBe(false);
    expect(edge.unit('own-pet').attrs.hp).toBe(1);
    expect(edge.log().filter(event => event.type === 'hpCost').map(event => event.amount)).toEqual([31]);
  });

  it('reads the owner\'s mark before protecting against the pet\'s attack', () => {
    const partner: SkillDef = {
      id: 'partner', name: 'partner', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      modifiers: [{ ownedPetAura: true, when: { targetStatusFromSourceOwnerKinds: ['partner-mark'] }, ignoreProtection: true }],
    };
    const make = (marked: boolean) => {
      const b = battle([partner], ['partner'], {
        statusDefs: [{ id: 'mark', name: 'mark', kind: 'partner-mark', sourceBound: true }],
        units: [
          { id: 'owner', name: 'owner', kind: 'player', side: 0, slot: 0, skills: ['partner'], attrs: { hp: 100, speed: 100 } },
          { id: 'pet', name: 'pet', kind: 'pet', ownerId: 'owner', side: 0, slot: 0, attrs: { hp: 100, speed: 80, physicalAtk: 100 } },
          { id: 'foe', name: 'foe', kind: 'player', side: 1, slot: 0, attrs: { hp: 200, speed: 10 } },
          { id: 'guard', name: 'guard', kind: 'player', side: 1, slot: 1, attrs: { hp: 200, speed: 10 } },
        ],
      });
      if (marked) b.applyStatus('foe', 'mark', 2, 'owner');
      b.submit('pet', { type: 'attack', target: 'foe' });
      b.submit('guard', { type: 'protect', target: 'foe' });
      b.lockAndResolve();
      return b;
    };
    const marked = make(true);
    expect(marked.unit('foe').attrs.hp).toBeLessThan(200);
    expect(marked.unit('guard').attrs.hp).toBe(200);
    const unmarked = make(false);
    expect(unmarked.unit('guard').attrs.hp).toBeLessThan(200);
  });

  it('lowers the incoming seal ceiling by standing allied pets', () => {
    const ceilings: number[] = [];
    const targetPassive: SkillDef = {
      id: 'resist', name: 'resist', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      modifiers: [{ sealChanceCeilTakenAdd: '-0.02 * allyStandingPets' }],
    };
    const seal: SkillDef = {
      id: 'seal', name: 'seal', tags: ['seal'], targeting: { side: 'enemy' },
      effects: [{ type: 'applyStatus', statusId: 'sealed', duration: 2, hit: 'seal' }],
    };
    const b = battle([targetPassive, seal], ['resist'], {
      ruleset: { ...rules, formulas: { ...rules.formulas, sealHitChance: (_source, _target, _level, _base, _add, ceiling) => {
        ceilings.push(ceiling ?? 0);
        return 1;
      } } },
      statusDefs: [
        { id: 'sealed', name: 'sealed', kind: 'seal', category: 'control', isSeal: true },
        { id: 'stun', name: 'stun', kind: 'stun', category: 'control' },
      ],
    });
    b.unit('foe').skills.push('seal');
    b.submit('foe', { type: 'skill', skillId: 'seal', targets: ['owner'] });
    b.lockAndResolve();
    expect(ceilings).toEqual([0.96]);
    expect(b.unit('owner').statuses.some(status => status.id === 'sealed')).toBe(true);
  });

  it('matches an explicit seal without treating every control status as a seal', () => {
    const strike: SkillDef = {
      id: 'seal-strike', name: 'seal-strike', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      hooks: [{ on: 'onHitCalc', sourceIsSelf: true, when: { targetHasSeal: true }, effects: [{ type: 'modifyStrike', factor: 1.3 }] }],
    };
    const statuses = [
      { id: 'sealed', name: 'sealed', kind: 'sealed', category: 'control' as const, isSeal: true },
      { id: 'stun', name: 'stun', kind: 'stun', category: 'control' as const },
    ];
    const hit = (statusId: string) => {
      const b = battle([strike], ['seal-strike'], { statusDefs: statuses });
      b.applyStatus('foe', statusId, 2);
      b.submit('owner', { type: 'attack', target: 'foe' });
      b.lockAndResolve();
      return b.log().find(event => event.type === 'damage' && event.sourceId === 'owner');
    };
    expect(hit('stun')).toMatchObject({ amount: 100 });
    expect(hit('sealed')).toMatchObject({ amount: 130 });
  });

  it('classifies an allied dispel by the removed status seal flag', () => {
    const observer: SkillDef = {
      id: 'observer', name: 'observer', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      hooks: [{ on: 'onStatusRemoved', targetIsSelf: true, aim: 'self',
        when: { removedStatusWasSeal: true, statusRemovedByAlly: true, statusRemoveReason: 'dispel' },
        effects: [{ type: 'modifyFact', key: 'cleanseSealCount', value: 'fact.cleanseSealCount+1' }] }],
    };
    const cleanse: SkillDef = {
      id: 'cleanse', name: 'cleanse', tags: ['support'], targeting: { side: 'ally' },
      effects: [{ type: 'dispel', categories: ['control'], maxCount: 1 }],
    };
    const b = battle([observer, cleanse], ['observer'], {
      statusDefs: [
        { id: 'sealed', name: 'sealed', kind: 'sealed', category: 'control', isSeal: true },
        { id: 'stun', name: 'stun', kind: 'stun', category: 'control' },
      ],
    });
    b.unit('ally').skills.push('cleanse');
    b.applyStatus('owner', 'stun', 3, 'foe');
    b.submit('ally', { type: 'skill', skillId: 'cleanse', targets: ['owner'] });
    b.lockAndResolve();
    expect(b.unit('owner').combatFacts?.cleanseSealCount).toBeUndefined();
    b.applyStatus('owner', 'sealed', 3, 'foe');
    b.submit('ally', { type: 'skill', skillId: 'cleanse', targets: ['owner'] });
    b.lockAndResolve();
    expect(b.unit('owner').combatFacts?.cleanseSealCount).toBe(1);
  });

  it('adds flat final damage once per target each round', () => {
    const marks: SkillDef = {
      id: 'marks', name: 'marks', tags: ['passive'], targeting: { side: 'self' }, effects: [],
      hooks: [{ on: 'onHitCalc', sourceIsSelf: true, when: { oncePerRoundTarget: true }, effects: [{ type: 'modifyStrike', finalAdd: 30 }] }],
    };
    const double: SkillDef = {
      id: 'double', name: 'double', tags: ['physical'], targeting: { side: 'enemy' },
      effects: [{ type: 'physicalHit', coeff: 1, hits: 2 }],
    };
    const b = battle([marks, double], ['marks', 'double']);
    b.submit('owner', { type: 'skill', skillId: 'double', targets: ['foe'] });
    b.lockAndResolve();
    const first = b.log().filter(event => event.type === 'damage' && event.sourceId === 'owner').map(event => event.amount);
    expect(first).toEqual([130, 100]);
    b.submit('owner', { type: 'skill', skillId: 'double', targets: ['foe'] });
    b.lockAndResolve();
    const second = b.log().filter(event => event.type === 'damage' && event.sourceId === 'owner').map(event => event.amount);
    expect(second).toEqual([130, 100, 130, 100]);
  });

  it('caps effective HP restoration per recipient across repeated effects in a round', () => {
    const pairHeal: SkillDef = {
      id: 'pair-heal', name: 'pair-heal', tags: ['support'],
      targeting: { side: 'ally', mode: 'all', count: 2 },
      effects: [{ type: 'repeat', min: 2, max: 2, effects: [{ type: 'restoreHp', power: 6, maxGainPerRound: 'target.maxHp * 0.08' }] }],
    };
    const b = battle([pairHeal], ['pair-heal'], { units: [
      { id: 'owner', name: 'owner', kind: 'player', side: 0, slot: 0, skills: ['pair-heal'], attrs: { hp: 50, maxHp: 100, speed: 100 } },
      { id: 'own-pet', name: 'own-pet', kind: 'pet', ownerId: 'owner', side: 0, slot: 1, attrs: { hp: 50, maxHp: 100, speed: 80 } },
      { id: 'foe', name: 'foe', kind: 'npc', side: 1, slot: 0, attrs: { hp: 1000, speed: 10 } },
    ] });
    b.submit('owner', { type: 'skill', skillId: 'pair-heal', targets: ['owner', 'own-pet'] });
    b.lockAndResolve();
    expect([b.unit('owner').attrs.hp, b.unit('own-pet').attrs.hp]).toEqual([58, 58]);
    b.submit('owner', { type: 'skill', skillId: 'pair-heal', targets: ['owner', 'own-pet'] });
    b.lockAndResolve();
    expect([b.unit('owner').attrs.hp, b.unit('own-pet').attrs.hp]).toEqual([66, 66]);
  });
});
