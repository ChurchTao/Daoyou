import { EventBus } from '../../core/EventBus';
import {
  DamageRequestEvent,
  EventPriorityLevel,
  RoundPreEvent,
  TagAddedEvent,
  TagRemovedEvent,
} from '../../core/events';
import { GameplayTags } from '../../core/GameplayTags';
import {
  AttributeModifier,
  AttributeType,
  BuffId,
  BuffType,
  ModifierType,
} from '../../core/types';
import { Buff, StackRule } from '../Buff';

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
      StackRule.STACK_LAYER, // 可叠加层数
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
    this._subscribeEvent<RoundPreEvent>(
      'RoundPreEvent',
      (event) => {
        this._onRoundPre(event);
      },
      EventPriorityLevel.ROUND_PRE,
    );
  }

  /**
   * 处理回合前置事件
   * - 发布 DamageRequestEvent，进入统一伤害计算管道
   *
   * 事件流程（符合 GAS+EDA 架构）：
   * RoundPreEvent → DamageRequestEvent → [增伤/减伤修正] → DamageEvent → DamageTakenEvent
   */
  private _onRoundPre(_event: RoundPreEvent): void {
    if (!this._owner || !this._owner.isAlive()) return;

    // 计算基础伤害：体魄 * 5 * 层数
    const physique = this._owner.attributes.getValue(AttributeType.PHYSIQUE);
    const baseDamage = Math.floor(physique * 0.5 * this._layer);

    // 发布伤害请求事件，进入统一伤害计算管道
    // 其他系统（如「毒术精通」命格）可订阅此事件进行增伤修正
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      priority: EventPriorityLevel.DAMAGE_REQUEST,
      timestamp: Date.now(),
      caster: this._source || undefined, // DOT 来源（施毒者），可能为 null
      target: this._owner,
      ability: undefined, // DOT 非技能来源
      baseDamage,
      finalDamage: baseDamage, // 初始等于基础伤害，后续由 DamageSystem 修正
      isCritical: false, // DOT 不暴击
      critMultiplier: 1,
    });
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
