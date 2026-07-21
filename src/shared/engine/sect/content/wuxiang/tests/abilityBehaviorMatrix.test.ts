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
import { projectSectCombat } from '../..';
import type { CultivatorSectState } from '../../../core';
import {
  WUXIANG_FORM_MODE,
  WUXIANG_KARMA_BUFF,
  WUXIANG_TECHNIQUE_IDS,
} from '..';

type PathId = 'mirror-karma' | 'demon-crossing';
type Form = 'buddha' | 'demon-entry' | 'demon-finish' | 'formless';

const names: Record<PathId, Record<string, [string, string, string, string]>> = {
  'mirror-karma': {
    'flower-heart': ['拈花叩心', '花落问罪', '花落问罪', '心花两忘'],
    'blood-tide': ['血海听潮', '血海回澜', '血海回澜', '海月同潮'],
    'three-knocks': ['三叩业门', '业门倒叩', '业门倒叩', '门内无人'],
    'observe-calamity': ['闭目观劫', '开眼见劫', '开眼见劫', '劫相俱寂'],
    'five-skandhas': ['照见五蕴', '五蕴还照', '五蕴还照', '五蕴皆空'],
    'reed-crossing': ['一苇横江', '一苇倒渡', '一苇倒渡', '此岸非岸'],
  },
  'demon-crossing': {
    'flower-heart': ['拈花叩心', '摘心问魔', '摘心问魔', '心魔两忘'],
    'blood-tide': ['血海听潮', '血海倒悬', '血海倒悬', '血海无涯'],
    'three-knocks': ['三叩业门', '三叩魔关', '三叩魔关', '业门无生'],
    'observe-calamity': ['闭目观劫', '开眼见魔', '开眼见魔', '劫火自明'],
    'five-skandhas': ['照见五蕴', '焚尽五蕴', '焚尽五蕴', '蕴空身在'],
    'reed-crossing': ['一苇横江', '一苇渡厄', '一苇渡厄', '苦海无舟'],
  },
};

const costs: Record<PathId, Record<string, [number, number, number, number]>> = {
  'mirror-karma': {
    'flower-heart': [0.05, 0.05, 0.05, 0.08], 'blood-tide': [0.08, 0.06, 0.06, 0.1],
    'three-knocks': [0.07, 0.07, 0.07, 0.11], 'observe-calamity': [0.1, 0.06, 0.06, 0.12],
    'five-skandhas': [0.06, 0.06, 0.06, 0.09], 'reed-crossing': [0.08, 0.07, 0.07, 0.11],
  },
  'demon-crossing': {
    'flower-heart': [0.06, 0.05, 0.05, 0.09], 'blood-tide': [0.14, 0.07, 0.07, 0.16],
    'three-knocks': [0.09, 0.08, 0.08, 0.13], 'observe-calamity': [0.11, 0.06, 0.06, 0.12],
    'five-skandhas': [0.07, 0.06, 0.06, 0.1], 'reed-crossing': [0.1, 0.06, 0.06, 0.12],
  },
};

function state(pathId: PathId, abilityId: string): CultivatorSectState {
  const fillers = WUXIANG_TECHNIQUE_IDS
    .filter((id) => id !== abilityId && id !== 'flower-heart')
    .slice(0, abilityId === 'flower-heart' ? 3 : 2);
  return {
    membershipId: 'matrix', sectId: 'wuxiang', status: 'active', contribution: 0,
    configVersion: 1, activePathId: pathId,
    methods: {
      'wuxiang-canon': 5, 'blood-lotus': 3, 'white-bone': 3,
      'wrathful-ming': 3, 'six-senses': 3, 'reed-crossing-method': 3,
    },
    paths: [{
      pathId, unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire', activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: [], version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['turn-form', ...(abilityId === 'flower-heart' ? [] : [abilityId]), ...fillers],
  };
}

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100, [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100, [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

const forms: Form[] = ['buddha', 'demon-entry', 'demon-finish', 'formless'];
const cases = (['mirror-karma', 'demon-crossing'] as PathId[]).flatMap((pathId) =>
  WUXIANG_TECHNIQUE_IDS.flatMap((abilityId) =>
    forms.map((form) => ({ pathId, abilityId, form }))),
);

function expectedTeam(pathId: PathId, abilityId: string, form: Form): 'enemy' | 'self' {
  if (pathId === 'mirror-karma') {
    if (abilityId === 'reed-crossing') return 'self';
    if (abilityId === 'blood-tide' && (form === 'buddha' || form === 'formless')) return 'self';
    if (abilityId === 'observe-calamity' && form === 'buddha') return 'self';
    return 'enemy';
  }
  if (
    form === 'buddha' &&
    ['blood-tide', 'observe-calamity', 'five-skandhas', 'reed-crossing'].includes(abilityId)
  ) return 'self';
  return 'enemy';
}

function expectedIntent(
  pathId: PathId,
  abilityId: string,
  form: Form,
): 'damage' | 'buff' | 'defensive' {
  if (expectedTeam(pathId, abilityId, form) === 'enemy') return 'damage';
  if (
    pathId === 'demon-crossing' &&
    form === 'buddha' &&
    (abilityId === 'blood-tide' || abilityId === 'five-skandhas')
  ) return 'buff';
  return 'defensive';
}

describe('无相禅宗48格实际结算矩阵', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it.each(cases)('$pathId/$abilityId/$form冻结并执行对应形态', ({ pathId, abilityId, form }) => {
    const projection = projectSectCombat({ sect: state(pathId, abilityId), realm: '化神' })!;
    const owner = unit('owner');
    const enemy = unit('enemy');
    for (const resource of projection.resources) owner.combatResources.define(resource);
    const defaultAttack = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
    owner.abilities.setDefaultAttack(defaultAttack);
    for (const config of projection.abilities) owner.abilities.addAbility(AbilityFactory.create(config));
    const skill = abilityId === 'flower-heart'
      ? defaultAttack
      : owner.abilities.getAbility(`sect.wuxiang.${abilityId}`) as ActiveSkill;

    const formIndex = forms.indexOf(form);
    if (form === 'demon-entry' || form === 'demon-finish') {
      setAbilityMode(owner, {
        key: WUXIANG_FORM_MODE, mode: 'demon',
        phase: form === 'demon-entry' ? 1 : 2,
        remainingUses: form === 'demon-entry' ? 2 : 1,
        displayName: '魔相',
      });
      if (pathId === 'mirror-karma') {
        const karma = BuffFactory.create({
          id: WUXIANG_KARMA_BUFF, name: '业痕', type: BuffType.BUFF,
          duration: -1, stackRule: StackRule.STACK_LAYER, maxLayers: 3,
        });
        owner.buffs.addBuff(karma, owner);
      }
    } else if (form === 'formless') {
      setAbilityMode(owner, {
        key: WUXIANG_FORM_MODE, mode: 'formless', phase: 1,
        remainingUses: 1, displayName: '无相待发',
      });
    }

    const target = skill.targetPolicy.team === 'self' ? owner : enemy;
    const expectedName = names[pathId][abilityId][formIndex];
    const expectedRatio = costs[pathId][abilityId][formIndex];
    const hpBefore = owner.getCurrentHp();
    let paid: AbilityCostPaidEvent | undefined;
    let frozenVariant: string | undefined;
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', (event) => {
      if (event.ability === skill) {
        paid = event;
        frozenVariant = event.ability.runtimeVariantId;
      }
    });
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.ability === skill) requests.push(event);
    });

    expect(skill.name).toBe(expectedName);
    expect(skill.targetPolicy.team).toBe(expectedTeam(pathId, abilityId, form));
    expect(skill.selectionProfile?.intents).toEqual([
      expectedIntent(pathId, abilityId, form),
    ]);
    skill.prepareCast({ caster: owner, target });
    skill.execute({ caster: owner, target });

    expect(paid?.hpPaid).toBe(Math.ceil(hpBefore * expectedRatio));
    expect(frozenVariant).toBeTruthy();
    expect(requests.every((event) => event.target === enemy)).toBe(true);
    if (form === 'demon-entry') {
      expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ phase: 2, remainingUses: 1 });
    } else if (form === 'demon-finish' || form === 'formless') {
      expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
    }
  });
});
