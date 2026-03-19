import { Buff, StackRule } from '../Buff';
import { BuffId, BuffType, AttributeType, ModifierType, AttributeModifier } from '../../core/types';
import { Unit } from '../../units/Unit';
import { GameplayTags } from '../../core/GameplayTags';
import { EventBus } from '../../core/EventBus';
import { RoundPreEvent, TagAddedEvent, TagRemovedEvent, DamageEvent, EventPriorityLevel } from '../../core/events';

/**
 * PoisonDotBuff - 中毒持续伤害 Buff
 *
 * GAS+EDA 架构示例实现：
 * - 持有 owner 引用，主动订阅 RoundPreEvent
 * - 使用层数机制，每层增加伤害
 * - 发布标签事件（TagAddedEvent/TagRemovedEvent）
 * - 降低身法 20%，每回合造成体魄 * 5 * 层数的伤害
 *
 * 设计文档参考：docs/battle-v5-tags.md
 */
export class PoisonDotBuff extends Buff {
  private _modifierId: string;

  constructor(layer: number = 1) {
    super(
      'poison_dot' as BuffId,
      '中毒',
      BuffType.DEBUFF,
      3, // 持续 3 回合
      StackRule.STACK_LAYER // 可叠加层数
    );

    // 设置初始层数
    this._layer = layer;
    this._modifierId = `poison_debuff_${this.id}_${Date.now()}`;

    // 设置标签
    this.tags.addTags([
      GameplayTags.BUFF.TYPE_DEBUFF,
      GameplayTags.BUFF.DOT_POISON,
      GameplayTags.BUFF.ELEMENT_POISON,
    ]);
  }

  /**
   * Buff 激活时的初始化（GAS 模式）
   * - 给目标添加中毒标签
   * - 发布标签添加事件
   * - 添加属性修改器（降低身法 20%）
   * - 订阅回合前置事件
   */
  override onActivate(): void {
    if (!this._owner) return;

    // 1. 给目标添加中毒标签
    this._owner.tags.addTags([GameplayTags.STATUS.POISONED]);

    // 2. 发布标签添加事件
    EventBus.instance.publish<TagAddedEvent>({
      type: 'TagAddedEvent',
      priority: EventPriorityLevel.TAG_CHANGE,
      timestamp: Date.now(),
      target: this._owner,
      tag: GameplayTags.STATUS.POISONED,
      source: this,
    });

    // 3. 添加属性修改器（降低身法 20%）
    const modifier: AttributeModifier = {
      id: this._modifierId,
      attrType: AttributeType.AGILITY,
      type: ModifierType.MULTIPLY,
      value: 0.8, // 80% 身法（降低 20%）
      source: this,
    };
    this._owner.attributes.addModifier(modifier);

    // 4. 订阅回合前置事件，触发 DOT 伤害
    this._subscribeEvent<RoundPreEvent>('RoundPreEvent', (event) => {
      this._onRoundPre(event);
    }, EventPriorityLevel.ROUND_PRE);
  }

  /**
   * 处理回合前置事件
   * - 造成体魄 * 5 * 层数的伤害
   * - 持续时间减 1，为 0 时移除
   */
  private _onRoundPre(_event: RoundPreEvent): void {
    if (!this._owner || !this._owner.isAlive()) return;

    // 计算伤害：体魄 * 5 * 层数
    const physique = this._owner.attributes.getValue(AttributeType.PHYSIQUE);
    const damage = Math.floor(physique * 5 * this._layer);

    // 发布伤害事件
    EventBus.instance.publish<DamageEvent>({
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      timestamp: Date.now(),
      caster: null, // DOT 伤害无施法者
      target: this._owner,
      ability: null, // 无技能来源
      finalDamage: damage,
    });

    // 持续时间减 1
    this.tickDuration();

    // 持续时间归零时移除
    if (this.isExpired() && this._owner) {
      this._owner.buffs.removeBuffExpired(this.id);
    }
  }

  /**
   * Buff 移除时的清理（GAS 模式）
   * - 移除中毒标签
   * - 发布标签移除事件
   * - 移除属性修改器
   */
  override onDeactivate(): void {
    // 先调用父类方法（取消所有事件订阅）
    super.onDeactivate();

    if (!this._owner) return;

    // 1. 移除中毒标签
    this._owner.tags.removeTags([GameplayTags.STATUS.POISONED]);

    // 2. 发布标签移除事件
    EventBus.instance.publish<TagRemovedEvent>({
      type: 'TagRemovedEvent',
      priority: EventPriorityLevel.TAG_CHANGE,
      timestamp: Date.now(),
      target: this._owner,
      tag: GameplayTags.STATUS.POISONED,
      source: this,
    });

    // 3. 移除属性修改器
    this._owner.attributes.removeModifier(this._modifierId);
  }

  /**
   * 克隆 Buff
   */
  override clone(): PoisonDotBuff {
    const cloned = new PoisonDotBuff(this._layer);
    cloned.setDuration(this.getDuration());
    return cloned;
  }
}
