import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { withBattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  BattleInitEvent,
  RoundStartEvent,
  SkillCastEvent,
} from '@shared/engine/battle-v5/core/events';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { DamageSystem } from '@shared/engine/battle-v5/systems/DamageSystem';
import { CombatLogSystem } from '@shared/engine/battle-v5/systems/log/CombatLogSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import { TIANYAN_DERIVATION, TIANYAN_LUOSHU_PATH_ID } from '../ids';
import { createElementSeal } from '../shared/seals';
import { tianyanState } from './testState';

function unit(id: string, name: string): Unit {
  const result = new Unit(id, name, {
    [AttributeType.VITALITY]: 120,
    [AttributeType.SPIRIT]: 120,
    [AttributeType.WISDOM]: 120,
    [AttributeType.SPEED]: 120,
    [AttributeType.WILLPOWER]: 120,
  });
  result.restoreMp(100_000);
  return result;
}

describe('天衍战斗日志接入现有管道', () => {
  let damageSystem: DamageSystem;
  let logs: CombatLogSystem;

  beforeEach(() => {
    EventBus.instance.reset();
    logs = new CombatLogSystem();
    logs.subscribe(EventBus.instance);
    damageSystem = new DamageSystem();
  });
  afterEach(() => {
    damageSystem.destroy();
    logs.destroy();
    EventBus.instance.reset();
  });

  it('蒸发与洛书断局分别显示触发依据和追伤原因，不泄漏内部ID', () => {
    const sect = tianyanState(TIANYAN_LUOSHU_PATH_ID);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    const owner = unit('owner', '天衍弟子');
    const enemy = unit('enemy', '玄甲傀儡');
    for (const resource of projection.resources) owner.combatResources.define(resource);
    owner.combatResources.set(TIANYAN_DERIVATION, 2);
    for (const config of projection.abilities.filter((ability) =>
      ability.type === 'passive_skill')) {
      owner.abilities.addAbility(AbilityFactory.create(config));
    }
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    const config = resolveSectAbility({
      sect, realm: '化神', abilityId: 'dark-water-return',
    }).config;
    const skill = AbilityFactory.create(config) as ActiveSkill;
    skill.setOwner(owner);
    skill.setActive(true);

    EventBus.instance.publish<BattleInitEvent>({
      type: 'BattleInitEvent', timestamp: Date.now(), player: owner, opponent: enemy,
    });
    EventBus.instance.publish<RoundStartEvent>({
      type: 'RoundStartEvent', timestamp: Date.now(), turn: 1,
    });
    withBattleRandomSource({ next: () => 0.5 }, () => {
      EventBus.instance.publish<SkillCastEvent>({
        type: 'SkillCastEvent', timestamp: Date.now(), caster: owner, target: enemy,
        ability: skill,
      });
      skill.prepareCast({ caster: owner, target: enemy });
      skill.execute({ caster: owner, target: enemy });
    });

    const text = logs.getPlayerLogs().join('\n');
    expect(text).toContain(
      '「天衍弟子」因「玄甲傀儡」的「火印」与本次「水术」发生「冲克」，触发「蒸发」',
    );
    expect(text).toContain('因「冲克·蒸发」追加伤害');
    expect(text).toContain('因「洛书断局」追加伤害');
    expect(text).not.toContain('乘势追击');
    expect(text).not.toMatch(/sect\.tianyan|reaction\.vaporize|element\.water/);

    const ai = logs.getAIData();
    expect(JSON.stringify(ai)).toContain('sect.tianyan.reaction.vaporize');
    expect(JSON.stringify(ai)).toContain('sect.tianyan.luoshu-break');
  });

  it('主伤害击杀目标时不输出未实际结算的冲克、追伤或换印日志', () => {
    const sect = tianyanState(TIANYAN_LUOSHU_PATH_ID);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    const owner = unit('owner', '天衍弟子');
    const enemy = unit('enemy', '残损傀儡');
    for (const resource of projection.resources) owner.combatResources.define(resource);
    for (const config of projection.abilities.filter((ability) =>
      ability.type === 'passive_skill')) {
      owner.abilities.addAbility(AbilityFactory.create(config));
    }
    enemy.setHp(1);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    const config = resolveSectAbility({
      sect, realm: '化神', abilityId: 'dark-water-return',
    }).config;
    const skill = AbilityFactory.create(config) as ActiveSkill;
    skill.setOwner(owner);
    skill.setActive(true);

    EventBus.instance.publish<BattleInitEvent>({
      type: 'BattleInitEvent', timestamp: Date.now(), player: owner, opponent: enemy,
    });
    EventBus.instance.publish<RoundStartEvent>({
      type: 'RoundStartEvent', timestamp: Date.now(), turn: 1,
    });
    withBattleRandomSource({ next: () => 0.5 }, () => {
      EventBus.instance.publish<SkillCastEvent>({
        type: 'SkillCastEvent', timestamp: Date.now(), caster: owner, target: enemy,
        ability: skill,
      });
      skill.prepareCast({ caster: owner, target: enemy });
      skill.execute({ caster: owner, target: enemy });
    });

    const text = logs.getPlayerLogs().join('\n');
    expect(text).toContain('「残损傀儡」被击败');
    expect(text).not.toContain('发生「冲克」');
    expect(text).not.toContain('冲克·蒸发');
    expect(text).not.toContain('转为「水印」');
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(1);
  });
});
