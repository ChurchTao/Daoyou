import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type { AbilityCostPaidEvent, DamageRequestEvent } from '@shared/engine/battle-v5/core/events';
import { readAbilityMode, setAbilityMode } from '@shared/engine/battle-v5/core/runtimeState';
import { AttributeType, BuffType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';
import {
  WUXIANG_FORM_MODE,
  WUXIANG_KARMA_BUFF,
  WUXIANG_TECHNIQUE_IDS,
  WUXIANG_WAR_INTENT,
} from '..';

type PathId = 'mirror-karma' | 'demon-crossing';
type Form = 'buddha' | 'demon' | 'formless';

const names: Record<PathId, Record<string, [string, string, string]>> = {
  'mirror-karma': {
    'flower-heart': ['拈花叩心', '花落问罪', '心花两忘'],
    'blood-tide': ['血海听潮', '血海回澜', '海月同潮'],
    'three-knocks': ['三叩业门', '业门倒叩', '门内无人'],
    'observe-calamity': ['闭目观劫', '开眼见劫', '劫相俱寂'],
    'five-skandhas': ['照见五蕴', '五蕴还照', '五蕴皆空'],
    'reed-crossing': ['一苇横江', '一苇倒渡', '此岸非岸'],
  },
  'demon-crossing': {
    'flower-heart': ['拈花叩心', '摘心问魔', '心魔两忘'],
    'blood-tide': ['血海听潮', '血海倒悬', '血海无涯'],
    'three-knocks': ['三叩业门', '三叩魔关', '业门无生'],
    'observe-calamity': ['闭目观劫', '开眼见魔', '劫火自明'],
    'five-skandhas': ['照见五蕴', '焚尽五蕴', '蕴空身在'],
    'reed-crossing': ['一苇横江', '一苇渡厄', '苦海无舟'],
  },
};

const costs: Record<PathId, Record<string, number>> = {
  'mirror-karma': {
    'flower-heart': 0.05,
    'blood-tide': 0.08,
    'three-knocks': 0.07,
    'observe-calamity': 0.10,
    'five-skandhas': 0.06,
    'reed-crossing': 0.08,
  },
  'demon-crossing': {
    'flower-heart': 0.06,
    'blood-tide': 0.14,
    'three-knocks': 0.09,
    'observe-calamity': 0.11,
    'five-skandhas': 0.07,
    'reed-crossing': 0.10,
  },
};

const targets: Record<PathId, Record<string, 'enemy' | 'self'>> = {
  'mirror-karma': {
    'flower-heart': 'enemy',
    'blood-tide': 'self',
    'three-knocks': 'enemy',
    'observe-calamity': 'self',
    'five-skandhas': 'enemy',
    'reed-crossing': 'self',
  },
  'demon-crossing': {
    'flower-heart': 'enemy',
    'blood-tide': 'self',
    'three-knocks': 'enemy',
    'observe-calamity': 'self',
    'five-skandhas': 'self',
    'reed-crossing': 'self',
  },
};

const cooldowns: Record<string, number> = {
  'flower-heart': 0,
  'blood-tide': 3,
  'three-knocks': 2,
  'observe-calamity': 4,
  'five-skandhas': 3,
  'reed-crossing': 5,
};

const damageSegments: Record<PathId, Record<string, Record<Form, number[]>>> = {
  'mirror-karma': {
    'flower-heart': { buddha: [0.6], demon: [0.6, 0.35], formless: [0.6, 0.35, 0.3] },
    'blood-tide': { buddha: [], demon: [], formless: [] },
    'three-knocks': {
      buddha: [0.28, 0.28, 0.28],
      demon: [0.28, 0.28, 0.28, 0.25],
      formless: [0.28, 0.28, 0.28, 0.25, 0.35],
    },
    'observe-calamity': { buddha: [], demon: [], formless: [] },
    'five-skandhas': { buddha: [0.5], demon: [0.5], formless: [0.5, 0.4] },
    'reed-crossing': { buddha: [], demon: [], formless: [] },
  },
  'demon-crossing': {
    'flower-heart': { buddha: [0.6], demon: [0.6, 0.35], formless: [0.6, 0.35, 0.2] },
    'blood-tide': { buddha: [], demon: [], formless: [] },
    'three-knocks': {
      buddha: [0.25, 0.25, 0.25],
      demon: [0.25, 0.25, 0.25, 0.45],
      formless: [0.25, 0.25, 0.25, 0.45],
    },
    'observe-calamity': { buddha: [], demon: [], formless: [] },
    'five-skandhas': { buddha: [], demon: [], formless: [] },
    'reed-crossing': { buddha: [], demon: [], formless: [] },
  },
};

function state(pathId: PathId): CultivatorSectState {
  return {
    membershipId: 'runtime',
    sectId: 'wuxiang',
    status: 'active',
    contribution: 0,
    configVersion: 2,
    activePathId: pathId,
    methods: {
      'wuxiang-canon': 5,
      'blood-lotus': 3,
      'white-bone': 3,
      'wrathful-ming': 3,
      'six-senses': 3,
      'reed-crossing-method': 3,
    },
    paths: [{
      pathId,
      unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire',
      activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: [], version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['turn-form', 'blood-tide', 'three-knocks', 'observe-calamity'],
  };
}

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

const forms: Form[] = ['buddha', 'demon', 'formless'];
const cases = (['mirror-karma', 'demon-crossing'] as PathId[]).flatMap((pathId) =>
  WUXIANG_TECHNIQUE_IDS.flatMap((abilityId) =>
    forms.map((form) => ({ pathId, abilityId, form }))));

describe('无相禅宗36格实际结算矩阵', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it.each(cases)('$pathId/$abilityId/$form 冻结并执行对应 A/B/C 计划', ({
    pathId,
    abilityId,
    form,
  }) => {
    const projection = projectSectCombat({ sect: state(pathId), realm: '化神' })!;
    const owner = unit('owner');
    const enemy = unit('enemy');
    if (
      pathId === 'demon-crossing' &&
      abilityId === 'flower-heart' &&
      form === 'formless'
    ) {
      enemy.setHp(Math.floor(enemy.getMaxHp() * 0.5));
    }
    for (const resource of projection.resources) owner.combatResources.define(resource);
    const config = resolveSectAbility({ sect: state(pathId), realm: '化神', abilityId }).config;
    const skill = AbilityFactory.create(config) as ActiveSkill;
    skill.setOwner(owner);
    skill.setActive(true);

    if (form !== 'buddha') {
      setAbilityMode(owner, {
        key: WUXIANG_FORM_MODE,
        mode: form,
        remainingUses: form === 'demon' ? 2 : 1,
        displayName: form === 'demon' ? '魔相' : '无相',
      });
      if (pathId === 'mirror-karma') {
        owner.buffs.addBuff(BuffFactory.create({
          id: WUXIANG_KARMA_BUFF,
          name: '业痕',
          type: BuffType.BUFF,
          duration: -1,
          stackRule: StackRule.STACK_LAYER,
          maxLayers: 3,
        }), owner);
        if (abilityId === 'three-knocks') {
          enemy.buffs.addBuff(BuffFactory.create({
            id: 'sect.wuxiang.mirror.karma-door',
            name: '旧业门',
            type: BuffType.DEBUFF,
            duration: 4,
            stackRule: StackRule.STACK_LAYER,
            maxLayers: 3,
          }), owner);
        }
      }
    }
    const target = targets[pathId][abilityId] === 'self' ? owner : enemy;
    const formIndex = forms.indexOf(form);
    const hpBefore = owner.getCurrentHp();
    let paid: AbilityCostPaidEvent | undefined;
    let frozenPlanId: string | undefined;
    const damageRequests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', (event) => {
      if (event.ability !== skill) return;
      paid = event;
      frozenPlanId = event.ability.runtimePlanId;
    });
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.ability === skill) damageRequests.push(event);
    });

    expect(skill.id).toBe(`sect.wuxiang.${abilityId}`);
    expect(skill.name).toBe(names[pathId][abilityId][formIndex]);
    expect(skill.targetPolicy.team).toBe(targets[pathId][abilityId]);
    expect(skill.maxCooldown).toBe(cooldowns[abilityId]);
    expect(config.effects?.length).toBeGreaterThan(0);
    expect(config.effectLayers?.find((layer) => layer.id === 'demon')?.effects?.length)
      .toBeGreaterThan(0);
    expect(config.effectLayers?.find((layer) => layer.id === 'formless')?.effects?.length)
      .toBeGreaterThan(0);
    skill.prepareCast({ caster: owner, target });
    skill.execute({ caster: owner, target });

    expect(paid?.hpPaid).toBe(Math.ceil(hpBefore * costs[pathId][abilityId]));
    expect(frozenPlanId).toBe(form === 'buddha' ? undefined : form);
    expect(damageRequests.every((event) => event.target === enemy)).toBe(true);
    expect(damageRequests.map((event) =>
      event.damageComponents?.find((component) =>
        component.segmentMultiplier !== undefined)?.segmentMultiplier ?? 0))
      .toEqual(damageSegments[pathId][abilityId][form]);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT))
      .toBe(form === 'buddha' ? 1 : 0);
    if (form === 'demon') {
      expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({
        mode: 'demon',
        remainingUses: 1,
      });
    } else {
      expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
    }
  });

  it('未命中不执行完成效果，也不消费魔相次数', () => {
    const projection = projectSectCombat({ sect: state('mirror-karma'), realm: '化神' })!;
    const owner = unit('owner');
    const enemy = unit('enemy');
    for (const resource of projection.resources) owner.combatResources.define(resource);
    const skill = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
    skill.setOwner(owner);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'demon',
      remainingUses: 2,
      displayName: '魔相',
    });

    skill.prepareCast({ caster: owner, target: enemy });
    skill.execute({ caster: owner, target: enemy, shouldApplyEffects: false });

    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ remainingUses: 2 });
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
  });
});
