import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  BuffConfig,
  ConditionConfig,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import { BuffType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { TIANYAN_ELEMENT_SEAL, TIANYAN_SECT_ID } from '../ids';
import {
  TIANYAN_ELEMENT_BUFF_TAGS,
  TIANYAN_ELEMENT_NAMES,
  TIANYAN_SEAL_STATE_TAGS,
  type TianyanElement,
} from './reactions';

export function createElementSeal(
  element: TianyanElement,
  duration: number,
): BuffConfig {
  const name = `${TIANYAN_ELEMENT_NAMES[element]}印`;
  return {
    id: TIANYAN_ELEMENT_SEAL,
    name,
    description: `天衍圣地留下的${name}，可与下一门落印术形成化生或冲克。`,
    type: BuffType.BUFF,
    duration,
    logVisibility: 'debug',
    stackRule: StackRule.OVERRIDE,
    dispelPolicy: 'protected',
    countsAsStatus: false,
    tags: [
      GameplayTags.BUFF.SECT.namespace(TIANYAN_SECT_ID, 'element-seal'),
      TIANYAN_ELEMENT_BUFF_TAGS[element],
    ],
    statusTags: [TIANYAN_SEAL_STATE_TAGS[element]],
  };
}

export function hasSealCondition(element: TianyanElement): ConditionConfig {
  return {
    type: 'has_tag_on',
    params: { scope: 'target', tag: TIANYAN_SEAL_STATE_TAGS[element] },
  };
}

export function hasNoSealConditions(): ConditionConfig[] {
  return Object.values(TIANYAN_SEAL_STATE_TAGS).map((tag) => ({
    type: 'has_not_tag' as const,
    params: { scope: 'target' as const, tag },
  }));
}

export function applySealEffect(
  element: TianyanElement,
  duration: number,
): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: createElementSeal(element, duration),
    },
  };
}

export function clearSealEffect(): EffectConfig {
  return {
    type: 'buff_layer_modify',
    params: {
      match: { id: TIANYAN_ELEMENT_SEAL },
      operation: 'clear',
      target: 'target',
      logVisibility: 'debug',
    },
  };
}

export function sealTransitionLog(
  element: TianyanElement,
  operation: 'apply' | 'refresh' | 'replace',
  previous?: TianyanElement,
): EffectConfig {
  return {
    type: 'mechanic_log',
    params: {
      mechanic: 'status_transition',
      internalKey: `sect.tianyan.element-seal.${operation}`,
      displayName: `${TIANYAN_ELEMENT_NAMES[element]}印`,
      operation,
      previousDisplayName: previous
        ? `${TIANYAN_ELEMENT_NAMES[previous]}印`
        : undefined,
      target: 'target',
    },
  };
}

export function sealConsumeLog(element: TianyanElement): EffectConfig {
  return {
    type: 'mechanic_log',
    params: {
      mechanic: 'status_transition',
      internalKey: 'sect.tianyan.element-seal.consume',
      displayName: `${TIANYAN_ELEMENT_NAMES[element]}印`,
      operation: 'consume',
      target: 'target',
    },
  };
}
