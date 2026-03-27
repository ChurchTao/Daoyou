import { BattleEngineV5 } from '../../BattleEngineV5';
import { GameplayTags } from '../../core';
import { BuffConfig } from '../../core/configs';
import { EventBus } from '../../core/EventBus';
import { AbilityType, AttributeType, BuffType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { Unit } from '../../units/Unit';

describe('战斗引擎 V5 原子效果全量回归验证 (最终回归版)', () => {
  let randomSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    EventBus.instance.reset();
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  const createTestUnit = (
    id: string,
    name: string,
    attrs: Partial<Record<AttributeType, number>> = {},
  ) => {
    const unit = new Unit(id, name, {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 100,
      [AttributeType.WILLPOWER]: 100,
      [AttributeType.WISDOM]: 100,
      ...attrs,
    });
    unit.restoreMp(1000);
    return unit;
  };

  it('1. 验证【剧毒与驱散】：锁定命中确保流程执行', () => {
    const player = createTestUnit('player', '法海', {
      [AttributeType.SPEED]: 1000,
    });
    const opponent = createTestUnit('opponent', '蛇精', {
      [AttributeType.SPEED]: 0,
    });

    const poisonBuffCfg: BuffConfig = {
      id: 'real_poison',
      name: '万蚁噬心',
      type: BuffType.DEBUFF,
      duration: 3,
      stackRule: 'stack_layer',
      tags: [
        GameplayTags.BUFF.TYPE_DEBUFF,
        GameplayTags.STATUS.POISONED,
        GameplayTags.BUFF.DOT,
      ],
      listeners: [
        {
          eventType: 'ActionPreEvent',
          scope: 'owner_as_actor',
          priority: 45,
          guard: {
            requireOwnerAlive: true,
          },
          effects: [{ type: 'damage', params: { value: { base: 100 } } }],
        },
      ],
    };

    player.abilities.addAbility(
      AbilityFactory.create({
        slug: 'cast_poison',
        name: '施毒术',
        type: AbilityType.ACTIVE_SKILL,
        priority: 100,
        cooldown: 5,
        effects: [
          { type: 'apply_buff', params: { buffConfig: poisonBuffCfg } },
        ],
      }),
    );

    player.abilities.addAbility(
      AbilityFactory.create({
        slug: 'dispel_skill',
        name: '清静咒',
        type: AbilityType.ACTIVE_SKILL,
        priority: 90,
        cooldown: 2, // 增加 CD，让法海在 CD 期间能普攻
        effects: [
          {
            type: 'dispel',
            params: { targetTag: GameplayTags.STATUS.POISONED, maxCount: 1 },
          },
        ],
      }),
    );

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    console.log(result.logs);
  });

  it('3. 验证【反伤与免死】：锁定 1 血存活', () => {
    const attacker = createTestUnit('attacker', '杀手', {
      [AttributeType.VITALITY]: 10000,
      [AttributeType.SPEED]: 1000,
    });
    const defender = createTestUnit('defender', '不死者', {
      [AttributeType.SPEED]: 0,
    });

    defender.buffs.addBuff(
      BuffFactory.create({
        id: 'passive_immortal',
        name: '不灭',
        type: BuffType.BUFF,
        duration: 3,
        stackRule: 'override',
        listeners: [
          {
            eventType: 'DamageTakenEvent',
            scope: 'owner_as_target',
            priority: 50,
            guard: {
              requireOwnerAlive: false,
              allowLethalWindow: true,
              skipReflectSource: true,
            },
            effects: [
              { type: 'reflect', params: { ratio: 0.1 } },
              { type: 'death_prevent', params: {} },
            ],
          },
        ],
      }),
    );

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();

    console.log(result.logs);

    expect(result.logs[2]).toContain('对「不死者」造成');
    expect(result.logs[2]).toContain('反弹');
    expect(result.logs[2]).not.toContain('对「杀手」造成');
    expect(result.logs[2]).not.toContain('\n');
  });

  it('4. 验证【护盾与焚元】：纯粹分步验证', () => {
    const attacker = createTestUnit('striker', '削减者', {
      [AttributeType.SPEED]: 0,
    });
    const defender = createTestUnit('wall', '护盾者', {
      [AttributeType.SPEED]: 0,
    });

    attacker.abilities.addAbility(
      AbilityFactory.create({
        slug: 'burn',
        name: '蚀元咒',
        type: AbilityType.ACTIVE_SKILL,
        priority: 100,
        cooldown: 3,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [{ type: 'mana_burn', params: { value: { base: 100 } } }],
      }),
    );

    defender.abilities.addAbility(
      AbilityFactory.create({
        slug: 'shield',
        name: '真元盾',
        type: AbilityType.ACTIVE_SKILL,
        priority: 90,
        cooldown: 3,
        targetPolicy: { team: 'self', scope: 'single' },
        effects: [{ type: 'shield', params: { value: { base: 200 } } }],
      }),
    );

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();
    console.log(result.logs);

    expect(
      result.logs.some(
        (log) => log.includes('对「护盾者」造成 0 点伤害') && log.includes('抵扣护盾'),
      ),
    ).toBe(true);
  });
});
