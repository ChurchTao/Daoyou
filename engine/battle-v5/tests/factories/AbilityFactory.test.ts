import { DataDrivenActiveSkill } from '../../abilities/DataDrivenActiveSkill';
import { DataDrivenPassiveAbility } from '../../abilities/DataDrivenPassiveAbility';
import { StackRule } from '../../buffs/Buff';
import { AbilityConfig, BuffConfig, EffectConfig } from '../../core/configs';
import { EventBus } from '../../core/EventBus';
import { DamageTakenEvent } from '../../core/events';
import {
  AbilityType,
  AttributeType,
  BuffType,
  ModifierType,
} from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';

describe('AbilityFactory V5 Evolution', () => {
  let caster: Unit;
  let target: Unit;
  let damageSystem: DamageSystem;

  beforeEach(() => {
    EventBus.instance.reset();
    damageSystem = new DamageSystem();

    caster = new Unit('caster', '施法者', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
    });

    target = new Unit('target', '目标', {
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  it('主动技能：应该通过效果链完全控制伤害触发', () => {
    const config: AbilityConfig = {
      slug: 'double_strike',
      name: '连击',
      type: AbilityType.ACTIVE_SKILL,
      effects: [
        {
          type: 'damage',
          params: {
            attribute: AttributeType.SPIRIT,
            coefficient: 1.0,
            baseValue: 10,
          },
        },
        {
          type: 'damage',
          params: {
            attribute: AttributeType.SPIRIT,
            coefficient: 1.0,
            baseValue: 10,
          },
        },
      ],
    };

    const skill = AbilityFactory.create(config);

    let damageCount = 0;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (e) => {
      // 过滤模拟的初始事件
      if (e.remainHealth !== undefined) {
        damageCount++;
      }
    });

    skill.execute({ caster, target });

    // 验证是否触发了两次伤害（完全由效果链决定）
    expect(damageCount).toBe(2);
  });

  it('被动技能：应该能监听事件并触发效果', () => {
    const passiveConfig: AbilityConfig = {
      slug: 'counter_attack',
      name: '反击',
      type: AbilityType.PASSIVE_SKILL,
      listeners: [
        {
          eventType: 'DamageTakenEvent',
          effects: [
            {
              type: 'damage',
              params: { baseValue: 50 }, // 受击时反弹 50 点固定伤害
            },
          ],
        },
      ],
    };

    const passive = AbilityFactory.create(
      passiveConfig,
    ) as DataDrivenPassiveAbility;
    caster.abilities.addAbility(passive);

    let counterDamageReceived = false;
    EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (e) => {
      // 验证反击的目标是否正确（原本的攻击者成了现在的受击者）
      if (e.target.id === 'target' && e.damageTaken > 0) {
        counterDamageReceived = true;
      }
    });

    // 模拟 caster 受到来自 target 的伤害
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: 50,
      timestamp: Date.now(),
      caster: target,
      target: caster,
      ability: undefined,
      damageTaken: 10,
      remainHealth: 90,
      isLethal: false,
    });

    expect(counterDamageReceived).toBe(true);
  });

  it('Buff：应该支持宿主标签和属性修正的自动管理', () => {
    const buffConfig: BuffConfig = {
      id: 'stone_skin',
      name: '石肤术',
      type: BuffType.BUFF,
      duration: 3,
      stackRule: StackRule.REFRESH_DURATION,
      statusTags: ['Status.Immune.Bleed'],
      modifiers: [
        {
          attrType: AttributeType.PHYSIQUE,
          type: ModifierType.FIXED,
          value: 50,
        },
      ],
    };

    const effect: EffectConfig = {
      type: 'apply_buff',
      params: { chance: 1.0, buffConfig },
    };

    const skill = new DataDrivenActiveSkill('buff_skill' as const, '加盾');
    skill.addEffect(AbilityFactory.createEffect(effect)!);

    const initialPhysique = caster.attributes.getValue(AttributeType.PHYSIQUE);

    skill.execute({ caster, target: caster });

    // 验证属性提升
    expect(caster.attributes.getValue(AttributeType.PHYSIQUE)).toBe(
      initialPhysique + 50,
    );
    // 验证标签添加
    expect(caster.tags.hasTag('Status.Immune.Bleed')).toBe(true);

    // 模拟 Buff 移除
    caster.buffs.removeBuff('stone_skin');

    // 验证属性回落
    expect(caster.attributes.getValue(AttributeType.PHYSIQUE)).toBe(
      initialPhysique,
    );
    // 验证标签移除
    expect(caster.tags.hasTag('Status.Immune.Bleed')).toBe(false);
  });
});
