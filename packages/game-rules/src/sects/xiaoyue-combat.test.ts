import { createBattle } from '@daoyou/combat-core/session';
import { effectiveAttrs } from '@daoyou/combat-core/units';
import type { Command, CreateBattleInput } from '@daoyou/combat-core/types';
import { XIAOYUE_V6_DEFINITION as definition, XIAOYUE_SKILL_ID, XIAOYUE_STATUS_ID } from '@daoyou/game-content/sects/xiaoyue';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { describe, expect, it } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

function setup(methodLevel = 180, enemies = 6, quick = false, enemyKind: 'npc' | 'player' = 'npc') {
  const progress = createEmptySectCombatProgressV6('xiaoyue', definition.paths[0].id,
    Object.fromEntries(definition.methods.map(method => [method.id, methodLevel])));
  if (quick) {
    progress.meridianDepth = 1;
    progress.meridianLoadouts[0].nodeIds = ['xiaoyue.node.blood.1.2'];
  }
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
        kind: enemyKind, attrs: { hp: 100000, maxHp: 100000, speed: 10, physicalAtk: 0, physicalDef: 100 } })),
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

describe('百兽崖迅捷入场兽形', () => {
  const penalty = 'xiaoyue.status.quick_penalty';

  it('对 NPC 入场即免费获得两回合兽形，首轮可用变身攻击，到期后不再触发', () => {
    const battle = setup(75, 1, true);
    expect(battle.unit('s').statuses.map(status => status.id)).toEqual(expect.arrayContaining([
      XIAOYUE_STATUS_ID.Transform, penalty,
    ]));
    expect(effectiveAttrs(battle.unit('s')).physicalAtk).toBe(1000 + 75 - 180);
    expect(battle.unit('s').attrs.mp).toBe(10000);
    expect(battle.unit('pet').statuses).toHaveLength(0);
    for (const skillId of [XIAOYUE_SKILL_ID.LionStrike, XIAOYUE_SKILL_ID.EagleStrike,
      XIAOYUE_SKILL_ID.ChainStrike, XIAOYUE_SKILL_ID.ElephantSeal]) {
      expect(battle.queryCommands('s').skills.find(skill => skill.skillId === skillId)?.ready, skillId).toBe(true);
    }

    round(battle, cast(XIAOYUE_SKILL_ID.LionStrike));
    expect(damage(battle, 's')).toHaveLength(1);
    expect(battle.unit('s').attrs.mp).toBe(9970);
    expect(battle.unit('s').statuses.map(status => status.id)).toEqual(expect.arrayContaining([
      XIAOYUE_STATUS_ID.Transform, penalty,
    ]));
    round(battle, cast(XIAOYUE_SKILL_ID.LionStrike));
    expect(damage(battle, 's')).toHaveLength(2);
    expect(battle.unit('s').statuses).toHaveLength(0);
    expect(effectiveAttrs(battle.unit('s')).physicalAtk).toBe(1000);
    expect(battle.queryCommands('s').skills.find(skill => skill.skillId === XIAOYUE_SKILL_ID.LionStrike)?.reasons)
      .toContain('skill-condition');
    round(battle);
    expect(battle.log().filter(event => event.type === 'statusApplied' && event.statusId === XIAOYUE_STATUS_ID.Transform))
      .toHaveLength(1);
  });

  it.each([[false, 'npc'], [true, 'player']] as const)(
    '选择迅捷=%s、敌人类型=%s 时不赠送兽形', (quick, enemyKind) => {
      const battle = setup(75, 1, quick, enemyKind);
      expect(battle.unit('s').statuses).toHaveLength(0);
      expect(effectiveAttrs(battle.unit('s')).physicalAtk).toBe(1000);
      round(battle);
      expect(battle.unit('s').statuses).toHaveLength(0);
    },
  );

  it('主动兽形替换迅捷兽形，清除减攻且不叠加物攻', () => {
    const battle = setup(75, 1, true);
    expect(effectiveAttrs(battle.unit('s')).physicalAtk).toBe(1000 + 75 - 180);
    round(battle, cast(XIAOYUE_SKILL_ID.Transform, ['s']));
    expect(battle.unit('s').attrs.mp).toBe(9980);
    expect(battle.unit('s').statuses.filter(status => status.id === XIAOYUE_STATUS_ID.Transform)).toHaveLength(1);
    expect(battle.unit('s').statuses.some(status => status.id === penalty)).toBe(false);
    expect(effectiveAttrs(battle.unit('s')).physicalAtk).toBe(1075);
    round(battle);
    expect(battle.unit('s').statuses.some(status => status.id === XIAOYUE_STATUS_ID.Transform)).toBe(true);
    expect(effectiveAttrs(battle.unit('s')).physicalAtk).toBe(1075);
  });

  it.each([XIAOYUE_SKILL_ID.ChainStrike, XIAOYUE_SKILL_ID.ElephantSeal])(
    '%s 取消迅捷兽形时一并清除减攻，下一回合不补发', skillId => {
      const battle = setup(75, 1, true);
      round(battle, cast(skillId));
      expect(damage(battle, 's').length).toBeGreaterThan(0);
      for (const id of [XIAOYUE_STATUS_ID.Transform, penalty]) {
        expect(battle.unit('s').statuses.some(status => status.id === id), id).toBe(false);
      }
      expect(effectiveAttrs(battle.unit('s')).physicalAtk).toBe(1000);
      round(battle);
      expect(battle.unit('s').statuses.some(status => status.id === XIAOYUE_STATUS_ID.Transform)).toBe(false);
    },
  );
});

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
    const mp = battle.unit('s').attrs.mp;
    round(battle, cast(XIAOYUE_SKILL_ID.Meditate, ['s']));
    expect(battle.unit('s').attrs.mp).toBe(mp);
    expect(battle.unit('s').statuses.some(status => status.id === 'xiaoyue.status.calm')).toBe(false);
  });

  it('兽威只能选敌方灵兽或普通生灵，并在下一行动窗口禁动', () => {
    const battle = setup();
    round(battle, cast(XIAOYUE_SKILL_ID.Intimidate));
    expect(battle.unit('s').attrs.mp).toBe(9980);
    expect(battle.unit('t0').statuses.some(status => status.id === XIAOYUE_STATUS_ID.StunPending ||
      status.id === XIAOYUE_STATUS_ID.Stun)).toBe(true);
    const againstPlayer = setup();
    againstPlayer.unit('t0').kind = 'player';
    round(againstPlayer, cast(XIAOYUE_SKILL_ID.Intimidate));
    expect(againstPlayer.unit('s').attrs.mp).toBe(10000);
    expect(againstPlayer.unit('t0').statuses).toHaveLength(0);
  });

  it('定心、养息和裂甲狂身按说明支付费用并改变有效属性或回气', () => {
    const calm = setup();
    round(calm, cast(XIAOYUE_SKILL_ID.Meditate, ['s']));
    expect(calm.unit('s').attrs.mp).toBe(9960);
    expect(effectiveAttrs(calm.unit('s')).magicAtk).toBe(54);
    expect(effectiveAttrs(calm.unit('s')).magicDef).toBe(54);

    const breath = setup();
    breath.unit('s').attrs.mp = 500;
    round(breath, cast(XIAOYUE_SKILL_ID.ManaBreath, ['s']));
    expect(breath.unit('s').attrs.hp).toBe(9970);
    expect(breath.unit('s').attrs.mp).toBe(500);
    round(breath);
    expect(breath.unit('s').attrs.mp).toBe(590);
    round(breath);
    round(breath);
    expect(breath.unit('s').attrs.mp).toBe(770);
    round(breath);
    expect(breath.unit('s').attrs.mp).toBe(770);

    const unbound = setup();
    round(unbound, cast(XIAOYUE_SKILL_ID.DemonUnbound, ['s']));
    expect(unbound.unit('s').attrs.mp).toBe(9970);
    expect(effectiveAttrs(unbound.unit('s')).physicalDef).toBe(50);
    expect(effectiveAttrs(unbound.unit('s')).physicalAtk).toBe(1010);
  });
});
