import type { AbilitySelectionCandidate } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { AttributeType, BuffType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import { TIANYAN_HETU_PATH_ID, TIANYAN_LUOSHU_PATH_ID } from '../ids';
import { TIANYAN_HETU_PATH_MODULE, TIANYAN_LUOSHU_PATH_MODULE } from '../paths';
import { tianyanReactionElementMarkerTag } from '../shared/reactions';
import { createElementSeal } from '../shared/seals';
import { TianyanBaseSelectionStrategy } from '../strategy';
import { tianyanState, type TianyanPathId } from './testState';

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

function context(pathId: TianyanPathId | undefined, abilityIds: string[]) {
  const sect = tianyanState(pathId);
  const caster = unit('owner');
  const opponent = unit('enemy');
  const candidates: AbilitySelectionCandidate[] = abilityIds.map(
    (abilityId, order) => {
      const ability = AbilityFactory.create(
        resolveSectAbility({ sect, realm: '化神', abilityId }).config,
      ) as ActiveSkill;
      ability.setOwner(caster);
      ability.setActive(true);
      return {
        ability,
        target: ability.targetPolicy.team === 'enemy' ? opponent : caster,
        order,
      };
    },
  );
  return { caster, opponent, candidates };
}

function selectedId(
  result: ReturnType<
    ReturnType<
      typeof TIANYAN_HETU_PATH_MODULE.createSelectionStrategy
    >['select']
  >,
): string | undefined {
  return result?.ability.id.replace('sect.tianyan.', '');
}

describe('天衍基础施法策略', () => {
  const strategy = new TianyanBaseSelectionStrategy();

  it('未选择流派时投影基础策略，无印时选择耗蓝最低的落印术', () => {
    expect(
      projectSectCombat({
        sect: tianyanState(),
        realm: '化神',
      })?.selectionStrategy,
    ).toBeInstanceOf(TianyanBaseSelectionStrategy);
    const battle = context(undefined, ['flowing-flame', 'verdant-pulse']);

    expect(selectedId(strategy.select(battle))).toBe('verdant-pulse');
  });

  it('有印时优先合法反应，不会继续施展同元素落印术', () => {
    const battle = context(undefined, ['verdant-pulse', 'flowing-flame']);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('wood', 2)),
      battle.caster,
    );

    expect(selectedId(strategy.select(battle))).toBe('flowing-flame');
  });

  it('多个合法反应中优先本轮未使用的元素，再比较实际耗蓝', () => {
    const battle = context(undefined, [
      'dark-water-return',
      'earth-bearing-seal',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('fire', 2)),
      battle.caster,
    );
    battle.caster.buffs.addBuff(
      BuffFactory.create({
        id: 'sect.tianyan.element-history.water',
        name: '水行已用',
        type: BuffType.BUFF,
        duration: -1,
        stackRule: 'override',
        statusTags: [tianyanReactionElementMarkerTag('water')],
        countsAsStatus: false,
      }),
      battle.caster,
    );

    expect(selectedId(strategy.select(battle))).toBe('earth-bearing-seal');
  });

  it('有印但没有合法反应时优先移宫，否则返回太初玄光', () => {
    const shift = context(undefined, ['metal-cloud-cutter', 'shift-palace']);
    shift.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('water', 2)),
      shift.caster,
    );
    expect(selectedId(strategy.select(shift))).toBe('shift-palace');

    const wait = context(undefined, ['metal-cloud-cutter']);
    wait.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('water', 2)),
      wait.caster,
    );
    expect(strategy.select(wait)).toBeNull();
  });
});

describe('天衍六套自动战术', () => {
  it('双道途六套战术都能创建独立策略', () => {
    for (const tactic of TIANYAN_HETU_PATH_MODULE.definition.tactics) {
      expect(
        TIANYAN_HETU_PATH_MODULE.createSelectionStrategy(tactic.id),
      ).toBeDefined();
    }
    for (const tactic of TIANYAN_LUOSHU_PATH_MODULE.definition.tactics) {
      expect(
        TIANYAN_LUOSHU_PATH_MODULE.createSelectionStrategy(tactic.id),
      ).toBeDefined();
    }
  });

  it('小周天识别当前法印并优先合法反应', () => {
    const battle = context(TIANYAN_HETU_PATH_ID, [
      'metal-cloud-cutter',
      'dark-water-return',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('fire', 2)),
      battle.caster,
    );

    const result =
      TIANYAN_HETU_PATH_MODULE.createSelectionStrategy('small-cycle').select(
        battle,
      );

    expect(selectedId(result)).toBe('dark-water-return');
  });

  it('小周天无印时选择实际法力消耗最低的落印术', () => {
    const battle = context(TIANYAN_HETU_PATH_ID, [
      'white-star-breaker',
      'metal-cloud-cutter',
    ]);

    const result =
      TIANYAN_HETU_PATH_MODULE.createSelectionStrategy('small-cycle').select(
        battle,
      );

    expect(selectedId(result)).toBe('metal-cloud-cutter');
  });

  it('小周天优先补全本轮尚未使用的反应元素', () => {
    const battle = context(TIANYAN_HETU_PATH_ID, [
      'dark-water-return',
      'earth-bearing-seal',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('fire', 2)),
      battle.caster,
    );
    battle.caster.buffs.addBuff(
      BuffFactory.create({
        id: 'sect.tianyan.element-history.water',
        name: '水行已用',
        type: BuffType.BUFF,
        duration: -1,
        stackRule: 'override',
        statusTags: [tianyanReactionElementMarkerTag('water')],
        countsAsStatus: false,
      }),
      battle.caster,
    );

    const result =
      TIANYAN_HETU_PATH_MODULE.createSelectionStrategy('small-cycle').select(
        battle,
      );

    expect(selectedId(result)).toBe('earth-bearing-seal');
  });

  it('不绝在无合法反应且没有移宫时使用太初玄光保留法印', () => {
    const battle = context(TIANYAN_HETU_PATH_ID, [
      'metal-cloud-cutter',
      'primordial-ray',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('water', 2)),
      battle.caster,
    );

    const result =
      TIANYAN_HETU_PATH_MODULE.createSelectionStrategy('unbroken-flow').select(
        battle,
      );

    expect(selectedId(result)).toBe('primordial-ray');
  });

  it('养元在低血时优先已装配且可用的治疗内景法', () => {
    const battle = context(TIANYAN_HETU_PATH_ID, [
      'flowing-flame',
      'myriad-wood-renewal',
    ]);
    battle.caster.setHp(Math.floor(battle.caster.getMaxHp() * 0.5));

    const result =
      TIANYAN_HETU_PATH_MODULE.createSelectionStrategy('nourish-origin').select(
        battle,
      );

    expect(selectedId(result)).toBe('myriad-wood-renewal');
  });

  it('养元在低法且目标不是水印时不误用五气归藏', () => {
    const battle = context(TIANYAN_HETU_PATH_ID, [
      'five-qi-repository',
      'dark-water-return',
    ]);
    battle.caster.consumeMp(Math.floor(battle.caster.getMaxMp() * 0.8));
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('fire', 2)),
      battle.caster,
    );

    const result =
      TIANYAN_HETU_PATH_MODULE.createSelectionStrategy('nourish-origin').select(
        battle,
      );

    expect(selectedId(result)).toBe('dark-water-return');
  });

  it('破阵仅在太白破阵本身能冲克时根据可驱散增益提高其优先级', () => {
    const battle = context(TIANYAN_LUOSHU_PATH_ID, [
      'metal-cloud-cutter',
      'white-star-breaker',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('wood', 2)),
      battle.caster,
    );
    battle.opponent.buffs.addBuff(
      BuffFactory.create({
        id: 'test.dispellable',
        name: '可驱散增益',
        type: BuffType.BUFF,
        duration: 2,
      }),
      battle.opponent,
    );

    const result =
      TIANYAN_LUOSHU_PATH_MODULE.createSelectionStrategy(
        'break-pattern',
      ).select(battle);

    expect(selectedId(result)).toBe('white-star-breaker');
  });

  it('锁机在目标控制免疫时安全回退到移宫而非强行控制', () => {
    const battle = context(TIANYAN_LUOSHU_PATH_ID, [
      'metal-cloud-cutter',
      'shift-palace',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('wood', 2)),
      battle.caster,
    );
    battle.opponent.tags.addTags([GameplayTags.STATUS.IMMUNE.CONTROL]);

    const result =
      TIANYAN_LUOSHU_PATH_MODULE.createSelectionStrategy(
        'lock-meridian',
      ).select(battle);

    expect(selectedId(result)).toBe('shift-palace');
  });

  it('锁机未装配土金落印术时不为空转法印，改用当前合法反应', () => {
    const battle = context(TIANYAN_LUOSHU_PATH_ID, [
      'shift-palace',
      'flowing-flame',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('wood', 2)),
      battle.caster,
    );

    const result =
      TIANYAN_LUOSHU_PATH_MODULE.createSelectionStrategy(
        'lock-meridian',
      ).select(battle);

    expect(selectedId(result)).toBe('flowing-flame');
  });

  it('断局只在实际可触发的反应中比较伤害，不误选无反应技能', () => {
    const battle = context(TIANYAN_LUOSHU_PATH_ID, [
      'metal-cloud-cutter',
      'earth-bearing-seal',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('water', 2)),
      battle.caster,
    );

    const result = TIANYAN_LUOSHU_PATH_MODULE.createSelectionStrategy(
      'decisive-derivation',
    ).select(battle);

    expect(selectedId(result)).toBe('earth-bearing-seal');
  });

  it('断局在水印下选择预期伤害更高的滋荣而非泥沼', () => {
    const battle = context(TIANYAN_LUOSHU_PATH_ID, [
      'earth-bearing-seal',
      'verdant-pulse',
    ]);
    battle.opponent.buffs.addBuff(
      BuffFactory.create(createElementSeal('water', 2)),
      battle.caster,
    );

    const result = TIANYAN_LUOSHU_PATH_MODULE.createSelectionStrategy(
      'decisive-derivation',
    ).select(battle);

    expect(selectedId(result)).toBe('verdant-pulse');
  });
});
