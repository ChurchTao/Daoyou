import { describe, expect, it } from 'vitest';
import {
  createBattle,
  EffectType,
  restoreBattle,
  SkillTag,
  TargetSide,
} from './core';
import type { CreateBattleInput } from './core/types';
import { daoyouRulesetV6 } from './rules-daoyou';
import { COMBAT_V6_PHASE_8A_VERSIONS } from './version';

function fixture(healerSpeed: number): CreateBattleInput {
  return {
    seed: 12,
    versions: COMBAT_V6_PHASE_8A_VERSIONS,
    ruleset: daoyouRulesetV6,
    units: [
      {
        id: 'healer',
        name: '医者',
        kind: 'player',
        side: 0,
        attrs: {
          hp: 1000,
          speed: healerSpeed,
          physicalAtk: 10,
          physicalDef: 100,
        },
        skills: ['revive'],
      },
      {
        id: 'down',
        name: '倒地者',
        kind: 'player',
        side: 0,
        attrs: { hp: 1000, speed: 50, physicalAtk: 200, physicalDef: 100 },
      },
      {
        id: 'foe',
        name: '对手',
        kind: 'player',
        side: 1,
        attrs: { hp: 10000, speed: 1, physicalAtk: 10, physicalDef: 100 },
      },
    ],
    skills: [
      {
        id: 'revive',
        name: '复起',
        tags: [SkillTag.Support],
        targeting: { side: TargetSide.Ally, includeDowned: true },
        effects: [{ type: EffectType.Revive, hp: 500 }],
      },
    ],
  };
}
describe('v6 arena downed command timing', () => {
  it.each([
    [100, true],
    [10, false],
  ])('healer speed %s, acts this round %s', (speed, acts) => {
    const input = fixture(speed);
    const original = createBattle(input);
    const snapshot = original.snapshot();
    snapshot.units[1].flags.downed = true;
    snapshot.units[1].attrs.hp = 0;
    const battle = restoreBattle(input, snapshot, original.log());
    expect(battle.queryCommands('down').canSubmit).toBe(true);
    battle.submit('down', { type: 'attack', target: 'foe' });
    battle.submit('healer', {
      type: 'skill',
      skillId: 'revive',
      targets: ['down'],
    });
    battle.submit('foe', { type: 'defend' });
    const restored = restoreBattle(input, battle.snapshot(), battle.log());
    battle.lockAndResolve();
    restored.lockAndResolve();
    expect(battle.log()).toEqual(restored.log());
    expect(battle.snapshot()).toEqual(restored.snapshot());
    expect(
      battle.log().some((e) => e.type === 'actionStart' && e.unitId === 'down'),
    ).toBe(acts);
  });
});
