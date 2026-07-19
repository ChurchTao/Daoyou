import { GameplayEffect, EffectContext } from './Effect';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ApplyBuffParams } from '../core/configs';
import { BuffFactory } from '../factories/BuffFactory';
import { AttributeType, BuffType } from '../core/types';
import { EventBus } from '../core/EventBus';
import { battleRandom } from '../core/BattleRandom';
import { ControlResistEvent } from '../core/events';
import { getRealmEffectChanceMultiplier } from '@shared/config/realmProgression';

function clampChance(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 施加 Buff 原子效果
 */
export class ApplyBuffEffect extends GameplayEffect {
  constructor(private params: ApplyBuffParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster } = context;
    const target = this.params.target === 'caster' ? caster : context.target;
    const isHostile = caster !== target;

    // 概率检查
    const baseChance = this.params.chance ?? 1;
    let finalChance = baseChance;
    const buffPreview = BuffFactory.create(this.params.buffConfig);
    if (
      isHostile &&
      (buffPreview.type === BuffType.DEBUFF ||
        buffPreview.type === BuffType.CONTROL)
    ) {
      const casterRank = caster.getRealmMeta().realmRank;
      const targetRank = target.getRealmMeta().realmRank;
      if (casterRank !== undefined && targetRank !== undefined) {
        finalChance *= getRealmEffectChanceMultiplier(casterRank - targetRank);
      }
    }

    const resolvedChance = clampChance(finalChance);
    if (resolvedChance <= 0) {
      return;
    }
    if (resolvedChance < 1 && battleRandom() > resolvedChance) {
      return;
    }

    // 创建 Buff 实例并添加到目标
    const buff = buffPreview;

    if (buff.type === BuffType.CONTROL && isHostile) {
      const controlResistance = target.attributes.getValue(
        AttributeType.CONTROL_RESISTANCE,
      );
      const controlHit = caster.attributes.getValue(AttributeType.CONTROL_HIT);
      const resistChance = Math.max(0, (controlResistance - controlHit) * 100);

      if (battleRandom() * 100 < resistChance) {
        EventBus.instance.publish<ControlResistEvent>({
          type: 'ControlResistEvent',
          timestamp: Date.now(),
          caster,
          target,
          ability: context.ability,
          buff,
        });
        return;
      }
    }

    // 控制类 Buff：根据目标神识抗性缩短持续时间。无限持续 (permanent) 不受影响。
    if (buff.type === BuffType.CONTROL && !buff.isPermanent()) {
      const controlResistance = target.attributes.getValue(AttributeType.CONTROL_RESISTANCE);
      if (controlResistance > 0) {
        const currentDuration = buff.getDuration();
        const adjustedDuration = Math.max(
          1,
          Math.round(currentDuration / (1 + controlResistance)),
        );
        buff.refreshToDuration(adjustedDuration);
      }
    }

    target.buffs.addBuff(buff, caster, {
      ability: context.ability,
      buff: context.buff,
    });
  }
}

// 注册
EffectRegistry.getInstance().register('apply_buff', (params) => new ApplyBuffEffect(params));
