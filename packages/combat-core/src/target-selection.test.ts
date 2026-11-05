import { describe, expect, it } from 'vitest';
import { createBattle } from './session.js';
import type { LineupUnit, Ruleset, SkillDef } from './types.js';

const rules: Ruleset = {
  name: 'target-selection', maxRounds: 10,
  formulas: {
    fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    critMultiplier: 2, furyAtkMultiplier: 1, defendPhysicalFactor: 1,
    physicalBase: () => 1, spellBase: () => 10, baseDamage: () => 10,
    physicalHitChance: () => 1, spellHitChance: () => 1, sealHitChance: () => 1, fleeChance: () => 0,
  },
  hpZeroOutcome: () => 'dead', decideCommand: () => ({ type: 'defend' }),
};
const versions = { engineVersion: 'combat-v6', rulesetVersion: 'test', contentVersion: 'test', projectionVersion: 'test' };
const strike: SkillDef = {
  id: 'strike', name: 'strike', tags: ['spell'], costMp: 'targets * 30',
  targeting: { side: 'enemy', mode: 'fill', count: 2, maxSelected: 1 },
  effects: [{ type: 'spellHit', coeff: 1 }],
};
function fixture(skill = strike, mp = 150, enemies: Partial<LineupUnit>[] = []) {
  const b = createBattle({ seed: 1, versions, ruleset: rules, skills: [skill], units: [
    { id: 'source', name: 'source', kind: 'player', side: 0, skills: [skill.id], attrs: { hp: 100, maxHp: 100, mp, maxMp: mp, speed: 2000 } },
    ...Array.from({ length: 5 }, (_, i): LineupUnit => ({ id: `enemy${i}`, name: `enemy${i}`, kind: 'npc', side: 1, attrs: { hp: 1000, speed: 10 + i }, ...enemies[i] })),
  ] });
  function mark(index: number, owner = 'source') {
    b.state.units[index + 1].statuses.push({ id: 'marker', kind: 'marker', sourceId: owner, stacks: 1, remainingRounds: 3, appliedRound: 1, speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1 });
  }
  function cast(primary = 'enemy0') {
    b.submit('source', { type: 'skill', skillId: skill.id, targets: [primary] });
    b.lockAndResolve();
    return b.state.units.filter(u => u.side === 1 && u.attrs.hp < 1000).map(u => u.id);
  }
  return { b, mark, cast };
}

describe('source-bound secondary target selection', () => {
  it('keeps the selected primary and fills its second slot from this source mark', () => {
    const { mark, cast } = fixture({ ...strike, targeting: { ...strike.targeting, secondaryOwnedStatusKind: 'marker' } });
    mark(4);
    expect(cast()).toEqual(['enemy0', 'enemy4']);
  });

  it('never borrows another source mark or strikes the marked primary twice', () => {
    const other = fixture({ ...strike, targeting: { ...strike.targeting, secondaryOwnedStatusKind: 'marker' } });
    other.mark(4, 'someone-else');
    expect(other.cast()).toEqual(['enemy0', 'enemy1']);
    const primary = fixture({ ...strike, targeting: { ...strike.targeting, secondaryOwnedStatusKind: 'marker' } });
    primary.mark(0);
    expect(primary.cast()).toEqual(['enemy0', 'enemy1']);
  });

  it('fills by configured passive priority before effective speed without replacing the primary', () => {
    const { cast } = fixture({ ...strike, targeting: { ...strike.targeting, count: 3, fillPriority: 'delayedRevivalThenSpeed', fillPriorityPassives: [['advanced'], ['normal']] } }, 150, [
      {}, { attrs: { hp: 1000, speed: 1000 } }, { passives: ['normal'] }, { passives: ['advanced'] }, {},
    ]);
    expect(cast()).toEqual(['enemy0', 'enemy2', 'enemy3']);
  });
});

describe('attached recovery targeting', () => {
  const recover: SkillDef = {
    id: 'recover', name: 'recover', tags: ['spell'], targeting: { side: 'enemy', count: 1 },
    effects: [{ type: 'randomBranch', branchId: 'recovery-share', chance: 'injuredAllyCount==1',
      successEffects: [{ type: 'heal', power: 100, includeHealPower: false, targeting: { side: 'ally', mode: 'lowestHp', count: 1, preferInjured: true } }],
      failureEffects: [{ type: 'heal', power: 70, includeHealPower: false, targeting: { side: 'ally', mode: 'lowestHp', count: 2, preferInjured: true } }],
    }],
  };
  function healingBattle(allies: LineupUnit[], skill = recover) {
    const reject: SkillDef = { id: 'reject', name: 'reject', tags: ['passive'], targeting: { side: 'self' }, effects: [], innate: { rejectHpRecovery: true } };
    return createBattle({ seed: 1, versions, ruleset: rules, skills: [skill, reject], units: [
      { id: 'source', name: 'source', kind: 'player', side: 0, skills: [skill.id], attrs: { hp: 100, maxHp: 100, speed: 2000 } },
      ...allies,
      { id: 'enemy', name: 'enemy', kind: 'npc', side: 1, attrs: { hp: 1000 } },
    ] });
  }
  function cast(battle: ReturnType<typeof healingBattle>) {
    battle.submit('source', { type: 'skill', skillId: recover.id, targets: ['enemy'] });
    battle.lockAndResolve();
  }
  it('gives the single recoverable injured ally the full heal despite a lower rejected HP bar', () => {
    const battle = healingBattle([
      { id: 'blocked', name: 'blocked', kind: 'pet', side: 0, passives: ['reject'], attrs: { hp: 1, maxHp: 1000 } },
      { id: 'ally', name: 'ally', kind: 'player', side: 0, attrs: { hp: 200, maxHp: 1000 } },
    ]);
    cast(battle);
    expect(battle.unit('ally').attrs.hp).toBe(300);
    expect(battle.unit('blocked').attrs.hp).toBe(1);
  });
  it('locks the split before the first recipient fills up', () => {
    const battle = healingBattle([
      { id: 'small', name: 'small', kind: 'pet', side: 0, attrs: { hp: 1, maxHp: 10 } },
      { id: 'ally', name: 'ally', kind: 'player', side: 0, attrs: { hp: 200, maxHp: 1000 } },
    ]);
    cast(battle);
    expect(battle.unit('small').attrs.hp).toBe(10);
    expect(battle.unit('ally').attrs.hp).toBe(270);
  });
  it('counts injuries when the recovery begins, after preceding effects', () => {
    const battle = healingBattle([], { ...recover, effects: [
      { type: 'loseHp', power: 20, targeting: { side: 'self' } },
      ...recover.effects,
    ] });
    cast(battle);
    expect(battle.unit('source').attrs.hp).toBe(100);
    expect(battle.log().find(event => event.type === 'chanceResolved' && event.branchId === 'recovery-share')).toMatchObject({ chance: 1, success: true });
  });
  it('retains the original full-health target pool when nobody needs recovery', () => {
    const support: SkillDef = { ...recover, effects: [{ type: 'applyBarrier', id: 'preparation', kind: 'preparation', name: 'preparation', power: 70, duration: 2,
      targeting: { side: 'ally', mode: 'lowestHp', count: 2, preferInjured: true } }] };
    const battle = createBattle({ seed: 1, versions, ruleset: rules, skills: [support], units: [
      { id: 'source', name: 'source', kind: 'player', side: 0, skills: [support.id], attrs: { hp: 100, maxHp: 100, speed: 2000 } },
      { id: 'ally', name: 'ally', kind: 'pet', side: 0, attrs: { hp: 100, maxHp: 100 } },
      { id: 'enemy', name: 'enemy', kind: 'npc', side: 1, attrs: { hp: 1000 } },
    ] });
    cast(battle);
    expect(battle.unit('source').barriers[0].current).toBe(70);
    expect(battle.unit('ally').barriers[0].current).toBe(70);
  });
  it('settles declared facts and healing after the last enemy dies without adding a new status', () => {
    const skill: SkillDef = {
      id: 'terminal-recovery', name: 'terminal-recovery', tags: ['spell'], targeting: { side: 'enemy' },
      effects: [
        { type: 'fixedHit', power: 10 },
        { type: 'modifyFact', key: 'injured_snapshot', value: 'injuredAllyCount' },
        { type: 'heal', power: 60, includeHealPower: false, targeting: { side: 'self' }, when: { expression: 'fact.injured_snapshot==1' } },
        { type: 'applyStatus', statusId: 'regrowth', duration: 2, targeting: { side: 'self' } },
      ],
    };
    const battle = createBattle({ seed: 1, versions, ruleset: rules, skills: [skill],
      statusDefs: [{ id: 'regrowth', name: 'regrowth', kind: 'regrowth', ticks: 'roundEnd', healingPerRound: 50 }],
      units: [
        { id: 'source', name: 'source', kind: 'player', side: 0, skills: [skill.id], attrs: { hp: 30, maxHp: 100, speed: 2000 } },
        { id: 'enemy', name: 'enemy', kind: 'npc', side: 1, attrs: { hp: 1, maxHp: 1 } },
      ],
    });
    battle.submit('source', { type: 'skill', skillId: skill.id, targets: ['enemy'] });
    battle.lockAndResolve();
    expect(battle.finished).toBe(true);
    expect(battle.unit('source').combatFacts.injured_snapshot).toBe(1);
    expect(battle.unit('source').attrs.hp).toBe(90);
    expect(battle.unit('source').statuses).toEqual([]);
  });
});

describe('frozen action target expressions', () => {
  it('keeps original target indexes in effects, conditions and modifiers after the primary dies', () => {
    const skill: SkillDef = {
      id: 'indexed', name: 'indexed', tags: ['spell'], targeting: { side: 'enemy', mode: 'fill', count: 2 },
      modifiers: [{ damageBonus: 'actionTargetCount*0.1', when: { expression: 'actionTargetIndex==1' } }],
      effects: [
        { type: 'fixedHit', power: 1 },
        { type: 'fixedHit', power: 'actionTargetCount+actionTargetIndex*10', when: { expression: 'actionTargetIndex>0' } },
        { type: 'spellHit', coeff: 1 },
        { type: 'applyBarrier', id: 'self', kind: 'self', name: 'self', power: 'actionTargetCount', duration: 2,
          targeting: { side: 'self' }, when: { expression: 'actionTargetIndex==-1' } },
      ],
    };
    const b = createBattle({ seed: 1, versions, skills: [skill],
      ruleset: { ...rules, formulas: { ...rules.formulas, baseDamage: input => input.kind === 'fixed' ? input.power : 10 } },
      units: [
        { id: 'source', name: 'source', kind: 'player', side: 0, skills: [skill.id], attrs: { hp: 100, speed: 2000 } },
        { id: 'enemy0', name: 'enemy0', kind: 'npc', side: 1, attrs: { hp: 1, maxHp: 1 } },
        { id: 'enemy1', name: 'enemy1', kind: 'npc', side: 1, attrs: { hp: 1000 } },
      ],
    });
    b.submit('source', { type: 'skill', skillId: skill.id, targets: ['enemy0'] });
    b.lockAndResolve();
    expect(b.unit('enemy0').flags.dead).toBe(true);
    expect(b.unit('source').barriers[0].current).toBe(2);
    const hits = b.log().filter(event => event.type === 'damage' && event.targetId === 'enemy1');
    expect(hits.map(event => event.type === 'damage' ? event.amount : 0)).toEqual([1, 14, 12]);
  });
});

describe('probabilistic target-count cost preflight', () => {
  const area: SkillDef = { ...strike, targeting: { ...strike.targeting, count: 3, extraChance: 0.00000001, extraCount: 2, reserveExtraCost: true } };

  it('reserves the highest legal cost without consuming RNG and enforces it at execution', () => {
    const { b, cast } = fixture(area, 149);
    const before = b.state.rngState;
    const option = b.queryCommands('source').skills[0];
    expect(option.costs.mp).toBe(150);
    expect(option.reasons).toContain('insufficient-mp');
    expect(b.state.rngState).toBe(before);
    cast();
    expect(b.state.units[0].attrs.mp).toBe(149);
  });

  it('charges only the actual targets when the bonus does not occur', () => {
    const { b, cast } = fixture(area);
    expect(b.queryCommands('source').skills[0].costs.mp).toBe(150);
    expect(cast()).toHaveLength(3);
    expect(b.state.units[0].attrs.mp).toBe(60);
  });

  it('caps the reserve at the legal pool and skips impossible bonus costs', () => {
    const { b } = fixture({ ...area, targeting: { ...area.targeting, count: 4, extraCount: 4 } }, 150);
    expect(b.queryCommands('source').skills[0].costs.mp).toBe(150);
    const noBonus = fixture({ ...area, targeting: { ...area.targeting, extraChance: 0 } }, 90);
    expect(noBonus.b.queryCommands('source').skills[0].costs.mp).toBe(90);
    expect(noBonus.cast()).toHaveLength(3);
    expect(noBonus.b.state.units[0].attrs.mp).toBe(0);
  });
});
