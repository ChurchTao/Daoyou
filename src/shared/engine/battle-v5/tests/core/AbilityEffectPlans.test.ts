import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ActiveSkill } from '../../abilities/ActiveSkill';
import { LayeredDataDrivenActiveSkill } from '../../abilities/LayeredDataDrivenActiveSkill';
import { StackRule } from '../../buffs/Buff';
import type { AbilityConfig, EffectConfig } from '../../core/configs';
import { EventBus } from '../../core/EventBus';
import { readAbilityMode, setAbilityMode } from '../../core/runtimeState';
import { AbilityType, AttributeType, BuffType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { GameplayTags } from '../../../shared/tag-domain';
import { Unit } from '../../units/Unit';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 10,
    [AttributeType.WISDOM]: 10,
    [AttributeType.SPEED]: 10,
    [AttributeType.WILLPOWER]: 10,
  });
}

function marker(id: string): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'caster',
      buffConfig: {
        id,
        name: id,
        type: BuffType.BUFF,
        duration: 1,
        stackRule: StackRule.OVERRIDE,
      },
    },
  };
}

function layeredConfig(): AbilityConfig {
  return {
    slug: 'layered-test',
    name: '佛相式',
    description: 'A',
    type: AbilityType.ACTIVE_SKILL,
    tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
    costs: [{ resource: 'hp', mode: 'current_hp_ratio', ratio: 0.05, retain: 1 }],
    cooldown: 2,
    targetPolicy: { team: 'enemy', scope: 'single' },
    selectionProfile: { intents: ['buff'] },
    effects: [marker('a-main')],
    completionEffects: [marker('completed-first'), marker('a-done')],
    effectLayers: [
      { id: 'demon', effects: [marker('b-main')], completionEffects: [marker('b-done')] },
      { id: 'formless', effects: [marker('c-main')], completionEffects: [marker('c-done')] },
    ],
    effectPlans: [
      {
        id: 'formless', name: '无相式', description: 'A+B+C', priority: 300,
        conditions: [{ type: 'ability_mode_is', params: { scope: 'caster', key: 'form', mode: 'formless' } }],
        layerIds: ['demon', 'formless'], consumeModeKey: 'form',
      },
      {
        id: 'demon', name: '魔相式', description: 'A+B', priority: 200,
        conditions: [{ type: 'ability_mode_is', params: { scope: 'caster', key: 'form', mode: 'demon' } }],
        layerIds: ['demon'], consumeModeKey: 'form',
      },
    ],
  };
}

describe('技能效果层与计划', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it.each([
    ['buddha', undefined, ['a-main', 'completed-first', 'a-done']],
    ['demon', 'demon', ['a-main', 'b-main', 'completed-first', 'a-done', 'b-done']],
    ['formless', 'formless', ['a-main', 'b-main', 'c-main', 'completed-first', 'a-done', 'b-done', 'c-done']],
  ] as const)('%s 依次执行固定 A、追加层和完成效果', (_label, mode, expected) => {
    const caster = unit('caster');
    const target = unit('target');
    const skill = AbilityFactory.create(layeredConfig()) as ActiveSkill;
    skill.setOwner(caster);
    if (mode) {
      setAbilityMode(caster, {
        key: 'form', mode, remainingUses: mode === 'demon' ? 2 : 1,
        displayName: mode,
      });
    }

    skill.execute({ caster, target });

    expect(caster.buffs.getAllBuffIds()).toEqual(expected);
  });

  it('优先级选中无相计划，且三相共享目标、费用、冷却和选招意图', () => {
    const caster = unit('caster');
    const target = unit('target');
    const skill = AbilityFactory.create(layeredConfig()) as LayeredDataDrivenActiveSkill;
    skill.setOwner(caster);
    setAbilityMode(caster, {
      key: 'form', mode: 'formless', remainingUses: 1, displayName: '无相',
    });

    expect(skill.name).toBe('无相式');
    expect(skill.runtimePlanId).toBe('formless');
    expect(skill.targetPolicy).toMatchObject({ team: 'enemy', scope: 'single' });
    expect(skill.costConfigs).toEqual(layeredConfig().costs);
    expect(skill.maxCooldown).toBe(2);
    expect(skill.selectionProfile).toEqual({ intents: ['buff'] });
    skill.execute({ caster, target });
    expect(readAbilityMode(caster, 'form')).toBeUndefined();
  });

  it('施法准备后冻结计划，clone 保留配置但不复制准备态', () => {
    const caster = unit('caster');
    const target = unit('target');
    const skill = AbilityFactory.create(layeredConfig()) as LayeredDataDrivenActiveSkill;
    skill.setOwner(caster);
    setAbilityMode(caster, {
      key: 'form', mode: 'formless', remainingUses: 1, displayName: '无相',
    });
    skill.prepareCast({ caster, target });
    setAbilityMode(caster, {
      key: 'form', mode: 'demon', remainingUses: 2, displayName: '魔相',
    });
    const cloneOwner = unit('clone-owner');
    const clone = skill.clone();
    clone.setOwner(cloneOwner);

    expect(skill.name).toBe('无相式');
    expect(skill.runtimePlanId).toBe('formless');
    expect(clone.name).toBe('佛相式');
    expect(clone.runtimePlanId).toBeUndefined();
    skill.execute({ caster, target });
    expect(caster.buffs.getAllBuffIds()).toEqual([
      'a-main', 'b-main', 'c-main', 'completed-first', 'a-done', 'b-done', 'c-done',
    ]);
    expect(readAbilityMode(caster, 'form')).toMatchObject({ mode: 'demon', remainingUses: 1 });
  });

  it('未命中不执行主效果、完成效果或消费 mode', () => {
    const caster = unit('caster');
    const target = unit('target');
    const skill = AbilityFactory.create(layeredConfig()) as ActiveSkill;
    skill.setOwner(caster);
    setAbilityMode(caster, {
      key: 'form', mode: 'demon', remainingUses: 2, displayName: '魔相',
    });

    skill.execute({ caster, target, shouldApplyEffects: false });

    expect(caster.buffs.getAllBuffIds()).toEqual([]);
    expect(readAbilityMode(caster, 'form')).toMatchObject({ remainingUses: 2 });
  });

  it('主效果合法 no-op 时仍执行完成效果并消费 mode', () => {
    const caster = unit('caster');
    const target = unit('target');
    const config = layeredConfig();
    config.effects = [{ type: 'dispel', params: { targetTag: 'missing', maxCount: 1 } }];
    config.completionEffects = [marker('completed')];
    config.effectLayers = [{ id: 'demon' }];
    config.effectPlans = [config.effectPlans![1]];
    const skill = AbilityFactory.create(config) as ActiveSkill;
    skill.setOwner(caster);
    setAbilityMode(caster, {
      key: 'form', mode: 'demon', remainingUses: 2, displayName: '魔相',
    });

    skill.execute({ caster, target });

    expect(caster.buffs.getAllBuffIds()).toEqual(['completed']);
    expect(readAbilityMode(caster, 'form')).toMatchObject({ remainingUses: 1 });
  });

  it.each([
    ['duplicate layer', { effectLayers: [{ id: 'same' }, { id: 'same' }] }],
    ['duplicate plan', { effectPlans: [
      { id: 'same', name: 'one', priority: 2, conditions: [], layerIds: [] },
      { id: 'same', name: 'two', priority: 1, conditions: [], layerIds: [] },
    ] }],
    ['unknown layer', { effectPlans: [
      { id: 'plan', name: 'plan', priority: 1, conditions: [], layerIds: ['missing'] },
    ] }],
    ['duplicate reference', {
      effectLayers: [{ id: 'layer' }],
      effectPlans: [{ id: 'plan', name: 'plan', priority: 1, conditions: [], layerIds: ['layer', 'layer'] }],
    }],
    ['plan override', {
      effectPlans: [{
        id: 'plan', name: 'plan', priority: 1, conditions: [], layerIds: [],
        costs: [{ resource: 'hp', mode: 'flat', amount: 1 }],
        targetPolicy: { team: 'self', scope: 'single' },
        selectionProfile: { intents: ['damage'] },
        cooldown: 0,
        tags: [],
      }],
    }],
  ] as const)('工厂拒绝 %s', (_label, override) => {
    expect(() => AbilityFactory.create({ ...layeredConfig(), ...override })).toThrow();
  });

});
