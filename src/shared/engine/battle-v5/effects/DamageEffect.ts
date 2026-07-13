import { DamageParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { EventBus } from '../core/EventBus';
import { DamageRequestEvent } from '../core/events';
import {
  AttributeType,
  type DamageComponent,
  DamageSource,
  DamageType,
} from '../core/types';
import {
  clearMemory,
  consumeAbilityTransform,
  getActiveAbilityTransform,
  peekAbilityTransform,
  readMemory,
} from '../core/runtimeState';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { StackRule } from '../buffs/Buff';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 伤害原子效果
 * 职责：计算伤害并发布 DamageRequestEvent
 */
export class DamageEffect extends GameplayEffect {
  constructor(private params: DamageParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target, ability, buff } = context;
    const resolvedCaster = buff?.getSource() ?? caster;

    // 使用统一计算器计算基础伤害（传入 target 以支持 targetMaxHpRatio）
    const damageResult = ValueCalculator.calculateDetailed(
      this.params.value,
      resolvedCaster,
      target,
    );
    let damage = damageResult.total;
    const damageComponents: DamageComponent[] = [...damageResult.components];
    if (this.params.bypassDefense) {
      damageComponents.splice(
        0,
        damageComponents.length,
        ...damageComponents.map((component) => ({
          ...component,
          mitigation: 'bypass_defense' as const,
        })),
      );
    }
    const activeTransform =
      ability instanceof ActiveSkill
        ? getActiveAbilityTransform(ability)
        : undefined;
    const transform =
      activeTransform ??
      (ability instanceof ActiveSkill
        ? peekAbilityTransform(caster, ability)
        : undefined);
    const bonusDamageMemory = transform?.bonusDamageMemory;
    if (bonusDamageMemory) {
      const memory = readMemory(caster, bonusDamageMemory.key);
      if (memory.amount > 0) {
        const memoryDamage = Math.round(
          memory.amount * (bonusDamageMemory.ratio ?? 1),
        );
        damage += memoryDamage;
        damageComponents.push({
          kind: `memory:${bonusDamageMemory.key}`,
          amount: memoryDamage,
          mitigation: 'normal',
        });
        if (bonusDamageMemory.consume !== false) {
          clearMemory(caster, bonusDamageMemory.key);
        }
      }
    }

    if (
      buff &&
      buff.stackRule === StackRule.STACK_LAYER &&
      buff.tags.hasTag(GameplayTags.BUFF.DOT.ROOT)
    ) {
      const layer = buff.getLayer();
      damage *= layer;
      damageComponents.splice(
        0,
        damageComponents.length,
        ...damageComponents.map((component) => ({
          ...component,
          amount: component.amount * layer,
        })),
      );
    }

    if (damage <= 0) return;
    if (!activeTransform && ability instanceof ActiveSkill) {
      consumeAbilityTransform(caster, ability);
    }

    // 发布伤害请求事件
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: resolvedCaster,
      target,
      ability,
      buff, // 传递 buff
      damageSource:
        context.triggerEvent?.type === 'DamageTakenEvent'
          ? DamageSource.REFLECT
          : DamageSource.DIRECT,
      damageType:
        this.params.damageType ??
        (transform?.trueDamage ? DamageType.TRUE : this.inferDamageType(buff)),
      damageComponents,
      baseDamage: damage,
      finalDamage: damage, // 初始终伤等于基伤，由后续系统修正
      isCritical: transform?.forceCritical ? true : undefined,
    });

    if (transform?.addDispel && !transform.addDispelApplied) {
      transform.addDispelApplied = true;
      executeEffectConfigs([transform.addDispel], context);
    }
  }

  private inferDamageType(buff: EffectContext['buff']): DamageType | undefined {
    if (buff?.tags.hasTag(GameplayTags.BUFF.DOT.ROOT)) {
      return DamageType.DOT;
    }

    const attribute = this.params.value.attribute;
    if (
      attribute === AttributeType.MAGIC_ATK ||
      attribute === AttributeType.MAGIC_DEF
    ) {
      return DamageType.MAGICAL;
    }
    if (attribute === AttributeType.ATK || attribute === AttributeType.DEF) {
      return DamageType.PHYSICAL;
    }
    return undefined;
  }
}

// 注册到效果注册表
EffectRegistry.getInstance().register(
  'damage',
  (params) => new DamageEffect(params),
);
