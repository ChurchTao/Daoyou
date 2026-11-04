import { createBattle } from '@daoyou/combat-core/session';
import { SeededRng } from '@daoyou/combat-core/rng';
import type { SkillDef } from '@daoyou/combat-core/types';
import { XIAOYUE_V6_DEFINITION, XIAOYUE_SKILL_ID } from '@daoyou/game-content/sects/xiaoyue';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { afterEach, expect, it, vi } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

afterEach(() => vi.restoreAllMocks());

it('宁息一次鹏击击倒多目标时只判定一次延长概率', () => {
  const pathId = 'xiaoyue.path.blood';
  const progress = createEmptySectCombatProgressV6('xiaoyue', pathId,
    Object.fromEntries(XIAOYUE_V6_DEFINITION.methods.map(method => [method.id, 50])));
  progress.meridianDepth = 2;
  progress.meridianLoadouts.find(loadout => loadout.pathId === pathId)!.nodeIds = [
    'xiaoyue.node.blood.1.1', 'xiaoyue.node.blood.2.2',
  ];
  const compiled = compileSectDefinitionV6({ definition: XIAOYUE_V6_DEFINITION, progress, characterLevel: 50 });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const content = compiled.projection;
  const battle = createBattle({
    seed: 19, versions,
    ruleset: { ...createDaoyouRuleset({ formulas: {
      physicalHitChance: () => 1,
      fluctuationMin: 1, fluctuationMax: 1,
      physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    } }), deferredPlayerCommands: true },
    skills: content.skills, statusDefs: content.statusDefs,
    units: [
      { id: 'owner', name: '啸岳', side: 0, kind: 'player', level: 50,
        attrs: { hp: 1000, mp: 1000, speed: 1000, physicalAtk: 1000 },
        tags: content.unitTags, skills: content.activeSkillIds, passives: content.passiveSkillIds,
        skillLevels: content.skillLevels, skillOverrides: content.skillOverrides },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `enemy${i}`, name: '木桩', side: 1 as const,
        kind: 'npc' as const, attrs: { hp: i === 3 ? 100000 : 1, speed: 10 } })),
    ],
  });
  const round = (skillId: string) => {
    battle.submit('owner', { type: 'skill', skillId, targets: [skillId === XIAOYUE_SKILL_ID.Transform ? 'owner' : 'enemy0'] });
    for (const unit of battle.state.units.filter(unit => unit.side === 1 && !unit.flags.dead))
      battle.submit(unit.id, { type: 'defend' });
    battle.lockAndResolve();
  };
  round(XIAOYUE_SKILL_ID.Transform);
  let attempts = 0;
  vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => {
    if (probability === 0.15) attempts++;
    return probability >= 1;
  });
  round(XIAOYUE_SKILL_ID.EagleStrike);
  expect(battle.log().filter(event => event.type === 'unitDead' && event.unitId.startsWith('enemy'))).toHaveLength(3);
  expect(attempts).toBe(1);
});

it('狂反在敌方同一根行动的多段攻击中只反击一次', () => {
  const progress = createEmptySectCombatProgressV6('xiaoyue', 'xiaoyue.path.blood',
    Object.fromEntries(XIAOYUE_V6_DEFINITION.methods.map(method => [method.id, 50])));
  const compiled = compileSectDefinitionV6({ definition: XIAOYUE_V6_DEFINITION, progress, characterLevel: 50 });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const content = compiled.projection;
  const multi: SkillDef = {
    id: 'test.multi', name: '多段攻击', tags: ['physical'], targeting: { side: 'enemy' },
    effects: [{ type: 'physicalHit', hits: 3, coeff: [1, 1, 1] }],
  };
  const battle = createBattle({
    seed: 19, versions,
    ruleset: { ...createDaoyouRuleset({ formulas: {
      physicalHitChance: () => 1,
      fluctuationMin: 1, fluctuationMax: 1,
      physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    } }), deferredPlayerCommands: true },
    skills: [...content.skills, multi], statusDefs: content.statusDefs,
    units: [
      { id: 'owner', name: '啸岳', side: 0, kind: 'player', level: 50,
        attrs: { hp: 1000, maxHp: 1000, mp: 1000, speed: 1000, physicalAtk: 1000 },
        tags: content.unitTags, skills: content.activeSkillIds, passives: content.passiveSkillIds,
        skillLevels: content.skillLevels, skillOverrides: content.skillOverrides },
      { id: 'enemy', name: '多段敌人', side: 1, kind: 'npc',
        attrs: { hp: 10000, maxHp: 10000, speed: 10, physicalAtk: 100 }, skills: ['test.multi'] },
    ],
  });
  battle.submit('owner', { type: 'skill', skillId: XIAOYUE_SKILL_ID.Frenzy, targets: ['owner'] });
  battle.submit('enemy', { type: 'defend' });
  battle.lockAndResolve();
  battle.submit('owner', { type: 'defend' });
  battle.submit('enemy', { type: 'skill', skillId: 'test.multi', targets: ['owner'] });
  battle.lockAndResolve();
  expect(battle.log().filter(event => event.type === 'damage' && event.sourceId === 'enemy')).toHaveLength(3);
  expect(battle.log().filter(event => event.type === 'damage' && event.sourceId === 'owner')).toHaveLength(1);
});
