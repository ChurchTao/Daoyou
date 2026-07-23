import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { StackRule } from '../../buffs/Buff';
import type {
  BuffLayerChangedEvent,
  DamageRequestEvent,
  HealEvent,
  SkillPreCastEvent,
} from '../../core/events';
import { EventBus } from '../../core/EventBus';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { describeBuffRuntimeSummary } from '../../effects/affixText/buffText';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';

const damageTags = [
  GameplayTags.ABILITY.FUNCTION.DAMAGE,
  GameplayTags.ABILITY.CHANNEL.TRUE,
];

describe('通用分层状态与伤害行为原语', () => {
  beforeEach(() => EventBus.instance.reset());

  it('一次施加多层只发布一次 0→N 事件，满层刷新不重复发布', () => {
    const caster = new Unit('caster', '施术者', {});
    const target = new Unit('target', '目标', {});
    const events: BuffLayerChangedEvent[] = [];
    EventBus.instance.subscribe<BuffLayerChangedEvent>(
      'BuffLayerChangedEvent',
      (event) => events.push(event),
    );
    const effect = AbilityFactory.createEffect({
      type: 'apply_buff',
      params: {
        layers: 5,
        buffConfig: {
          id: 'test.layered',
          name: '分层状态',
          type: BuffType.DEBUFF,
          duration: 3,
          stackRule: StackRule.STACK_LAYER,
          maxLayers: 5,
        },
      },
    })!;

    effect.execute({ caster, target });
    effect.execute({ caster, target });

    expect(target.buffs.getAllBuffs()[0].getLayer()).toBe(5);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      previousLayer: 0,
      currentLayer: 5,
      delta: 5,
      reason: 'apply',
    });
  });

  it('非线性层级属性会随增减层重挂，逐层驱散仅在最后一层移除状态', () => {
    const owner = new Unit('owner', '宿主', {});
    const base = owner.attributes.getValue(AttributeType.MAGIC_ATK);
    const buff = BuffFactory.create({
      id: 'test.curve',
      name: '层级曲线',
      type: BuffType.DEBUFF,
      duration: 3,
      stackRule: StackRule.STACK_LAYER,
      maxLayers: 5,
      dispelMode: 'one_layer',
      modifiers: [{
        attrType: AttributeType.MAGIC_ATK,
        type: ModifierType.ADD,
        value: 0,
        valueByLayer: [-0.03, -0.05, -0.08, -0.12, -0.12],
      }],
    });
    buff.setLayer(4);
    owner.buffs.addBuff(buff);

    expect(owner.attributes.getValue(AttributeType.MAGIC_ATK)).toBeCloseTo(base * 0.88);
    expect(owner.buffs.removeBuffDispel(buff.id)).toBe(true);
    expect(buff.getLayer()).toBe(3);
    expect(owner.attributes.getValue(AttributeType.MAGIC_ATK)).toBeCloseTo(base * 0.92);

    owner.buffs.removeBuffDispel(buff.id);
    owner.buffs.removeBuffDispel(buff.id);
    expect(owner.buffs.getAllBuffIds()).toContain(buff.id);
    owner.buffs.removeBuffDispel(buff.id);
    expect(owner.buffs.getAllBuffIds()).not.toContain(buff.id);
  });

  it('非线性层级属性按相同曲线合并展示，并说明逐层驱散', () => {
    const summary = describeBuffRuntimeSummary({
      id: 'test.curve-display',
      name: '蚀魂',
      type: BuffType.DEBUFF,
      duration: 3,
      stackRule: StackRule.STACK_LAYER,
      maxLayers: 5,
      dispelMode: 'one_layer',
      modifiers: [
        AttributeType.ATK,
        AttributeType.MAGIC_ATK,
        AttributeType.DEF,
        AttributeType.MAGIC_DEF,
        AttributeType.SPEED,
      ].map((attrType) => ({
        attrType,
        type: ModifierType.ADD,
        value: 0,
        valueByLayer: [-0.03, -0.05, -0.08, -0.12, -0.12],
      })).concat([{
        attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
        type: ModifierType.FIXED,
        value: 0,
        valueByLayer: [0, 0.15, 0.30, 0.50, 1],
      }]),
    }, () => '');

    expect(summary).toContain(
      '物攻、法攻、物防、法防、身法：1层-3%，2层-5%，3层-8%，4～5层-12%',
    );
    expect(summary).toContain(
      '受治疗削弱：1层0%，2层15%，3层30%，4层50%，5层100%',
    );
    expect(summary).toContain('普通驱散每次只移除1层');
    expect(summary.join('；')).not.toContain('+0');
  });

  it('受治疗削弱在 Unit.heal 统一封顶，不影响法力恢复', () => {
    const unit = new Unit('unit', '单位', {});
    unit.setHp(unit.getMaxHp() - 100);
    unit.takeMp(100);
    unit.attributes.addModifier({
      id: 'test.heal-reduction-a',
      attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
      type: ModifierType.FIXED,
      value: 0.8,
      source: 'test',
    });
    unit.attributes.addModifier({
      id: 'test.heal-reduction-b',
      attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
      type: ModifierType.FIXED,
      value: 0.5,
      source: 'test',
    });

    expect(unit.heal(100)).toBe(0);
    expect(unit.restoreMp(100)).toBe(100);
  });

  it('不可暴击伤害在满暴击率下仍不暴击，且只发布一个请求', () => {
    const system = new DamageSystem();
    const caster = new Unit('caster', '施术者', {});
    const target = new Unit('target', '目标', {});
    caster.attributes.addModifier({
      id: 'test.crit',
      attrType: AttributeType.CRIT_RATE,
      type: ModifierType.OVERRIDE,
      value: 1,
      source: 'test',
    });
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => requests.push(event),
      -1_000,
    );
    const ability = AbilityFactory.create({
      slug: 'test.non-critical-damage',
      name: '不可暴击伤害',
      type: AbilityType.ACTIVE_SKILL,
      tags: damageTags,
      effects: [{
        type: 'damage',
        params: {
          value: { attribute: AttributeType.MAGIC_ATK, coefficient: 0.7 },
          damageType: DamageType.TRUE,
          damageSource: DamageSource.DIRECT,
          canCrit: false,
          canLifesteal: false,
        },
      }],
    });

    ability.execute({ caster, target });

    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBeCloseTo(
      caster.attributes.getValue(AttributeType.MAGIC_ATK) * 0.7,
    );
    expect(requests[0].isCritical).not.toBe(true);
    expect(requests[0].canLifesteal).toBe(false);
    system.destroy();
  });

  it('canLifesteal=false 会在通用吸血效果入口阻止气血恢复', () => {
    const caster = new Unit('caster', '施术者', {});
    const target = new Unit('target', '目标', {});
    caster.setHp(caster.getMaxHp() - 100);
    const before = caster.getCurrentHp();
    const lifesteal = AbilityFactory.createEffect({
      type: 'lifesteal',
      params: { ratio: 1, maxHpRatioPerAction: 1 },
    })!;

    lifesteal.execute({
      caster,
      target,
      triggerEvent: {
        type: 'DamageTakenEvent',
        timestamp: Date.now(),
        caster,
        target,
        damageSource: DamageSource.DIRECT,
        damageType: DamageType.TRUE,
        damageTaken: 100,
        beforeHp: target.getCurrentHp(),
        remainHp: target.getCurrentHp() - 100,
        isLethal: false,
        canLifesteal: false,
      },
    });

    expect(caster.getCurrentHp()).toBe(before);
  });

  it('AbilityConfig 的 guaranteed 命中策略会透传到施法准备事件', () => {
    const caster = new Unit('caster', '施术者', {});
    const target = new Unit('target', '目标', {});
    const ability = AbilityFactory.create({
      slug: 'test.guaranteed',
      name: '必中术',
      type: AbilityType.ACTIVE_SKILL,
      tags: damageTags,
      hitPolicy: 'guaranteed',
      effects: [{
        type: 'damage',
        params: {
          value: { base: 1 },
          damageType: DamageType.TRUE,
        },
      }],
    });
    caster.abilities.addAbility(ability);
    caster.abilities.setDefaultTarget(target);
    let prepared: SkillPreCastEvent | undefined;
    EventBus.instance.subscribe<SkillPreCastEvent>(
      'SkillPreCastEvent',
      (event) => { if (event.caster === caster) prepared = event; },
      -1_000,
    );

    EventBus.instance.publish({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster,
    });

    expect(prepared?.hitPolicy).toBe('guaranteed');
  });

  it('治疗事件仍以请求值与受疗削弱后的实得值分别记账', () => {
    const caster = new Unit('caster', '施术者', {});
    const target = new Unit('target', '目标', {});
    target.setHp(target.getMaxHp() - 100);
    target.attributes.addModifier({
      id: 'test.half-heal',
      attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
      type: ModifierType.FIXED,
      value: 0.5,
      source: 'test',
    });
    let event: HealEvent | undefined;
    EventBus.instance.subscribe<HealEvent>('HealEvent', (next) => { event = next; });
    AbilityFactory.createEffect({
      type: 'heal',
      params: { value: { base: 100 } },
    })!.execute({ caster, target });

    expect(event?.healAmount).toBe(100);
    expect(event?.appliedAmount).toBe(50);
  });
});
