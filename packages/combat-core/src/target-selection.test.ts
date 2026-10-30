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
