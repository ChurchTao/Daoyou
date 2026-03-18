// engine/battle-v5/tests/units/AbilityContainer.test.ts
import { AbilityContainer } from '../../units/AbilityContainer';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { ActionEvent } from '../../core/events';

describe('AbilityContainer', () => {
  let owner: Unit;
  let container: AbilityContainer;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    owner = new Unit('test_unit', '测试单位', {});
    container = new AbilityContainer(owner);
  });

  afterEach(() => {
    eventBus.reset();
  });

  describe('Skill selection and casting', () => {
    it('should subscribe to ActionEvent and trigger skill selection', () => {
      const skill = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
      skill.setPriority(10);
      skill.setManaCost(10);
      skill.setDamageCoefficient(1.5);
      skill.setIsMagicAbility(true);

      owner.currentMp = 50;
      container.addAbility(skill);

      // 发布行动事件
      eventBus.publish<ActionEvent>({
        type: 'ActionEvent',
        priority: 80,
        timestamp: Date.now(),
        caster: owner,
      });

      // 验证技能被选择
      // TODO: 通过验证后续事件来确认
    });

    it('should skip skills with insufficient mana', () => {
      const skill = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
      skill.setManaCost(100);
      container.addAbility(skill);

      owner.currentMp = 10;

      const available = container.getAvailableAbilities();
      expect(available).toHaveLength(0);
    });
  });
});
