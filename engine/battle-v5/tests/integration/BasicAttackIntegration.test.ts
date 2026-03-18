// engine/battle-v5/tests/integration/BasicAttackIntegration.test.ts
import { EventBus } from '../../core/EventBus';
import { ActionEvent, SkillPreCastEvent } from '../../core/events';
import { AbilityContainer } from '../../units/AbilityContainer';
import { Unit } from '../../units/Unit';

describe('BasicAttack Integration', () => {
  let owner: Unit;
  let target: Unit;
  let container: AbilityContainer;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();

    owner = new Unit('test_owner', '施法者', {});
    target = new Unit('test_target', '目标', {});

    container = new AbilityContainer(owner);
    container.setDefaultTarget(target);
  });

  afterEach(() => {
    eventBus.reset();
  });

  describe('当没有可用技能时', () => {
    it('should not use basic attack when target is self', () => {
      let skillCastAttempted = false;
      eventBus.subscribe<SkillPreCastEvent>(
        'SkillPreCastEvent',
        () => {
          skillCastAttempted = true;
        },
        100,
      );

      // 设置目标为自身（无效目标）
      container.setDefaultTarget(owner);

      // 发布行动事件
      eventBus.publish<ActionEvent>({
        type: 'ActionEvent',
        priority: 80,
        timestamp: Date.now(),
        caster: owner,
      });

      // 验证没有尝试施法
      expect(skillCastAttempted).toBe(false);
    });

    it('should reuse the same BasicAttack instance', () => {
      // 订阅施法前摇事件
      const abilitiesUsed: string[] = [];
      eventBus.subscribe<SkillPreCastEvent>(
        'SkillPreCastEvent',
        (event) => {
          abilitiesUsed.push(event.ability.id);
        },
        100,
      );

      // 多次触发行动
      eventBus.publish<ActionEvent>({
        type: 'ActionEvent',
        priority: 80,
        timestamp: Date.now(),
        caster: owner,
      });

      eventBus.publish<ActionEvent>({
        type: 'ActionEvent',
        priority: 80,
        timestamp: Date.now(),
        caster: owner,
      });

      // 验证使用了同一个普攻实例（通过ID判断）
      expect(abilitiesUsed).toHaveLength(2);
      expect(abilitiesUsed[0]).toBe('basic_attack');
      expect(abilitiesUsed[1]).toBe('basic_attack');
    });
  });
});
