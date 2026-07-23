import type { AbilitySelectionContext } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import {
  AbilityType,
  AttributeType,
  BuffType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import {
  YOUDU_FORGETFUL_RIVER,
  YOUDU_SHADOW_REVEALED,
  YOUDU_SOUL_EROSION,
  YOUDU_SOUL_FIRE,
  YouduBaseSelectionStrategy,
} from '..';
import { projectSectCombat, resolveSectAbility } from '../..';
import {
  YouduDecreeSelectionStrategy,
  YouduTideSelectionStrategy,
} from '../strategy';
import { youduState } from './testState';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function addTargetState(target: Unit, erosionLayers: number): void {
  const erosion = BuffFactory.create({
    id: YOUDU_SOUL_EROSION,
    name: '蚀魂',
    type: BuffType.DEBUFF,
    duration: 3,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: 5,
  });
  erosion.setLayer(erosionLayers);
  target.buffs.addBuff(erosion);
  target.buffs.addBuff(
    BuffFactory.create({
      id: YOUDU_FORGETFUL_RIVER,
      name: '忘川',
      type: BuffType.DEBUFF,
      duration: 2,
      stackRule: StackRule.REFRESH_DURATION,
    }),
  );
}

function selectionContext(
  abilityIds: string[],
  erosionLayers: number,
  pathId: 'tide' | 'decree' | 'base' = 'tide',
  withShadow = false,
): AbilitySelectionContext {
  const caster = unit('caster');
  const opponent = unit('opponent');
  caster.combatResources.define({
    id: YOUDU_SOUL_FIRE,
    name: '魂火',
    initial: 0,
    max: 3,
  });
  addTargetState(opponent, erosionLayers);
  if (withShadow) {
    opponent.buffs.addBuff(
      BuffFactory.create({
        id: YOUDU_SHADOW_REVEALED,
        name: '照影',
        type: BuffType.DEBUFF,
        duration: 3,
        stackRule: StackRule.REFRESH_DURATION,
      }),
    );
  }
  return {
    caster,
    opponent,
    candidates: abilityIds.map((abilityId, order) => ({
      ability: AbilityFactory.create(
        resolveSectAbility({
          sect: youduState(pathId === 'base' ? undefined : pathId),
          realm: '化神',
          abilityId,
        }).config,
      ) as ActiveSkill,
      target: opponent,
      order,
    })),
  };
}

function addHealingAbility(opponent: Unit, cooldown: number): ActiveSkill {
  const heal = AbilityFactory.create({
    slug: `test.heal.${cooldown}`,
    name: '测试治疗',
    type: AbilityType.ACTIVE_SKILL,
    cooldown,
    targetPolicy: { team: 'self', scope: 'single' },
    selectionProfile: { intents: ['heal_hp'] },
    tags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effects: [
      {
        type: 'heal',
        params: { value: { base: 100 }, target: 'hp', recipient: 'caster' },
      },
    ],
  }) as ActiveSkill;
  opponent.abilities.addAbility(heal);
  if (cooldown > 0) heal.startCooldown();
  return heal;
}

function addControlAbility(opponent: Unit, cooldown: number): ActiveSkill {
  const control = AbilityFactory.create({
    slug: `test.control.${cooldown}`,
    name: '测试控制',
    type: AbilityType.ACTIVE_SKILL,
    cooldown,
    targetPolicy: { team: 'enemy', scope: 'single' },
    selectionProfile: { intents: ['control'] },
    tags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effects: [
      {
        type: 'apply_buff',
        params: {
          buffConfig: {
            id: `test.control.buff.${cooldown}`,
            name: '测试控制状态',
            type: BuffType.CONTROL,
            duration: 1,
            stackRule: StackRule.REFRESH_DURATION,
            tags: [GameplayTags.BUFF.TYPE.CONTROL],
          },
        },
      },
    ],
  }) as ActiveSkill;
  opponent.abilities.addAbility(control);
  if (cooldown > 0) control.startCooldown();
  return control;
}

describe('幽都基础施法策略', () => {
  const strategy = new YouduBaseSelectionStrategy();

  it('未选择流派时投影基础策略，四层蚀魂立即终结', () => {
    expect(
      projectSectCombat({
        sect: youduState(undefined),
        realm: '化神',
      })?.selectionStrategy,
    ).toBeInstanceOf(YouduBaseSelectionStrategy);
    const context = selectionContext(
      ['soul-severing-call', 'soul-shall-not-return'],
      4,
      'base',
    );

    expect(strategy.select(context)?.ability.id).toBe(
      'sect.youdu.soul-shall-not-return',
    );
  });

  it('未到终结窗口时依次补忘川和照影', () => {
    const forget = selectionContext(
      ['soul-severing-call', 'forgetful-river-tide'],
      1,
      'base',
    );
    forget.opponent?.buffs.removeBuff(YOUDU_FORGETFUL_RIVER);
    expect(strategy.select(forget)?.ability.id).toBe(
      'sect.youdu.forgetful-river-tide',
    );

    const reveal = selectionContext(
      ['soul-severing-call', 'reveal-shadow'],
      2,
      'base',
    );
    expect(strategy.select(reveal)?.ability.id).toBe(
      'sect.youdu.reveal-shadow',
    );
  });

  it('终结不可用时使用镇魂，控制免疫时回退叠层技能', () => {
    const pin = selectionContext(
      ['soul-severing-call', 'pin-soul'],
      4,
      'base',
      true,
    );
    expect(strategy.select(pin)?.ability.id).toBe('sect.youdu.pin-soul');

    pin.opponent?.tags.addTags([GameplayTags.STATUS.IMMUNE.CONTROL]);
    expect(strategy.select(pin)?.ability.id).toBe(
      'sect.youdu.soul-severing-call',
    );
  });

  it('没有可用主动技能时返回一叹', () => {
    expect(strategy.select(selectionContext([], 0, 'base'))).toBeNull();
  });
});

describe('幽都自动战术', () => {
  it('溺疗只在敌方治疗冷却不超过1回合时优先镇魂', () => {
    const strategy = new YouduTideSelectionStrategy('healer-drown');
    const context = selectionContext(
      ['soul-severing-call', 'seize-soul', 'pin-soul'],
      3,
    );

    expect(strategy.select(context)?.ability.id).toBe(
      'sect.youdu.soul-severing-call',
    );
    const heal = addHealingAbility(context.opponent!, 2);
    expect(strategy.select(context)?.ability.id).toBe(
      'sect.youdu.soul-severing-call',
    );
    heal.tickCooldown();
    expect(strategy.select(context)?.ability.id).toBe('sect.youdu.pin-soul');
  });

  it('长夜在四层时优先照影并在无安全技能时返回普通攻击', () => {
    const strategy = new YouduTideSelectionStrategy('long-night');
    const withShadow = selectionContext(
      ['soul-severing-call', 'reveal-shadow', 'soul-shall-not-return'],
      4,
    );
    expect(strategy.select(withShadow)?.ability.id).toBe(
      'sect.youdu.reveal-shadow',
    );

    const wait = selectionContext(['soul-severing-call'], 4);
    expect(strategy.select(wait)).toBeNull();

    withShadow.caster.combatResources.set(YOUDU_SOUL_FIRE, 3);
    expect(strategy.select(withShadow)?.ability.id).toBe(
      'sect.youdu.soul-shall-not-return',
    );
  });

  it('钉法者先补照影，并在敌方控制或治疗进入关键窗口时镇魂', () => {
    const strategy = new YouduDecreeSelectionStrategy('pin-the-caster');
    const withoutShadow = selectionContext(
      ['reveal-shadow', 'soul-severing-call', 'pin-soul'],
      3,
      'decree',
    );
    expect(strategy.select(withoutShadow)?.ability.id).toBe(
      'sect.youdu.reveal-shadow',
    );

    const context = selectionContext(
      ['soul-severing-call', 'pin-soul'],
      3,
      'decree',
      true,
    );
    const control = addControlAbility(context.opponent!, 2);
    expect(strategy.select(context)?.ability.id).toBe(
      'sect.youdu.soul-severing-call',
    );
    control.tickCooldown();
    expect(strategy.select(context)?.ability.id).toBe('sect.youdu.pin-soul');
  });

  it('钉法者在无关键窗口的四层击杀线优先终结', () => {
    const strategy = new YouduDecreeSelectionStrategy('pin-the-caster');
    const context = selectionContext(
      ['pin-soul', 'soul-shall-not-return'],
      4,
      'decree',
      true,
    );
    context.caster.combatResources.set(YOUDU_SOUL_FIRE, 3);

    expect(strategy.select(context)?.ability.id).toBe(
      'sect.youdu.soul-shall-not-return',
    );
  });

  it('四层判决立即终结，取其第五则优先叠到五层', () => {
    const judge = new YouduDecreeSelectionStrategy('judge-at-four');
    const judgeContext = selectionContext(
      ['soul-shall-not-return', 'pin-soul'],
      4,
      'decree',
      true,
    );
    expect(judge.select(judgeContext)?.ability.id).toBe(
      'sect.youdu.soul-shall-not-return',
    );

    const fifth = new YouduDecreeSelectionStrategy('take-the-fifth');
    const fifthContext = selectionContext(
      ['soul-severing-call', 'soul-shall-not-return'],
      4,
      'decree',
      true,
    );
    expect(fifth.select(fifthContext)?.ability.id).toBe(
      'sect.youdu.soul-severing-call',
    );
  });
});
