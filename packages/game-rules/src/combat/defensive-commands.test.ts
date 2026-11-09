import { describe, expect, it } from 'vitest';
import { CommandType, EventType } from '@daoyou/combat-core/enums';
import { createBattle } from '@daoyou/combat-core/session';
import { COMBAT_V6_BASE_PROJECTION_VERSIONS } from '@daoyou/game-domain/combat';
import type { ManualSlotV1 } from '@daoyou/game-domain/manuals';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { compileCharacterManualsV1 } from '../manuals/compiler.js';
import { createDaoyouRuleset } from './daoyou/index.js';

function battleWithManuals(manualIds: string[]) {
  const manuals = compileCharacterManualsV1({
    realm: '大乘',
    state: {
      version: 1, revision: 0,
      learned: manualIds.map((manualId, index) => ({ manualId, level: 9, unlockedLevel: 9, slot: (index + 5) as ManualSlotV1 })),
      build: { slots: manualIds.map((manualId, index) => ({ slot: (index + 5) as ManualSlotV1, manualId })) },
    },
  }, CHARACTER_MANUALS_V1);
  if (!manuals.ok) throw new Error(JSON.stringify(manuals.diagnostics));
  const attrs = { hp: 10000, mp: 10000, maxMp: 10000, physicalAtk: 1000 };
  return createBattle({
    seed: 42,
    versions: COMBAT_V6_BASE_PROJECTION_VERSIONS,
    ruleset: {
      ...createDaoyouRuleset({ formulas: {
        baseDamage: () => 1000, physicalHitChance: () => 1, spellHitChance: () => 1,
        fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
        defendPhysicalFactor: 1,
      } }),
      decideCommand: () => ({ type: CommandType.Defend }),
    },
    skills: manuals.projection.skills,
    statusDefs: manuals.projection.statusDefs,
    units: [
      { id: 'slow', name: 'slow', side: 0, kind: 'player', attrs: { ...attrs, speed: 1 }, passives: manuals.projection.passiveSkillIds },
      { id: 'fast', name: 'fast', side: 1, kind: 'player', attrs: { ...attrs, speed: 100 } },
    ],
  });
}

describe('manual defenses during round preparation', () => {
  it('百脉 absorbs the faster attack and 金刚 prepares once before ordinary speed actions', () => {
    const battle = battleWithManuals(['character_manual.baimai_lianbao', 'character_manual.jingang_xian']);
    battle.submit('slow', { type: CommandType.Defend });
    battle.submit('fast', { type: CommandType.Attack, target: 'slow' });
    battle.lockAndResolve();
    expect(battle.unit('slow').attrs.hp).toBe(9700);
    expect(battle.unit('slow').combatFacts?.['character_manual.jingang_xian.prepared']).toBe(2);
    expect(battle.unit('slow').statuses.some(status => status.id === 'character_manual.jingang_xian.ready')).toBe(true);
    expect(battle.log().filter(event => event.type === EventType.BarrierChanged && event.reason === 'applied')).toHaveLength(1);
    expect(battle.unit('slow').attrs.mp).toBe(10000);
    expect(battle.unit('slow').skillUses).toEqual({});
  });

  it('keeps 无始’s existing mitigation until the defender’s ordinary speed window closes', () => {
    const battle = battleWithManuals(['character_manual.wushi']);
    battle.submit('slow', { type: CommandType.Defend });
    battle.submit('fast', { type: CommandType.Attack, target: 'slow' });
    battle.lockAndResolve();
    expect(battle.unit('slow').attrs.hp).toBe(9120);
    expect(battle.unit('slow').combatFacts?.['character_manual.wushi.closed']).toBe(1);
  });
});
