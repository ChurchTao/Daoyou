import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { AttributeType } from '../core';
import { TagTriggerParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { TagTriggerEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { CombatMechanicCodeV3 } from '../v3/mechanics';
import { DamageEffect } from './DamageEffect';
import {
  EffectExecutionContextV3,
  GameplayEffect,
  executeGameplayEffectV3,
} from './Effect';

/**
 * 标签触发原子效果
 * 检查目标是否有指定标签，如果有则执行后续逻辑
 */
export class TagTriggerEffect extends GameplayEffect {
  constructor(private params: TagTriggerParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { target, caster, ability } = context;

    // 1. 检查目标是否拥有该标签
    if (
      this.params.triggerTag !== GameplayTags.STATUS.ROOT &&
      !target.tags.hasTag(this.params.triggerTag)
    ) {
      return;
    }

    const narrativeContext = context.withNarrativeCause();
    narrativeContext.commitCue(target, {
      type: 'mechanic',
      code: CombatMechanicCodeV3.TAG_TRIGGER,
      payload: {
        kind: 'tag_trigger',
        label: this.params.displayName ?? '特殊效果',
      },
    });

    narrativeContext.emit<TagTriggerEvent>({
      type: 'TagTriggerEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster,
      target,
      ability,
      tag: this.params.triggerTag,
      displayName: this.params.displayName,
    });
    if (!narrativeContext.canExecuteEffect()) return;

    if (this.params.effects && this.params.effects.length > 0) {
      executeEffectConfigs(this.params.effects, narrativeContext);
    } else {
      // Default payload for a tag trigger without an explicit effect list.
      const damageEffect = new DamageEffect({
        value: {
          base: 50,
          coefficient: this.params.damageRatio || 2.0,
          attribute: AttributeType.SPIRIT,
        },
      });
      executeGameplayEffectV3(damageEffect, narrativeContext);
    }

    if (!narrativeContext.canExecuteEffect()) return;
    if (this.params.removeOnTrigger) {
      const buffs = target.buffs.getAllBuffs();
      const targetBuff = buffs.find((b) =>
        b.tags.hasTag(this.params.triggerTag),
      );
      if (targetBuff) {
        target.buffs.removeBuff(targetBuff.id, {
          ability: narrativeContext.ability,
          buff: narrativeContext.buff,
          attribution: narrativeContext.attribution,
          trace: narrativeContext.trace,
          resolution: narrativeContext.resolution,
        });
      }
    }
  }
}

// 注册
EffectRegistry.getInstance().register(
  'tag_trigger',
  (params) => new TagTriggerEffect(params),
);
