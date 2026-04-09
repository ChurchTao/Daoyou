import { ActiveSkill } from '../../abilities/ActiveSkill';
import { GameplayTags } from '../../core/GameplayTags';
import { AbilityId, AttributeType, DamageSource } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { DamageRequestEvent, SkillCastEvent, SkillPreCastEvent } from '../../core/events';
import { DamageEffect } from '../../effects/DamageEffect';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { ActionExecutionSystem } from '../../systems/ActionExecutionSystem';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';

class TrackingSkill extends ActiveSkill {
  public executeCount = 0;

  constructor() {
    super('tracking_skill' as AbilityId, '追踪术', {
      mpCost: 40,
      cooldown: 2,
    });
  }

  protected executeSkill(_caster: Unit, _target: Unit): void {
    this.executeCount++;
  }
}

describe('ActionExecutionSystem integration', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  it('missed skill casts should still consume mp and enter cooldown, but skip effects', () => {
    const actionExecutionSystem = new ActionExecutionSystem();
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const skill = new TrackingSkill();
    const initialMp = caster.getCurrentMp();

    let interceptedSkillCast = false;
    EventBus.instance.subscribe<SkillCastEvent>('SkillCastEvent', (event) => {
      interceptedSkillCast = true;
      event.isHit = false;
      event.isDodged = true;
    });

    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(interceptedSkillCast).toBe(true);
    expect(skill.executeCount).toBe(0);
    expect(caster.getCurrentMp()).toBe(initialMp - 40);
    expect(skill.currentCooldown).toBe(2);

    actionExecutionSystem.destroy();
  });

  it('cooldown modification should stay on integral turn boundaries', () => {
    const skill = new TrackingSkill();

    skill.startCooldown();
    skill.modifyCooldown(-0.8);
    expect(skill.currentCooldown).toBe(1);

    skill.modifyCooldown(0.8);
    expect(skill.currentCooldown).toBe(2);

    skill.modifyCooldown(-1.2);
    expect(skill.currentCooldown).toBe(1);

    skill.tickCooldown();
    expect(skill.currentCooldown).toBe(0);
    expect(skill.isReady()).toBe(true);
  });
});

describe('DamageSystem direct mitigation', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  it('direct damage effects should publish direct source so defenses reduce damage', () => {
    const damageSystem = new DamageSystem();
    const attacker = new Unit('attacker', '攻击者', {});
    const defender = new Unit('defender', '防御者', {});

    defender.attributes.addModifier({
      id: 'def_bonus',
      attrType: AttributeType.DEF,
      type: 'fixed',
      value: 20,
      source: 'test',
    });
    defender.updateDerivedStats();

    const receivedRequests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      receivedRequests.push({ ...event });
    });

    const damageEffect = new DamageEffect({
      value: {
        base: 100,
      },
    });

    damageEffect.execute({
      caster: attacker,
      target: defender,
    });

    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0].damageSource).toBe(DamageSource.DIRECT);
    expect(receivedRequests[0].finalDamage).toBeLessThan(100);

    damageSystem.destroy();
  });

  it('AbilityFactory should reject hand-authored active skills with incomplete tags', () => {
    expect(() =>
      AbilityFactory.create({
        slug: 'auto_magic_strike',
        name: '自适应灵击',
        type: 'active_skill',
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 30,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.8,
              },
            },
          },
        ],
      }),
    ).toThrow('[AbilityFactory] ability auto_magic_strike is missing required tags');
  });

  it('AbilityFactory should accept hand-authored active skills with explicit tags', () => {
    const ability = AbilityFactory.create({
      slug: 'explicit_magic_strike',
      name: '明示灵击',
      type: 'active_skill',
      tags: [
        GameplayTags.ABILITY.TYPE_DAMAGE,
        GameplayTags.ABILITY.TYPE_MAGIC,
      ],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 30,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0.8,
            },
          },
        },
      ],
    });

    expect(ability.tags.hasTag(GameplayTags.ABILITY.TYPE_DAMAGE)).toBe(true);
    expect(ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
  });

  it('AbilityFactory should reject damage abilities missing a damage channel tag', () => {
    expect(() =>
      AbilityFactory.create({
        slug: 'missing_damage_channel',
        name: '缺失通道标签',
        type: 'active_skill',
        tags: [GameplayTags.ABILITY.TYPE_DAMAGE],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.6,
              },
            },
          },
        ],
      }),
    ).toThrow(
      `[AbilityFactory] ability missing_damage_channel must include ${GameplayTags.ABILITY.TYPE_MAGIC}`,
    );
  });

  it('AbilityFactory should reject abilities that mix physical and magical damage channels', () => {
    expect(() =>
      AbilityFactory.create({
        slug: 'mixed_damage_channels',
        name: '双通道冲突',
        type: 'active_skill',
        tags: [
          GameplayTags.ABILITY.TYPE_DAMAGE,
          GameplayTags.ABILITY.TYPE_MAGIC,
          GameplayTags.ABILITY.TYPE_PHYSICAL,
        ],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.6,
              },
            },
          },
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.ATK,
                coefficient: 0.6,
              },
            },
          },
        ],
      }),
    ).toThrow('[AbilityFactory] ability mixed_damage_channels mixes multiple damage channels');
  });
});