export type { AffixDefinition, AffixEffectTemplate, AffixListenerSpec, AffixScalableValue, ScalableParam, ScalableValueV2 } from './types';
export { AffixEffectTranslator } from './AffixEffectTranslator';
export { AffixRegistry } from './AffixRegistry';
export { AffixPoolBuilder } from './AffixPoolBuilder';
export { AffixSelector } from './AffixSelector';

import { AffixRegistry } from './AffixRegistry';
import { SKILL_AFFIXES } from './definitions/skillAffixes';
import { ARTIFACT_AFFIXES } from './definitions/artifactAffixes';
import { GONGFA_AFFIXES } from './definitions/gongfaAffixes';

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
