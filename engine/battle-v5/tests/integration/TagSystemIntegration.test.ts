import { Buff, StackRule } from '../../buffs/Buff';
import { EventBus } from '../../core/EventBus';
import { GameplayTags } from '@/engine/shared/tag-domain';
import { BuffAddEvent, BuffImmuneEvent, EventPriorityLevel } from '../../core/events';
import { DispelEffect } from '../../effects/DispelEffect';
import { AbilityType, BuffId, BuffType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { Unit } from '../../units/Unit';

function addBuffImmunityPassive(unit: Unit, tags: string[]): void {
  unit.abilities.addAbility(
    AbilityFactory.create({
      slug: `buff_immunity_${tags.join('_')}`,
      name: '万法不侵',
      type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.PASSIVE],
      listeners: [
        {
          eventType: 'BuffAddEvent',
          scope: 'owner_as_target',
          priority: EventPriorityLevel.BUFF_INTERCEPT,
          effects: [{ type: 'buff_immunity', params: { tags } }],
        },
      ],
    }),
  );
}

describe('标签系统集成测试', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  describe('BUFF 免疫系统', () => {
    it('免疫效果应拦截命中标签的 DEBUFF 添加', () => {
      const unit = new Unit('test', '测试', {});
      addBuffImmunityPassive(unit, [GameplayTags.BUFF.TYPE.DEBUFF]);

      const debuff = new Buff('poison' as BuffId, '中毒', BuffType.DEBUFF, 3);
      debuff.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);

      const container = unit.buffs;
      container.addBuff(debuff);

      expect(container.getAllBuffIds()).not.toContain('poison');
    });

    it('免疫效果不应影响未命中标签的 BUFF 添加', () => {
      const unit = new Unit('test', '测试', {});
      addBuffImmunityPassive(unit, [GameplayTags.BUFF.TYPE.DEBUFF]);

      const buff = new Buff('strength' as BuffId, '力量', BuffType.BUFF, 3);
      buff.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

      const container = unit.buffs;
      container.addBuff(buff);

      expect(container.getAllBuffIds()).toContain('strength');
    });

    it('拦截成功时应发布 BuffImmuneEvent', () => {
      const unit = new Unit('test', '测试', {});
      addBuffImmunityPassive(unit, [GameplayTags.BUFF.TYPE.DEBUFF]);

      const debuff = new Buff('poison' as BuffId, '中毒', BuffType.DEBUFF, 3);
      debuff.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);

      let immuneTag: string | undefined;
      const handler = (event: BuffImmuneEvent) => {
        immuneTag = event.immuneTag;
      };
      EventBus.instance.subscribe<BuffImmuneEvent>('BuffImmuneEvent', handler, EventPriorityLevel.COMBAT_LOG);

      const container = unit.buffs;
      container.addBuff(debuff);

      expect(container.getAllBuffIds()).not.toContain('poison');
      expect(immuneTag).toBe(GameplayTags.BUFF.TYPE.DEBUFF);

      EventBus.instance.unsubscribe<BuffImmuneEvent>('BuffImmuneEvent', handler);
    });

    it('通用 debuff 免疫应拦截带 control 标签的控制 buff', () => {
      const unit = new Unit('test', '测试', {});
      addBuffImmunityPassive(unit, [GameplayTags.BUFF.TYPE.DEBUFF]);

      const controlBuff = new Buff('stun' as BuffId, '眩晕', BuffType.CONTROL, 2);
      controlBuff.tags.addTags([
        GameplayTags.BUFF.TYPE.DEBUFF,
        GameplayTags.BUFF.TYPE.CONTROL,
      ]);

      unit.buffs.addBuff(controlBuff);

      expect(unit.buffs.getAllBuffIds()).not.toContain('stun');
    });
  });

  describe('BUFF 驱散系统', () => {
    it('通用 debuff 驱散应移除带 control 标签的控制 buff', () => {
      const unit = new Unit('test', '测试', {});
      const controlBuff = new Buff('stun' as BuffId, '眩晕', BuffType.CONTROL, 2);
      controlBuff.tags.addTags([
        GameplayTags.BUFF.TYPE.DEBUFF,
        GameplayTags.BUFF.TYPE.CONTROL,
      ]);

      unit.buffs.addBuff(controlBuff);
      expect(unit.buffs.getAllBuffIds()).toContain('stun');

      new DispelEffect({
        targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
        maxCount: 1,
      }).execute({ caster: unit, target: unit });

      expect(unit.buffs.getAllBuffIds()).not.toContain('stun');
    });
  });

  describe('BUFF 拦截事件', () => {
    it('应发布 BuffAddEvent', () => {
      const unit = new Unit('test', '测试', {});
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);

      let eventReceived = false;
      const handler = () => {
        eventReceived = true;
      };
      EventBus.instance.subscribe<BuffAddEvent>(
        'BuffAddEvent',
        handler,
        EventPriorityLevel.BUFF_INTERCEPT,
      );

      unit.buffs.addBuff(buff);

      expect(eventReceived).toBe(true);
      EventBus.instance.unsubscribe<BuffAddEvent>('BuffAddEvent', handler);
    });

    it('取消 BuffAddEvent 应阻止 BUFF 添加', () => {
      const unit = new Unit('test', '测试', {});
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);

      const handler = (e: BuffAddEvent) => {
        e.isCancelled = true;
      };
      EventBus.instance.subscribe(
        'BuffAddEvent',
        handler,
        EventPriorityLevel.BUFF_INTERCEPT,
      );

      unit.buffs.addBuff(buff);

      expect(unit.buffs.getAllBuffIds()).not.toContain('test');
      EventBus.instance.unsubscribe('BuffAddEvent', handler);
    });

    it('buff_duration_modify 应延长命中标签的正面 buff 持续时间', () => {
      const unit = new Unit('test', '测试', {});

      unit.abilities.addAbility(
        AbilityFactory.create({
          slug: 'buff_duration_extend',
          name: '状态持延',
          type: AbilityType.PASSIVE_SKILL,
          tags: [GameplayTags.ABILITY.KIND.PASSIVE],
          listeners: [
            {
              eventType: 'BuffAddEvent',
              scope: 'owner_as_target',
              priority: EventPriorityLevel.BUFF_INTERCEPT,
              effects: [
                {
                  type: 'buff_duration_modify',
                  params: {
                    rounds: 1,
                    tags: [GameplayTags.BUFF.TYPE.BUFF],
                  },
                },
              ],
            },
          ],
        }),
      );

      const buff = new Buff('focus' as BuffId, '凝神', BuffType.BUFF, 3);
      buff.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

      unit.buffs.addBuff(buff);

      expect(buff.getDuration()).toBe(4);
      expect(buff.getMaxDuration()).toBe(4);
    });
  });

  describe('BUFF 堆叠规则', () => {
    it('REFRESH_DURATION 应刷新持续时间', () => {
      const unit = new Unit('test', '测试', {});
      const buff1 = new Buff(
        'test' as BuffId,
        '测试',
        BuffType.BUFF,
        3,
        StackRule.REFRESH_DURATION,
      );
      buff1.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

      unit.buffs.addBuff(buff1);
      buff1.tickDuration();
      expect(buff1.getDuration()).toBe(2);

      const buff2 = new Buff(
        'test' as BuffId,
        '测试',
        BuffType.BUFF,
        5,
        StackRule.REFRESH_DURATION,
      );
      buff2.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

      unit.buffs.addBuff(buff2);
      expect(buff1.getDuration()).toBe(5);
    });

    it('IGNORE 应忽略新 BUFF', () => {
      const unit = new Unit('test', '测试', {});
      const buff1 = new Buff(
        'test' as BuffId,
        '测试',
        BuffType.BUFF,
        3,
        StackRule.IGNORE,
      );
      buff1.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

      unit.buffs.addBuff(buff1);
      expect(buff1.getDuration()).toBe(3);

      const buff2 = new Buff(
        'test' as BuffId,
        '测试',
        BuffType.BUFF,
        5,
        StackRule.IGNORE,
      );
      buff2.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

      unit.buffs.addBuff(buff2);
      expect(buff1.getDuration()).toBe(3);
    });
  });

  describe('BuffContainer.clone', () => {
    it('克隆应保留所有 BUFF 和标签', () => {
      const unit = new Unit('test', '测试', {});
      const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);
      buff.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);
      unit.buffs.addBuff(buff);

      const clonedContainer = unit.buffs.clone(unit);

      expect(clonedContainer.getAllBuffIds()).toContain('test');
    });
  });
});
