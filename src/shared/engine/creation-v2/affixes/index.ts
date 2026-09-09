/*
 * affixes/index.ts: 词缀子系统对外导出入口。
 * 导出类型、翻译器、注册表与默认注册数据，供 composer 与规则层使用。
 */
export { AffixEffectTranslator } from './AffixEffectTranslator';
export {
  buildNeutralCreationTagSignals,
  evaluateAffixMatcher,
} from './AffixMatcher';
export { AffixRegistry } from './AffixRegistry';
export {
  collectAffixMatcherReferencedTags,
  flattenAffixMatcherTags,
  matchAll,
  matchAny,
  matchNone,
} from './types';
export type {
  AffixDefinition,
  AffixEffectTemplate,
  AffixListenerSpec,
  AffixScalableValue,
  AffixTagMatcher,
  AffixTagMatchGroup,
  ScalableParam,
  ScalableValueV2,
} from './types';

import { AffixRegistry } from './AffixRegistry';
import { ARTIFACT_AFFIXES } from './definitions/artifactAffixes';
import { GONGFA_AFFIXES } from './definitions/gongfaAffixes';
import { SKILL_AFFIXES } from './definitions/skillAffixes';

/**
 * 默认词缀注册表（已预填所有内置词缀池）
 */
export const DEFAULT_AFFIX_REGISTRY: AffixRegistry = (() => {
  const registry = new AffixRegistry();
  registry.register(SKILL_AFFIXES);
  registry.register(ARTIFACT_AFFIXES);
  registry.register(GONGFA_AFFIXES);
  return registry;
})();
