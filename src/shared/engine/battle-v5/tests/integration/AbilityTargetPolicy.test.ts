
import { EventBus } from '../../core/EventBus';
import { ActionEvent, SkillPreCastEvent } from '../../core/events';
import { AbilityContainer } from '../../units/AbilityContainer';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityId } from '../../core/types';
import { TargetPolicy } from '../../abilities/TargetPolicy';

// 定义一个自增益技能
class SelfBuffSkill extends ActiveSkill {
  constructor() {
    super('self_buff' as AbilityId, '自增益', {
      targetPolicy: TargetPolicy.self(),
      priority: 100, // 高优先级
    });
  }
  protected executeSkill(caster: Unit, target: Unit): void {}
}

// 定义一个伤害技能
class DamageSkill extends ActiveSkill {
  constructor() {
    super('damage_skill' as AbilityId, '伤害技能', {
      targetPolicy: TargetPolicy.default(),
      priority: 50,
    });
  }
  protected executeSkill(caster: Unit, target: Unit): void {}
}

describe('AbilityContainer TargetPolicy 目标选择测试', () => {
  let owner: Unit;
  let opponent: Unit;
  let container: AbilityContainer;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();

    owner = new Unit('owner', '施法者', {});
    opponent = new Unit('opponent', '对手', {});

    container = owner.abilities;
    container.setDefaultTarget(opponent);
  });

  it('应该根据策略选择正确的目标：自增益技能应指向施法者自己', () => {
    const selfBuff = new SelfBuffSkill();
    container.addAbility(selfBuff);

    let capturedTarget: Unit | null = null;
    let capturedAbilityId: string | null = null;

    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedTarget = event.target;
      capturedAbilityId = event.ability.id;
    });

    // 触发行动
    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(capturedAbilityId).toBe('self_buff');
    expect(capturedTarget).toBe(owner); // 目标应该是施法者自己
    expect(capturedTarget).not.toBe(opponent);
  });

  it('应该根据策略选择正确的目标：伤害技能应指向对手', () => {
    const damageSkill = new DamageSkill();
    container.addAbility(damageSkill);

    let capturedTarget: Unit | null = null;
    let capturedAbilityId: string | null = null;

    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedTarget = event.target;
      capturedAbilityId = event.ability.id;
    });

    // 触发行动
    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(capturedAbilityId).toBe('damage_skill');
    expect(capturedTarget).toBe(opponent); // 目标应该是对手
  });

  it('当最高优先级技能是自增益时，不应受默认目标（对手）的影响', () => {
    container.addAbility(new DamageSkill()); // 优先级 50
    container.addAbility(new SelfBuffSkill()); // 优先级 100

    let capturedTarget: Unit | null = null;
    let capturedAbilityId: string | null = null;

    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedTarget = event.target;
      capturedAbilityId = event.ability.id;
    });

    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(capturedAbilityId).toBe('self_buff');
    expect(capturedTarget).toBe(owner);
  });
});
