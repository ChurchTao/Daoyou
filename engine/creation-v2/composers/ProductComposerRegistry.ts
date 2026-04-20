import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry, DEFAULT_AFFIX_REGISTRY } from '../affixes';
import { CreationSession } from '../CreationSession';
import { CreationBlueprint, CreationProductType } from '../types';
import { ProductBlueprintComposer } from './types';
import { SkillBlueprintComposer } from './SkillBlueprintComposer';
import { ArtifactBlueprintComposer } from './ArtifactBlueprintComposer';
import { GongFaBlueprintComposer } from './GongFaBlueprintComposer';

/**
 * 产物 Composer 路由注册表
 * 按 productType 路由到对应的专属 Composer
 */
export class ProductComposerRegistry implements ProductBlueprintComposer {
  private readonly composers: Map<CreationProductType, ProductBlueprintComposer>;

  constructor(
    registry: AffixRegistry = DEFAULT_AFFIX_REGISTRY,
    translator: AffixEffectTranslator = new AffixEffectTranslator(),
  ) {
    this.composers = new Map<CreationProductType, ProductBlueprintComposer>([
      ['skill', new SkillBlueprintComposer(registry, translator)],
      ['artifact', new ArtifactBlueprintComposer(registry, translator)],
      ['gongfa', new GongFaBlueprintComposer(registry, translator)],
    ]);
  }

  compose(session: CreationSession): CreationBlueprint {
    const productType = session.state.input.productType;
    const composer = this.composers.get(productType);
    if (!composer) {
      throw new Error(`No blueprint composer registered for product type: ${productType}`);
    }

    return composer.compose(session);
  }
}
