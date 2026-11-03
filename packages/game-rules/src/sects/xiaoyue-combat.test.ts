import { createBattle } from '@daoyou/combat-core/session';
import type { Command, CreateBattleInput } from '@daoyou/combat-core/types';
import { XIAOYUE_V6_DEFINITION as definition, XIAOYUE_SKILL_ID, XIAOYUE_STATUS_ID } from '@daoyou/game-content/sects/xiaoyue';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { describe, expect, it } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

function setup(methodLevel = 180, enemies = 6) {
  const progress = createEmptySectCombatProgressV6('xiaoyue', definition.paths[0].id,
    Object.fromEntries(definition.methods.map(method => [method.id, methodLevel])));
  const compiled = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const content = compiled.projection;
  const input: CreateBattleInput = {
    seed: 34,
    versions,
    ruleset: { ...createDaoyouRuleset({ formulas: {
      physicalHitChance: () => 1, sealHitChance: () => 1,
      fluctuationMin: 1, fluctuationMax: 1,
      physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    } }), deferredPlayerCommands: true },
    skills: content.skills,
    statusDefs: content.statusDefs,
    units: [
      { id: 's', name: '啸岳', side: 0, kind: 'player', level: 180,
        attrs: { hp: 10000, maxHp: 10000, mp: 10000, maxMp: 10000, speed: 1000, physicalAtk: 1000, physicalDef: 100 },
        tags: content.unitTags, skills: content.activeSkillIds, passives: content.passiveSkillIds,
        skillLevels: content.skillLevels, skillOverrides: content.skillOverrides },
      { id: 'pet', name: '本宠', side: 0, kind: 'pet', ownerId: 's',
        attrs: { hp: 10000, maxHp: 10000, speed: 500, physicalAtk: 400, physicalDef: 100 } },
      ...Array.from({ length: enemies }, (_, i) => ({ id: `t${i}`, name: '对手', side: 1 as const,
        kind: 'npc' as const, attrs: { hp: 100000, maxHp: 100000, speed: 10, physicalAtk: 0, physicalDef: 100 } })),
    ],
  };
  return createBattle(input);
}

type Battle = ReturnType<typeof setup>;
const cast = (skillId: string, targets = ['t0']): Command => ({ type: 'skill', skillId, targets });
function round(battle: Battle, source: Command = { type: 'defend' }, pet: Command = { type: 'defend' }) {
  for (const unit of battle.state.units) {
    if (unit.flags.dead || unit.flags.downed || unit.flags.benched) continue;
    battle.submit(unit.id, unit.id === 's' ? source : unit.id === 'pet' ? pet : { type: 'defend' });
  }
  battle.lockAndResolve();
}
const damage = (battle: Battle, sourceId: string) => battle.log().filter(event => event.type === 'damage' && event.sourceId === sourceId);

describe('啸岳岭基础技能回合边界', () => {
  it('四个变身攻击在兽形前不可用，主动兽形花费 20 法力并开启攻击资格', () => {
    const battle = setup();
    for (const skillId of [XIAOYUE_SKILL_ID.LionStrike, XIAOYUE_SKILL_ID.EagleStrike,
      XIAOYUE_SKILL_ID.ChainStrike, XIAOYUE_SKILL_ID.ElephantSeal]) {
      expect(battle.queryCommands('s').skills.find(skill => skill.skillId === skillId)?.reasons, skillId)
        .toContain('skill-condition');
    }
    round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
    expect(battle.unit('s').attrs.mp).toBe(9980);
    expect(battle.unit('s').statuses.some(status => status.id === XIAOYUE_STATUS_ID.Transform)).toBe(true);
    expect(battle.queryCommands('s').skills.find(skill => skill.skillId === XIAOYUE_SKILL_ID.LionStrike)?.reasons)
      .not.toContain('skill-condition');
  });

  it.each([[30, 3], [50, 4], [75, 5], [125, 6]] as const)(
    '生死搏 %i 级鹏击 %i 人，费用按实际目标结算', (level, count) => {
      const battle = setup(level);
      round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
      round(battle, cast(XIAOYUE_SKILL_ID.EagleStrike));
      expect(damage(battle, 's')).toHaveLength(count);
      expect(battle.unit('s').attrs.mp).toBe(10000 - 20 - 30 - 10 * (count - 1));
    },
  );

  it('鹏击攻击至多六个不同目标，随后跳过人物下一行动而灵兽仍可攻击', () => {
    const battle = setup();
    round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
    round(battle, cast(XIAOYUE_SKILL_ID.EagleStrike, ['t0']), { type: 'attack', target: 't0' });
    const ownerHits = damage(battle, 's');
    expect(ownerHits).toHaveLength(6);
    expect(new Set(ownerHits.map(event => event.type === 'damage' ? event.targetId : '')).size).toBe(6);
    const petHitsBefore = damage(battle, 'pet').length;
    round(battle, cast(XIAOYUE_SKILL_ID.EagleStrike, ['t0']), { type: 'attack', target: 't0' });
    expect(damage(battle, 's')).toHaveLength(6);
    expect(damage(battle, 'pet').length).toBe(petHitsBefore + 1);
    expect(battle.unit('s').statuses.some(status => status.id === XIAOYUE_STATUS_ID.Rest)).toBe(false);
    round(battle, cast(XIAOYUE_SKILL_ID.LionStrike));
    expect(damage(battle, 's')).toHaveLength(7);
  });

  it.each([[30, 2], [50, 3], [75, 5], [125, 6], [175, 7]] as const)(
    '狂兽诀 %i 级连环击 %i 段，按段数预付法力', (level, count) => {
      const battle = setup(level);
      round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
      round(battle, cast(XIAOYUE_SKILL_ID.ChainStrike));
      expect(damage(battle, 's')).toHaveLength(count);
      expect(battle.unit('s').attrs.mp).toBe(10000 - 20 - count * 30);
    },
  );

  it('连环击按可连段数预付法力，首段击倒后停手、取消变身并休息', () => {
    const battle = setup();
    round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
    battle.unit('t0').attrs.hp = 1;
    round(battle, cast(XIAOYUE_SKILL_ID.ChainStrike));
    expect(damage(battle, 's')).toHaveLength(1);
    expect(battle.unit('s').attrs.mp).toBe(9980 - 7 * 30);
    expect(battle.unit('s').statuses.some(status => status.id === XIAOYUE_STATUS_ID.Transform)).toBe(false);
    round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
    expect(battle.unit('s').attrs.mp).toBe(9980 - 7 * 30);
  });

  it('镇形命中后封住目标下一行动、取消自身兽形并付出下一行动的宗门法术限制', () => {
    const battle = setup();
    round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
    round(battle, cast(XIAOYUE_SKILL_ID.ElephantSeal));
    expect(damage(battle, 's')).toHaveLength(1);
    expect(battle.unit('s').statuses.some(status => status.id === XIAOYUE_STATUS_ID.Transform)).toBe(false);
    expect(battle.unit('t0').statuses.some(status => status.id === XIAOYUE_STATUS_ID.Stun ||
      status.id === XIAOYUE_STATUS_ID.StunPending)).toBe(true);
    expect(battle.unit('s').statuses.some(status => status.id === XIAOYUE_STATUS_ID.SpellRest ||
      status.id === XIAOYUE_STATUS_ID.SpellRestPending)).toBe(true);
  });
});
