/**
 * PoisonDotBuff 测试用例
 * 验证 GAS+EDA 架构下 DOT Buff 的完整能力
 *
 * 测试场景：
 * 1. Buff 激活：标签添加、属性修改器生效
 * 2. DOT 触发：回合前置结算时造成伤害
 * 3. 层数机制：叠加层数增加伤害
 * 4. Buff 移除：标签移除、属性修改器清除
 * 5. 免疫机制：免疫标签阻止 Buff 添加
 */

import { Buff, StackRule } from '../../buffs/Buff';
import { EventBus } from '../../core/EventBus';
import {
  DamageEvent,
  EventPriorityLevel,
  RoundPreEvent,
  TagAddedEvent,
  TagRemovedEvent,
} from '../../core/events';
import { GameplayTags } from '../../core/GameplayTags';
import { AttributeType, BuffType, ModifierType } from '../../core/types';
import { Unit } from '../../units/Unit';

// 测试用 DOT Buff 实现（简化版，用于验证架构能力）
class TestPoisonDotBuff extends Buff {
  private _modifierId: string;
  private _dotHandler: ((event: RoundPreEvent) => void) | null = null;

  constructor(layer: number = 1) {
    super('poison_dot', '中毒', BuffType.DEBUFF, 3, StackRule.STACK_LAYER);
    this._layer = layer;
    this._modifierId = `poison_mod_${Date.now()}`;
    this.tags.addTags([
      GameplayTags.BUFF.TYPE_DEBUFF,
      GameplayTags.BUFF.DOT_POISON,
      GameplayTags.BUFF.ELEMENT_POISON,
    ]);
  }

  override onActivate(): void {
    if (!this._owner) return;

    // 添加标签
    this._owner.tags.addTags([GameplayTags.STATUS.POISONED]);

    // 发布标签添加事件
    EventBus.instance.publish<TagAddedEvent>({
      type: 'TagAddedEvent',
      priority: EventPriorityLevel.TAG_CHANGE,
      timestamp: Date.now(),
      target: this._owner,
      tag: GameplayTags.STATUS.POISONED,
      source: this,
    });

    // 添加属性修改器（降低身法 20%）
    this._owner.attributes.addModifier({
      id: this._modifierId,
      attrType: AttributeType.AGILITY,
      type: ModifierType.MULTIPLY,
      value: 0.8,
      source: this,
    });

    // 订阅回合前置事件
    this._dotHandler = (event: RoundPreEvent) => this._onRoundPre(event);
    this._subscribeEvent<RoundPreEvent>(
      'RoundPreEvent',
      this._dotHandler,
      EventPriorityLevel.ROUND_PRE,
    );
  }

  private _onRoundPre(_event: RoundPreEvent): void {
    if (!this._owner || !this._owner.isAlive()) return;

    // 造成体魄 * 5 * 层数的伤害
    const physique = this._owner.attributes.getValue(AttributeType.PHYSIQUE);
    const damage = Math.floor(physique * 5 * this._layer);

    EventBus.instance.publish<DamageEvent>({
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      timestamp: Date.now(),
      caster: null,
      target: this._owner,
      ability: null,
      finalDamage: damage,
    });

    this.tickDuration();
    if (this.isExpired() && this._owner) {
      this._owner.buffs.removeBuffExpired(this.id);
    }
  }

  override onDeactivate(): void {
    super.onDeactivate();
    if (!this._owner) return;

    // 移除标签
    this._owner.tags.removeTags([GameplayTags.STATUS.POISONED]);

    // 发布标签移除事件
    EventBus.instance.publish<TagRemovedEvent>({
      type: 'TagRemovedEvent',
      priority: EventPriorityLevel.TAG_CHANGE,
      timestamp: Date.now(),
      target: this._owner,
      tag: GameplayTags.STATUS.POISONED,
      source: this,
    });

    // 移除属性修改器
    this._owner.attributes.removeModifier(this._modifierId);
  }

  override clone(): TestPoisonDotBuff {
    const cloned = new TestPoisonDotBuff(this._layer);
    cloned.setDuration(this.getDuration());
    return cloned;
  }
}

describe('PoisonDotBuff - GAS+EDA 架构能力验证', () => {
  let eventBus: EventBus;
  let events: { type: string; data: unknown }[];

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    events = [];

    // 记录所有事件
    eventBus.subscribe(
      'TagAddedEvent',
      (e) => events.push({ type: 'TagAddedEvent', data: e }),
      0,
    );
    eventBus.subscribe(
      'TagRemovedEvent',
      (e) => events.push({ type: 'TagRemovedEvent', data: e }),
      0,
    );
    eventBus.subscribe(
      'DamageEvent',
      (e) => events.push({ type: 'DamageEvent', data: e }),
      0,
    );
    eventBus.subscribe(
      'BuffAppliedEvent',
      (e) => events.push({ type: 'BuffAppliedEvent', data: e }),
      0,
    );
    eventBus.subscribe(
      'BuffImmuneEvent',
      (e) => events.push({ type: 'BuffImmuneEvent', data: e }),
      0,
    );
  });

  afterEach(() => {
    eventBus.reset();
  });

  describe('1. Buff 激活机制', () => {
    it('激活时应添加中毒标签', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.SPIRIT]: 100,
        [AttributeType.PHYSIQUE]: 100,
        [AttributeType.AGILITY]: 100,
        [AttributeType.CONSCIOUSNESS]: 100,
        [AttributeType.COMPREHENSION]: 100,
      });

      const buff = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff);

      // 验证标签被添加
      expect(unit.tags.hasTag(GameplayTags.STATUS.POISONED)).toBe(true);

      // 验证发布了标签添加事件
      const tagAddedEvents = events.filter((e) => e.type === 'TagAddedEvent');
      expect(tagAddedEvents.length).toBe(1);
      expect((tagAddedEvents[0].data as TagAddedEvent).tag).toBe(
        GameplayTags.STATUS.POISONED,
      );
    });

    it('激活时应降低身法 20%', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.AGILITY]: 100,
      });

      const originalAgility = unit.attributes.getValue(AttributeType.AGILITY);
      expect(originalAgility).toBe(100);

      const buff = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff);

      // 身法应该降低到 80
      const newAgility = unit.attributes.getValue(AttributeType.AGILITY);
      expect(newAgility).toBe(80);
    });
  });

  describe('2. DOT 伤害触发', () => {
    it('回合前置结算时应造成 DOT 伤害', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.PHYSIQUE]: 100,
        [AttributeType.AGILITY]: 100,
      });

      const buff = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff);

      // 清空之前的事件
      events.length = 0;

      // 发布回合前置事件
      eventBus.publish<RoundPreEvent>({
        type: 'RoundPreEvent',
        priority: EventPriorityLevel.ROUND_PRE,
        timestamp: Date.now(),
        turn: 1,
      });

      // 验证伤害事件被发布
      const damageEvents = events.filter((e) => e.type === 'DamageEvent');
      expect(damageEvents.length).toBe(1);

      // 验证伤害值：体魄 100 * 5 * 1层 = 500
      const damageEvent = damageEvents[0].data as DamageEvent;
      expect(damageEvent.finalDamage).toBe(500);
      expect(damageEvent.target.id).toBe('test');
    });

    it('DOT 伤害应该受层数影响', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.PHYSIQUE]: 100,
        [AttributeType.AGILITY]: 100,
      });

      // 创建 3 层中毒
      const buff = new TestPoisonDotBuff(3);
      unit.buffs.addBuff(buff);

      events.length = 0;

      eventBus.publish<RoundPreEvent>({
        type: 'RoundPreEvent',
        priority: EventPriorityLevel.ROUND_PRE,
        timestamp: Date.now(),
        turn: 1,
      });

      const damageEvents = events.filter((e) => e.type === 'DamageEvent');
      const damageEvent = damageEvents[0].data as DamageEvent;

      // 伤害：体魄 100 * 5 * 3层 = 1500
      expect(damageEvent.finalDamage).toBe(1500);
    });
  });

  describe('3. 层数叠加机制', () => {
    it('相同 ID 的 Buff 应该叠加层数', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.PHYSIQUE]: 100,
        [AttributeType.AGILITY]: 100,
      });

      // 添加第一个中毒
      const buff1 = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff1);

      // 添加第二个中毒（应该叠加层数）
      const buff2 = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff2);

      // 验证只有一个 Buff
      const allBuffs = unit.buffs.getAllBuffs();
      expect(allBuffs.length).toBe(1);

      // 验证层数为 2
      expect(allBuffs[0].getLayer()).toBe(2);
    });
  });

  describe('4. Buff 移除机制', () => {
    it('移除时应清除中毒标签', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.PHYSIQUE]: 100,
        [AttributeType.AGILITY]: 100,
      });

      const buff = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff);

      expect(unit.tags.hasTag(GameplayTags.STATUS.POISONED)).toBe(true);

      events.length = 0;

      // 移除 Buff
      unit.buffs.removeBuff('poison_dot');

      // 验证标签被移除
      expect(unit.tags.hasTag(GameplayTags.STATUS.POISONED)).toBe(false);

      // 验证发布了标签移除事件
      const tagRemovedEvents = events.filter(
        (e) => e.type === 'TagRemovedEvent',
      );
      expect(tagRemovedEvents.length).toBe(1);
    });

    it('移除时应恢复身法', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.AGILITY]: 100,
      });

      const buff = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff);
      expect(unit.attributes.getValue(AttributeType.AGILITY)).toBe(80);

      unit.buffs.removeBuff('poison_dot');
      expect(unit.attributes.getValue(AttributeType.AGILITY)).toBe(100);
    });
  });

  describe('5. 免疫机制', () => {
    it('免疫 DEBUFF 标签应阻止中毒添加', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.PHYSIQUE]: 100,
        [AttributeType.AGILITY]: 100,
      });

      // 添加免疫标签
      unit.tags.addTags([GameplayTags.STATUS.IMMUNE_DEBUFF]);

      const buff = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff);

      // 验证 Buff 没有被添加
      expect(unit.buffs.getAllBuffs().length).toBe(0);
      expect(unit.tags.hasTag(GameplayTags.STATUS.POISONED)).toBe(false);

      // 验证发布了免疫事件
      const immuneEvents = events.filter((e) => e.type === 'BuffImmuneEvent');
      expect(immuneEvents.length).toBe(1);
    });
  });

  describe('6. 完整战斗流程验证', () => {
    it('Buff 应在 3 回合后自动过期', () => {
      const unit = new Unit('test', '测试单位', {
        [AttributeType.PHYSIQUE]: 100,
        [AttributeType.AGILITY]: 100,
      });

      const buff = new TestPoisonDotBuff(1);
      unit.buffs.addBuff(buff);

      // 模拟 3 个回合
      for (let turn = 1; turn <= 3; turn++) {
        eventBus.publish<RoundPreEvent>({
          type: 'RoundPreEvent',
          priority: EventPriorityLevel.ROUND_PRE,
          timestamp: Date.now(),
          turn,
        });
      }

      // Buff 应该已过期移除
      expect(unit.buffs.getAllBuffs().length).toBe(0);
      expect(unit.tags.hasTag(GameplayTags.STATUS.POISONED)).toBe(false);
    });
  });
});
