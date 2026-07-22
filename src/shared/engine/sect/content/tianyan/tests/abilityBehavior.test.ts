import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { withBattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  ActionPreEvent,
  BuffImmuneEvent,
  ControlResistEvent,
  DamageTakenEvent,
  MechanicLogEvent,
  SkillCastEvent,
} from '@shared/engine/battle-v5/core/events';
import {
  beginRuntimeAction,
  readRuntimeCounter,
} from '@shared/engine/battle-v5/core/runtimeState';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { DamageSystem } from '@shared/engine/battle-v5/systems/DamageSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import {
  TIANYAN_DERIVATION,
  TIANYAN_ELEMENT_SEAL,
  TIANYAN_STRATEGY_ELEMENT_HISTORY,
} from '../ids';
import {
  TIANYAN_REACTION_ELEMENT_BUFF_TAG,
  TIANYAN_REACTION_MATRIX,
  TIANYAN_SEAL_STATE_TAGS,
  tianyanReactionElementMarkerTag,
} from '../shared/reactions';
import { createElementSeal } from '../shared/seals';
import { tianyanState } from './testState';

function unit(id: string): Unit {
  const result = new Unit(id, id, {
    [AttributeType.VITALITY]: 120,
    [AttributeType.SPIRIT]: 120,
    [AttributeType.WISDOM]: 120,
    [AttributeType.SPEED]: 120,
    [AttributeType.WILLPOWER]: 120,
  });
  result.restoreMp(100_000);
  return result;
}

function setup(path: 'hetu-evolution' | 'luoshu-control' = 'hetu-evolution') {
  const sect = tianyanState(path);
  const projection = projectSectCombat({ sect, realm: '化神' })!;
  const owner = unit('owner');
  const enemy = unit('enemy');
  for (const resource of projection.resources) owner.combatResources.define(resource);
  for (const config of projection.abilities.filter((ability) =>
    ability.type === 'passive_skill')) {
    owner.abilities.addAbility(AbilityFactory.create(config));
  }
  const skill = (abilityId: string) => {
    const config = resolveSectAbility({ sect, realm: '化神', abilityId }).config;
    const result = AbilityFactory.create(config) as ActiveSkill;
    result.setOwner(owner);
    result.setActive(true);
    return result;
  };
  return { owner, enemy, skill };
}

function cast(skill: ActiveSkill, caster: Unit, target: Unit): void {
  skill.prepareCast({ caster, target });
  skill.execute({ caster, target });
}

function castWithRoll(
  skill: ActiveSkill,
  caster: Unit,
  target: Unit,
  roll: number,
): SkillCastEvent {
  const event: SkillCastEvent = {
    type: 'SkillCastEvent',
    timestamp: Date.now(),
    caster,
    target,
    ability: skill,
  };
  skill.prepareCast({ caster, target });
  withBattleRandomSource({ next: () => roll }, () => {
    EventBus.instance.publish(event);
    skill.execute({ caster, target, shouldApplyEffects: event.isHit });
  });
  return event;
}

describe('天衍落印术与反应实际结算', () => {
  let damageSystem: DamageSystem;

  beforeEach(() => {
    EventBus.instance.reset();
    damageSystem = new DamageSystem();
  });
  afterEach(() => {
    damageSystem.destroy();
    EventBus.instance.reset();
  });

  it('无印目标只铺印，不获得衍数', () => {
    const { owner, enemy, skill } = setup();
    cast(skill('verdant-pulse'), owner, enemy);

    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
    expect(enemy.buffs.getAllBuffIds()).toContain(TIANYAN_ELEMENT_SEAL);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.wood)).toBe(true);
  });

  it('落印术被闪避时不造成伤害、不落印且不增加衍数', () => {
    const { owner, enemy, skill } = setup();
    const damages: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => damages.push(event),
      -1_000,
    );

    const event = castWithRoll(skill('verdant-pulse'), owner, enemy, 0);

    expect(event.isHit).toBe(false);
    expect(damages).toHaveLength(0);
    expect(enemy.buffs.getAllBuffIds()).not.toContain(TIANYAN_ELEMENT_SEAL);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
  });

  it.each(TIANYAN_REACTION_MATRIX)(
    '$oldSeal印遇$incoming术完整完成法印、衍数与日志迁移',
    (relation) => {
      const abilityByElement = {
        wood: 'verdant-pulse',
        fire: 'flowing-flame',
        earth: 'earth-bearing-seal',
        metal: 'metal-cloud-cutter',
        water: 'dark-water-return',
      } as const;
      const { owner, enemy, skill } = setup();
      enemy.buffs.addBuff(
        BuffFactory.create(createElementSeal(relation.oldSeal, 1)),
        owner,
      );
      const mechanics: MechanicLogEvent[] = [];
      EventBus.instance.subscribe<MechanicLogEvent>(
        'MechanicLogEvent',
        (event) => mechanics.push(event),
      );

      cast(skill(abilityByElement[relation.incoming]), owner, enemy);

      expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS[relation.incoming])).toBe(true);
      expect(
        enemy.buffs.getAllBuffs().find((buff) => buff.id === TIANYAN_ELEMENT_SEAL)
          ?.getDuration(),
      ).toBe(2);
      const reacts = relation.kind === 'generation' || relation.kind === 'overcoming';
      expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(reacts ? 1 : 0);
      expect(
        mechanics.filter((event) => event.mechanic === 'named_trigger'),
      ).toHaveLength(reacts ? 1 : 0);
      expect(
        mechanics.filter((event) => event.mechanic === 'status_transition'),
      ).toContainEqual(expect.objectContaining({
        operation: relation.kind === 'refresh' ? 'refresh' : 'replace',
        displayName: expect.stringContaining('印'),
      }));
    },
  );

  it('木印遇火术触发燎原，追加固定灼烧伤害且保留两层自然跳数', () => {
    const { owner, enemy, skill } = setup();
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('wood', 2)), owner);
    const damages: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => damages.push(event),
      -1_000,
    );

    cast(skill('flowing-flame'), owner, enemy);

    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(1);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.fire)).toBe(true);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.wood)).toBe(false);
    expect(damages.filter((event) => event.damageSource === DamageSource.DIRECT)).toHaveLength(1);
    expect(damages.filter((event) => event.damageSource === DamageSource.FOLLOW_UP)).toHaveLength(1);
    expect(damages.find((event) => event.damageSource === DamageSource.FOLLOW_UP)?.cause)
      .toMatchObject({ displayName: '燎原' });
    const burn = () => enemy.buffs.getAllBuffs().find((candidate) =>
      candidate.id === 'sect.tianyan.burn');
    expect(burn()?.getLayer()).toBe(2);

    EventBus.instance.publish<ActionPreEvent>({
      type: 'ActionPreEvent',
      timestamp: Date.now(),
      caster: enemy,
    });
    expect(burn()?.getLayer()).toBe(1);
    EventBus.instance.publish<ActionPreEvent>({
      type: 'ActionPreEvent',
      timestamp: Date.now(),
      caster: enemy,
    });
    expect(burn()).toBeUndefined();
  });

  it.each([
    [1, 0.16],
    [2, 0.32],
  ] as const)('蒸发按剩余%i层灼烧追加固定系数%s并清除灼烧', (layers, coefficient) => {
    const { owner, enemy, skill } = setup('luoshu-control');
    cast(skill('flowing-flame'), owner, enemy);
    if (layers === 1) {
      EventBus.instance.publish<ActionPreEvent>({
        type: 'ActionPreEvent',
        timestamp: Date.now(),
        caster: enemy,
      });
    }
    const requests: Array<{ baseDamage: number; cause?: { id: string } }> = [];
    EventBus.instance.subscribe(
      'DamageRequestEvent',
      (event) => {
        const request = event as { baseDamage: number; cause?: { id: string } };
        if (request.cause?.id === 'sect.tianyan.reaction.vaporize') {
          requests.push(request);
        }
      },
      -1_000,
    );

    cast(skill('dark-water-return'), owner, enemy);

    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(Math.round(
      owner.attributes.getValue(AttributeType.MAGIC_ATK) * coefficient,
    ));
    expect(enemy.buffs.getAllBuffIds()).not.toContain('sect.tianyan.burn');
  });

  it('火印遇水术触发蒸发，追加固定终值追伤并明确归因为冲克·蒸发', () => {
    const { owner, enemy, skill } = setup('luoshu-control');
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    const damages: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => damages.push(event),
      -1_000,
    );

    cast(skill('dark-water-return'), owner, enemy);

    const direct = damages.find((event) => event.damageSource === DamageSource.DIRECT);
    const followUp = damages.find((event) => event.damageSource === DamageSource.FOLLOW_UP);
    expect(direct).toBeDefined();
    expect(followUp).toBeDefined();
    expect(followUp?.damageTaken).toBe(Math.round((direct?.damageTaken ?? 0) * 0.8));
    expect(followUp?.cause).toMatchObject({ displayName: '冲克·蒸发' });
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(1);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.water)).toBe(true);
  });

  it('同元素续印只刷新法印，不获得衍数', () => {
    const { owner, enemy, skill } = setup();
    const existing = BuffFactory.create(createElementSeal('water', 1));
    enemy.buffs.addBuff(existing, owner);

    cast(skill('dark-water-return'), owner, enemy);

    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
    expect(
      enemy.buffs.getAllBuffs().find((buff) => buff.id === TIANYAN_ELEMENT_SEAL)
        ?.getDuration(),
    ).toBe(2);
  });

  it('反应元素使用隐藏标记去重，第三种元素后清空通用计数和全部标记', () => {
    const { owner, enemy, skill } = setup();
    const setSeal = (element: 'wood' | 'fire' | 'water') => {
      enemy.buffs.addBuff(BuffFactory.create(createElementSeal(element, 2)), owner);
    };

    setSeal('wood');
    cast(skill('flowing-flame'), owner, enemy);
    const fireMarker = owner.buffs.getAllBuffs().find((candidate) =>
      candidate.tags.hasTag(TIANYAN_REACTION_ELEMENT_BUFF_TAG));
    expect(readRuntimeCounter(owner, TIANYAN_STRATEGY_ELEMENT_HISTORY)).toBe(1);
    expect(owner.tags.hasTag(tianyanReactionElementMarkerTag('fire'))).toBe(true);
    expect(fireMarker).toMatchObject({
      countsAsStatus: false,
      dispelPolicy: 'protected',
      statusVisibility: 'hidden',
      logVisibility: 'debug',
    });

    setSeal('wood');
    cast(skill('flowing-flame'), owner, enemy);
    expect(readRuntimeCounter(owner, TIANYAN_STRATEGY_ELEMENT_HISTORY)).toBe(1);

    cast(skill('dark-water-return'), owner, enemy);
    expect(readRuntimeCounter(owner, TIANYAN_STRATEGY_ELEMENT_HISTORY)).toBe(2);
    cast(skill('earth-bearing-seal'), owner, enemy);

    expect(readRuntimeCounter(owner, TIANYAN_STRATEGY_ELEMENT_HISTORY)).toBe(0);
    expect(owner.buffs.getAllBuffs().some((candidate) =>
      candidate.tags.hasTag(TIANYAN_REACTION_ELEMENT_BUFF_TAG))).toBe(false);
  });

  it('无反应覆盖法印但不产生追伤和衍数', () => {
    const { owner, enemy, skill } = setup();
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('water', 2)), owner);
    const damages: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => damages.push(event),
      -1_000,
    );

    cast(skill('metal-cloud-cutter'), owner, enemy);

    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.metal)).toBe(true);
    expect(damages.some((event) => event.damageSource === DamageSource.FOLLOW_UP)).toBe(false);
  });

  it('太初玄光命中时完全保留现有法印', () => {
    const { owner, enemy, skill } = setup();
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('earth', 2)), owner);

    cast(skill('primordial-ray'), owner, enemy);

    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.earth)).toBe(true);
    expect(
      enemy.buffs.getAllBuffs().find((buff) => buff.id === TIANYAN_ELEMENT_SEAL)
        ?.getDuration(),
    ).toBe(2);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
  });

  it('六门落印术均有独立基础价值，太白破阵无增益时仍正常伤害与落印', () => {
    const directDamageCount = (events: DamageTakenEvent[]) =>
      events.filter((event) => event.damageSource === DamageSource.DIRECT).length;

    {
      const { owner, enemy, skill } = setup();
      owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
      const before = owner.getCurrentHp();
      cast(skill('verdant-pulse'), owner, enemy);
      expect(owner.getCurrentHp()).toBeGreaterThan(before);
      expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.wood)).toBe(true);
    }
    {
      const { owner, enemy, skill } = setup();
      cast(skill('flowing-flame'), owner, enemy);
      expect(enemy.buffs.getAllBuffIds()).toContain('sect.tianyan.burn');
      expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.fire)).toBe(true);
    }
    {
      const { owner, enemy, skill } = setup();
      const before = owner.getCurrentShield();
      cast(skill('earth-bearing-seal'), owner, enemy);
      expect(owner.getCurrentShield()).toBeGreaterThan(before);
      expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.earth)).toBe(true);
    }
    {
      const { owner, enemy, skill } = setup();
      withBattleRandomSource({ next: () => 0 }, () => {
        cast(skill('metal-cloud-cutter'), owner, enemy);
      });
      expect(enemy.buffs.getAllBuffIds()).toContain('sect.tianyan.metal-cut');
      expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.metal)).toBe(true);
    }
    {
      const { owner, enemy, skill } = setup();
      const events: DamageTakenEvent[] = [];
      EventBus.instance.subscribe<DamageTakenEvent>(
        'DamageTakenEvent',
        (event) => events.push(event),
        -1_000,
      );
      cast(skill('white-star-breaker'), owner, enemy);
      expect(directDamageCount(events)).toBe(1);
      expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.metal)).toBe(true);
    }
    {
      const { owner, enemy, skill } = setup();
      cast(skill('dark-water-return'), owner, enemy);
      expect(enemy.buffs.getAllBuffIds()).toContain('sect.tianyan.water-slow');
      expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.water)).toBe(true);
    }
  });

  it('太白破阵只驱散一个普通增益，不影响伤害与落印', () => {
    const { owner, enemy, skill } = setup();
    for (const id of ['test.buff.one', 'test.buff.two']) {
      enemy.buffs.addBuff(BuffFactory.create({
        id,
        name: '测试增益',
        type: BuffType.BUFF,
        duration: 2,
        stackRule: StackRule.REFRESH_DURATION,
        tags: [GameplayTags.BUFF.TYPE.BUFF],
      }), enemy);
    }
    const before = enemy.buffs.getAllBuffIds().filter((id) => id.startsWith('test.buff')).length;

    cast(skill('white-star-breaker'), owner, enemy);

    const after = enemy.buffs.getAllBuffIds().filter((id) => id.startsWith('test.buff')).length;
    expect(after).toBe(before - 1);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.metal)).toBe(true);
  });

  it('火里种莲在空净化时仍付费并获得增益，且至少保留1点气血', () => {
    const { owner, skill } = setup();
    owner.setHp(20);
    const before = owner.getCurrentHp();

    cast(skill('lotus-in-fire'), owner, owner);

    expect(owner.getCurrentHp()).toBeGreaterThanOrEqual(1);
    expect(owner.getCurrentHp()).toBeLessThan(before);
    expect(owner.buffs.getAllBuffIds()).toContain('sect.tianyan.lotus');
  });

  it('坤岳镇形护盾连续施展时直接加入当前总护盾', () => {
    const { owner, enemy, skill } = setup();

    cast(skill('earth-bearing-seal'), owner, enemy);
    const once = owner.getCurrentShield();
    cast(skill('earth-bearing-seal'), owner, enemy);

    expect(once).toBeGreaterThan(0);
    expect(owner.getCurrentShield()).toBe(once * 2);
  });

  it('万木回春结算即时治疗与两次木行持续治疗', () => {
    const { owner, skill } = setup();
    owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
    const before = owner.getCurrentHp();

    cast(skill('myriad-wood-renewal'), owner, owner);
    const afterImmediate = owner.getCurrentHp();
    for (let action = 0; action < 2; action += 1) {
      beginRuntimeAction(owner);
      EventBus.instance.publish<ActionPreEvent>({
        type: 'ActionPreEvent',
        timestamp: Date.now(),
        caster: owner,
      });
    }

    expect(afterImmediate).toBeGreaterThan(before);
    expect(owner.getCurrentHp()).toBeGreaterThan(afterImmediate);
    expect(owner.buffs.getAllBuffIds()).toContain('sect.tianyan.renewal');
  });

  it('天河洗心在空净化时仍回复法力并获得控制抗性', () => {
    const { owner, skill } = setup();
    owner.takeMp(Math.floor(owner.getMaxMp() * 0.5));
    const before = owner.getCurrentMp();

    cast(skill('heavenly-river-cleansing'), owner, owner);

    expect(owner.getCurrentMp()).toBeGreaterThan(before);
    expect(owner.buffs.getAllBuffIds()).toContain('sect.tianyan.river-mind');
  });

  it('蒸发将两层灼烧近似兑现为一次固定追伤并移除灼烧', () => {
    const { owner, enemy, skill } = setup('luoshu-control');
    const settlements: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => {
        if (event.cause?.id === 'sect.tianyan.reaction.vaporize') {
          settlements.push(event);
        }
      },
      -1_000,
    );

    cast(skill('flowing-flame'), owner, enemy);
    const burn = enemy.buffs.getAllBuffs().find(
      (buff) => buff.id === 'sect.tianyan.burn',
    );
    expect(burn?.getDuration()).toBe(2);
    enemy.setHp(enemy.getMaxHp());

    cast(skill('dark-water-return'), owner, enemy);

    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toMatchObject({
      damageSource: DamageSource.FOLLOW_UP,
      cause: { displayName: '蒸发' },
    });
    expect(enemy.buffs.getAllBuffIds()).not.toContain('sect.tianyan.burn');
  });

  it('熔岩是独立DOT，不会被蒸发当作灼烧消费', () => {
    const { owner, enemy, skill } = setup('luoshu-control');
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);

    cast(skill('earth-bearing-seal'), owner, enemy);
    expect(enemy.buffs.getAllBuffIds()).toContain('sect.tianyan.lava');

    enemy.setHp(enemy.getMaxHp());
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    cast(skill('dark-water-return'), owner, enemy);

    expect(enemy.buffs.getAllBuffIds()).toContain('sect.tianyan.lava');
  });

  it.each([
    ['earth-bearing-seal', 'water', 'sect.tianyan.rooted'],
    ['metal-cloud-cutter', 'wood', 'sect.tianyan.no-skill'],
  ] as const)('%s冲克在控制成功时施加控制：%s印', (abilityId, seal, controlId) => {
    const { owner, enemy, skill } = setup('luoshu-control');
    owner.attributes.addModifier({
      id: 'test.control-hit',
      attrType: AttributeType.CONTROL_HIT,
      type: ModifierType.FIXED,
      value: 1,
    });
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal(seal, 2)), owner);

    cast(skill(abilityId), owner, enemy);

    expect(enemy.buffs.getAllBuffIds()).toContain(controlId);
  });

  it.each([
    [
      'earth-bearing-seal',
      'water',
      'sect.tianyan.rooted',
      'sect.tianyan.quagmire-resist-slow',
    ],
    [
      'metal-cloud-cutter',
      'wood',
      'sect.tianyan.no-skill',
      'sect.tianyan.sever-resist',
    ],
  ] as const)(
    '%s冲克被控制抗性抵抗时保留追伤并施加替代削弱',
    (abilityId, seal, controlId, replacementId) => {
      const { owner, enemy, skill } = setup('luoshu-control');
      enemy.attributes.addModifier({
        id: 'test.control-resistance',
        attrType: AttributeType.CONTROL_RESISTANCE,
        type: ModifierType.FIXED,
        value: 1,
      });
      enemy.buffs.addBuff(BuffFactory.create(createElementSeal(seal, 2)), owner);
      const resists: ControlResistEvent[] = [];
      const followUps: DamageTakenEvent[] = [];
      EventBus.instance.subscribe<ControlResistEvent>(
        'ControlResistEvent',
        (event) => resists.push(event),
      );
      EventBus.instance.subscribe<DamageTakenEvent>(
        'DamageTakenEvent',
        (event) => {
          if (event.damageSource === DamageSource.FOLLOW_UP) followUps.push(event);
        },
        -1_000,
      );

      withBattleRandomSource({ next: () => 0 }, () => {
        cast(skill(abilityId), owner, enemy);
      });

      expect(resists).toHaveLength(1);
      expect(followUps).toHaveLength(1);
      expect(enemy.buffs.getAllBuffIds()).not.toContain(controlId);
      expect(enemy.buffs.getAllBuffIds()).toContain(replacementId);
    },
  );

  it.each([
    [
      'earth-bearing-seal',
      'water',
      'sect.tianyan.rooted',
      'sect.tianyan.quagmire-resist-slow',
    ],
    [
      'metal-cloud-cutter',
      'wood',
      'sect.tianyan.no-skill',
      'sect.tianyan.sever-resist',
    ],
  ] as const)(
    '%s冲克遇控制免疫时仍有追伤，但不施加控制或替代削弱',
    (abilityId, seal, controlId, replacementId) => {
      const { owner, enemy, skill } = setup('luoshu-control');
      owner.attributes.addModifier({
        id: 'test.control-hit',
        attrType: AttributeType.CONTROL_HIT,
        type: ModifierType.FIXED,
        value: 1,
      });
      enemy.abilities.addAbility(AbilityFactory.create({
        slug: `test.control-immunity.${abilityId}`,
        name: '控制免疫',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.PASSIVE],
        listeners: [
          {
            eventType: 'BuffAddEvent',
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 1_000,
            effects: [
              {
                type: 'buff_immunity',
                params: { tags: [GameplayTags.BUFF.TYPE.CONTROL] },
              },
            ],
          },
        ],
      }));
      enemy.buffs.addBuff(BuffFactory.create(createElementSeal(seal, 2)), owner);
      const immune: BuffImmuneEvent[] = [];
      const followUps: DamageTakenEvent[] = [];
      EventBus.instance.subscribe<BuffImmuneEvent>(
        'BuffImmuneEvent',
        (event) => immune.push(event),
      );
      EventBus.instance.subscribe<DamageTakenEvent>(
        'DamageTakenEvent',
        (event) => {
          if (event.damageSource === DamageSource.FOLLOW_UP) followUps.push(event);
        },
        -1_000,
      );

      cast(skill(abilityId), owner, enemy);

      expect(immune).toHaveLength(1);
      expect(followUps).toHaveLength(1);
      expect(enemy.buffs.getAllBuffIds()).not.toContain(controlId);
      expect(enemy.buffs.getAllBuffIds()).not.toContain(replacementId);
    },
  );
});
