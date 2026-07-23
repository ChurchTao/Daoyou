
import { EventBus } from '../../core/EventBus';
import { ActionEvent, ControlledSkipEvent, SkillPreCastEvent } from '../../core/events';
import { AbilityContainer } from '../../units/AbilityContainer';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityId, BuffType } from '../../core/types';
import { TargetPolicy } from '../../abilities/TargetPolicy';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { Buff, StackRule } from '../../buffs/Buff';

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

class HealSkill extends ActiveSkill {
  constructor() {
    super('heal_skill' as AbilityId, '治疗技能', {
      targetPolicy: TargetPolicy.self(),
      priority: 100,
      selectionProfile: { intents: ['heal_hp'] },
    });
    this.tags.addTags([GameplayTags.ABILITY.FUNCTION.HEAL]);
  }
  protected executeSkill(caster: Unit, target: Unit): void {}
}

class ControlSkill extends ActiveSkill {
  constructor() {
    super('control_skill' as AbilityId, '控制技能', {
      targetPolicy: TargetPolicy.default(),
      priority: 100,
      selectionProfile: { intents: ['control'] },
    });
    this.tags.addTags([GameplayTags.ABILITY.FUNCTION.CONTROL]);
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

  it('满血时不应让高优先级治疗技能盖过伤害技能', () => {
    container.addAbility(new HealSkill());
    container.addAbility(new DamageSkill());

    let capturedAbilityId: string | null = null;

    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedAbilityId = event.ability.id;
    });

    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(capturedAbilityId).toBe('damage_skill');
  });

  it('低血时应优先选择治疗技能', () => {
    owner.setHp(owner.getMaxHp() * 0.25);
    container.addAbility(new HealSkill());
    container.addAbility(new DamageSkill());

    let capturedAbilityId: string | null = null;

    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedAbilityId = event.ability.id;
    });

    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(capturedAbilityId).toBe('heal_skill');
  });

  it('目标已有控制时不应重复选择控制技能', () => {
    const existingControl = new Buff(
      'existing_control' as AbilityId,
      '已有控制',
      BuffType.CONTROL,
      2,
      StackRule.OVERRIDE,
    );
    existingControl.tags.addTags([GameplayTags.BUFF.TYPE.CONTROL]);
    opponent.buffs.addBuff(existingControl, owner);

    container.addAbility(new ControlSkill());
    container.addAbility(new DamageSkill());

    let capturedAbilityId: string | null = null;

    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedAbilityId = event.ability.id;
    });

    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(capturedAbilityId).toBe('damage_skill');
  });

  it('禁技时应跳过主动技能并回退到普攻', () => {
    owner.tags.addTags([GameplayTags.STATUS.CONTROL.NO_SKILL]);
    container.addAbility(new DamageSkill());

    let capturedAbilityId: string | null = null;

    eventBus.subscribe<SkillPreCastEvent>('SkillPreCastEvent', (event) => {
      capturedAbilityId = event.ability.id;
    });

    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(capturedAbilityId).toBe('basic_attack');
  });

  it('禁技且禁普攻时应发布受控跳过事件', () => {
    owner.tags.addTags([
      GameplayTags.STATUS.CONTROL.NO_SKILL,
      GameplayTags.STATUS.CONTROL.NO_BASIC,
    ]);
    container.addAbility(new DamageSkill());

    let skipEvent: ControlledSkipEvent | null = null;

    eventBus.subscribe<ControlledSkipEvent>('ControlledSkipEvent', (event) => {
      skipEvent = event;
    });

    eventBus.publish<ActionEvent>({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: owner,
    });

    expect(skipEvent?.unit).toBe(owner);
  });
});
