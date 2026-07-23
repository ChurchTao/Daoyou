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
import { checkConditions } from '../core/conditionEvaluator';

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
    if (!target.isAlive()) return;
    const resolvedCaster = buff?.getSource() ?? caster;

    // 使用统一计算器计算基础伤害（传入 target 以支持 targetMaxHpRatio）
    const damageResult = ValueCalculator.calculateDetailed(
      this.params.value,
      resolvedCaster,
      target,
    );
    let damage = damageResult.total;
    const damageComponents: DamageComponent[] = [...damageResult.components];
    for (const scalar of this.params.dynamicScalars ?? []) {
      if (scalar.source !== 'target_missing_hp_ratio') continue;
      const targetHpRatio = scalar.timing === 'live'
        ? target.getHpPercent()
        : context.castSnapshot?.targetHpRatioBeforeEffects ?? target.getHpPercent();
      const missingHpRatio = Math.max(0, 1 - targetHpRatio);
      if (
        scalar.minMissingHpRatio !== undefined &&
        missingHpRatio <= Math.max(0, scalar.minMissingHpRatio) + 1e-9
      ) continue;
      const coefficient = missingHpRatio * scalar.coefficientCap;
      const attributeValue = resolvedCaster.attributes.getValue(scalar.attribute);
      const amount = attributeValue * coefficient;
      damage += amount;
      if (amount > 0) {
        damageComponents.push({
          kind: `target_missing_hp:${scalar.attribute}`,
          amount,
          mitigation: 'normal',
          attackBase: attributeValue,
          segmentMultiplier: coefficient,
        });
      }
    }
    const bypassDefenseRatio = this.params.bypassDefense
      ? 1
      : Math.max(0, Math.min(1, this.params.bypassDefenseRatio ?? 0));
    if (bypassDefenseRatio > 0) {
      const splitComponents: DamageComponent[] = [];
      for (const component of damageComponents) {
        if (component.mitigation === 'bypass_defense') {
          splitComponents.push(component);
          continue;
        }
        if (bypassDefenseRatio < 1) {
          splitComponents.push({
            ...component,
            amount: component.amount * (1 - bypassDefenseRatio),
            segmentMultiplier:
              component.segmentMultiplier === undefined
                ? undefined
                : component.segmentMultiplier * (1 - bypassDefenseRatio),
          });
        }
        splitComponents.push({
          kind: `${component.kind}:bypass`,
          amount: component.amount * bypassDefenseRatio,
          mitigation: 'bypass_defense',
        });
      }
      damageComponents.splice(0, damageComponents.length, ...splitComponents);
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
        const normalIndex = damageComponents.findIndex(
          (component) =>
            component.mitigation === 'normal' &&
            component.attackBase !== undefined &&
            component.segmentMultiplier !== undefined,
        );
        if (normalIndex >= 0) {
          const component = damageComponents[normalIndex];
          const multiplier = component.segmentMultiplier ?? 1;
          damageComponents[normalIndex] = {
            ...component,
            amount: component.amount + memoryDamage,
            attackBase: (component.attackBase ?? 0) + memoryDamage / multiplier,
          };
        } else {
          damageComponents.push({
            kind: `memory:${bonusDamageMemory.key}`,
            amount: memoryDamage,
            mitigation: 'normal',
            attackBase: memoryDamage,
            segmentMultiplier: 1,
          });
        }
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
          segmentMultiplier:
            component.segmentMultiplier === undefined
              ? undefined
              : component.segmentMultiplier * layer,
        })),
      );
    }

    if (damage <= 0) return;
    if (!activeTransform && ability instanceof ActiveSkill) {
      consumeAbilityTransform(caster, ability);
    }

    // 发布伤害请求事件
    const conditionCritical =
      this.params.forceCriticalConditions?.length
        ? checkConditions(context, this.params.forceCriticalConditions)
        : false;
    const forceCritical = this.params.canCrit === false
      ? false
      : this.params.forceCritical || transform?.forceCritical || conditionCritical;
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: resolvedCaster,
      target,
      ability,
      buff, // 传递 buff
      damageSource:
        this.params.damageSource ??
        (context.triggerEvent?.type === 'DamageTakenEvent'
          ? DamageSource.REFLECT
          : DamageSource.DIRECT),
      damageType:
        this.params.damageType ??
        (transform?.trueDamage ? DamageType.TRUE : this.inferDamageType(buff)),
      cause: this.params.cause ?? context.damageCause,
      damageComponents,
      baseDamage: damage,
      finalDamage: damage, // 初始终伤等于基伤，由后续系统修正
      forceCritical,
      canCrit: this.params.canCrit ?? true,
      canLifesteal: this.params.canLifesteal ?? true,
      isCritical: forceCritical ? true : undefined,
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
