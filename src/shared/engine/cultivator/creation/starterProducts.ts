import type {
  AbilityConfig,
  AttributeModifierConfig,
} from '@shared/engine/battle-v5/core/configs';
import { CreationSession } from '@shared/engine/creation-v2/CreationSession';
import {
  DEFAULT_AFFIX_REGISTRY,
  flattenAffixMatcherTags,
} from '@shared/engine/creation-v2/affixes';
import type { AffixDefinition } from '@shared/engine/creation-v2/affixes/types';
import { ProductComposerRegistry } from '@shared/engine/creation-v2/composers/ProductComposerRegistry';
import {
  projectAbilityConfig,
  type GongFaProductModel,
  type SkillProductModel,
} from '@shared/engine/creation-v2/models';
import type { RolledAffix } from '@shared/engine/creation-v2/types';
import type { ElementType, Quality } from '@shared/types/constants';
import type { CultivationTechnique, Skill } from '@shared/types/cultivator';

const STARTER_QUALITY: Quality = '凡品';
const STARTER_EFFECTIVE_ENERGY = 17;

const composerRegistry = new ProductComposerRegistry();

type InitializedTechnique = CultivationTechnique & {
  abilityConfig: AbilityConfig;
  attributeModifiers: AttributeModifierConfig[];
  productModel: GongFaProductModel;
  quality: Quality;
};

type InitializedSkill = Skill & {
  abilityConfig: AbilityConfig;
  productModel: SkillProductModel;
  quality: Quality;
};

interface StarterTechniqueRecipe {
  affixIds: string[];
}

interface StarterSkillRecipe {
  affixIds: string[];
}

const starterTechniqueRecipes = new Map<string, StarterTechniqueRecipe>([
  ['金:金锐功', { affixIds: ['gongfa-foundation-atk'] }],
  ['木:长春功', { affixIds: ['gongfa-foundation-vitality'] }],
  ['水:玄水诀', { affixIds: ['gongfa-foundation-spirit'] }],
  ['火:烈阳功', { affixIds: ['gongfa-foundation-magic-atk'] }],
  ['土:厚土经', { affixIds: ['gongfa-foundation-def'] }],
  ['风:御风诀', { affixIds: ['gongfa-foundation-speed'] }],
  ['雷:紫雷诀', { affixIds: ['gongfa-foundation-control-hit'] }],
  ['冰:凝霜诀', { affixIds: ['gongfa-foundation-magic-def'] }],
]);

const starterSkillRecipes = new Map<string, StarterSkillRecipe>([
  ['金:金锋术', { affixIds: ['skill-core-damage-metal'] }],
  ['金:铁皮术', { affixIds: ['skill-core-guard-aura'] }],
  ['木:缠绕术', { affixIds: ['skill-core-damage-wood'] }],
  ['木:回春术', { affixIds: ['skill-core-heal'] }],
  ['水:冰锥术', { affixIds: ['skill-core-damage-water'] }],
  ['水:水罩术', { affixIds: ['skill-core-guard-aura'] }],
  ['火:烈焰指', { affixIds: ['skill-core-damage-fire'] }],
  ['火:焰息诀', { affixIds: ['skill-core-fire-channeling'] }],
  ['土:落石术', { affixIds: ['skill-core-damage-earth'] }],
  ['土:厚土护体', { affixIds: ['skill-core-guard-aura'] }],
  ['风:风刃', { affixIds: ['skill-core-damage-wind'] }],
  ['风:清风诀', { affixIds: ['skill-core-wind-haste'] }],
  ['雷:紫雷击', { affixIds: ['skill-core-damage-thunder'] }],
  ['雷:雷护身', { affixIds: ['skill-core-guard-aura'] }],
  ['冰:寒冰刺', { affixIds: ['skill-core-damage-ice'] }],
  ['冰:冰幕诀', { affixIds: ['skill-core-ice-frost-guard'] }],
]);

function recipeKey(element: ElementType | undefined, name: string): string {
  return `${element ?? 'mixed'}:${name}`;
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function toRolledAffix(def: AffixDefinition): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    description: def.displayDescription,
    category: def.category,
    match: def.match,
    tags: flattenAffixMatcherTags(def.match),
    grantedAbilityTags: def.grantedAbilityTags,
    weight: def.weight,
    energyCost: def.energyCost,
    exclusiveGroup: def.exclusiveGroup,
    applicableArtifactSlots: def.applicableArtifactSlots,
    targetPolicyConstraint: def.targetPolicyConstraint,
    effectTemplate: def.effectTemplate,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
  };
}

function composeStarterModel(args: {
  productType: 'skill' | 'gongfa';
  element: ElementType;
  name: string;
  description?: string;
  affixIds: string[];
}): SkillProductModel | GongFaProductModel {
  const { productType, element, name, description, affixIds } = args;
  const defs = affixIds.map((affixId) => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
    if (!def) {
      throw new Error(`Unknown starter affix: ${affixId}`);
    }
    return def;
  });

  const rolledAffixes = defs.map(toRolledAffix);
  const spentEnergy = defs.reduce((sum, def) => sum + def.energyCost, 0);
  const unlockedAffixCategories = Array.from(
    new Set(defs.map((def) => def.category)),
  );

  const session = new CreationSession({
    sessionId: `starter-${productType}-${element}-${hashText(`${element}:${name}`)}`,
    productType,
    materials: [
      {
        name,
        type: productType === 'skill' ? 'skill_manual' : 'gongfa_manual',
        rank: STARTER_QUALITY,
        quantity: 1,
        element,
      },
    ],
  });

  session.state.intent = {
    productType,
    dominantTags: [],
    elementBias: element,
  };
  session.state.recipeMatch = {
    recipeId: `starter-${productType}`,
    valid: true,
    matchedTags: [],
    unlockedAffixCategories,
  };
  session.state.energyBudget = {
    baseTotal: STARTER_EFFECTIVE_ENERGY,
    effectiveTotal: STARTER_EFFECTIVE_ENERGY,
    reserved: 0,
    spent: spentEnergy,
    remaining: Math.max(0, STARTER_EFFECTIVE_ENERGY - spentEnergy),
    initialRemaining: STARTER_EFFECTIVE_ENERGY,
    allocations: [],
    rejections: [],
    sources: [{ source: 'starter', amount: STARTER_EFFECTIVE_ENERGY }],
  };
  session.state.rolledAffixes = rolledAffixes;

  const blueprint = composerRegistry.compose(session);
  const productModel = blueprint.productModel;
  const originalName = productModel.name;

  return {
    ...productModel,
    name,
    description: description ?? productModel.description,
    ...(originalName !== name ? { originalName } : {}),
  } as SkillProductModel | GongFaProductModel;
}

function hasPopulatedAffixes(
  productModel: unknown,
): productModel is { affixes: Array<unknown> } {
  return Boolean(
    productModel &&
      typeof productModel === 'object' &&
      Array.isArray((productModel as { affixes?: unknown[] }).affixes) &&
      (productModel as { affixes: unknown[] }).affixes.length > 0,
  );
}

function normalizeTechniqueFromRecipe(
  technique: CultivationTechnique,
  recipe: StarterTechniqueRecipe,
): InitializedTechnique {
  const productModel = composeStarterModel({
    productType: 'gongfa',
    element: technique.element ?? '金',
    name: technique.name,
    description: technique.description,
    affixIds: recipe.affixIds,
  }) as GongFaProductModel;
  const abilityConfig = projectAbilityConfig(productModel);

  return {
    ...technique,
    quality: productModel.projectionQuality,
    attributeModifiers: abilityConfig.modifiers ?? [],
    abilityConfig,
    productModel,
  };
}

function normalizeSkillFromRecipe(
  skill: Skill,
  recipe: StarterSkillRecipe,
): InitializedSkill {
  const productModel = composeStarterModel({
    productType: 'skill',
    element: skill.element,
    name: skill.name,
    description: skill.description,
    affixIds: recipe.affixIds,
  }) as SkillProductModel;
  const abilityConfig = projectAbilityConfig(productModel);

  return {
    ...skill,
    quality: productModel.projectionQuality,
    cost: abilityConfig.mpCost ?? skill.cost ?? 0,
    cooldown: abilityConfig.cooldown ?? skill.cooldown ?? 0,
    target_self:
      abilityConfig.targetPolicy?.team === 'self'
        ? true
        : abilityConfig.targetPolicy?.team === 'enemy'
          ? false
          : skill.target_self,
    abilityConfig,
    productModel,
  };
}

export function ensureStarterTechnique(
  technique: CultivationTechnique,
): InitializedTechnique {
  const recipe = starterTechniqueRecipes.get(
    recipeKey(technique.element, technique.name),
  );

  if (recipe && !hasPopulatedAffixes(technique.productModel)) {
    return normalizeTechniqueFromRecipe(technique, recipe);
  }

  const productModel = technique.productModel as GongFaProductModel | undefined;
  const abilityConfig = technique.abilityConfig
    ? technique.abilityConfig
    : productModel
      ? projectAbilityConfig(productModel)
      : undefined;

  return {
    ...technique,
    quality:
      technique.quality ??
      productModel?.projectionQuality ??
      STARTER_QUALITY,
    attributeModifiers:
      technique.attributeModifiers ?? abilityConfig?.modifiers ?? [],
    abilityConfig: abilityConfig ?? {
      slug: `starter-gongfa-fallback-${hashText(technique.name)}`,
      name: technique.name,
      type: 'passive_skill' as AbilityConfig['type'],
      tags: ['Ability.Kind.GongFa'],
      listeners: [],
      modifiers: technique.attributeModifiers ?? [],
    },
    productModel:
      productModel ??
      composeStarterModel({
        productType: 'gongfa',
        element: technique.element ?? '金',
        name: technique.name,
        description: technique.description,
        affixIds: ['gongfa-foundation-spirit'],
      }),
  } as InitializedTechnique;
}

export function ensureStarterSkill(skill: Skill): InitializedSkill {
  const recipe = starterSkillRecipes.get(recipeKey(skill.element, skill.name));

  if (recipe && !hasPopulatedAffixes(skill.productModel)) {
    return normalizeSkillFromRecipe(skill, recipe);
  }

  const productModel = skill.productModel as SkillProductModel | undefined;
  const abilityConfig = skill.abilityConfig
    ? skill.abilityConfig
    : productModel
      ? projectAbilityConfig(productModel)
      : undefined;

  return {
    ...skill,
    quality:
      skill.quality ??
      productModel?.projectionQuality ??
      STARTER_QUALITY,
    cost: abilityConfig?.mpCost ?? skill.cost ?? 0,
    cooldown: abilityConfig?.cooldown ?? skill.cooldown ?? 0,
    target_self:
      abilityConfig?.targetPolicy?.team === 'self'
        ? true
        : abilityConfig?.targetPolicy?.team === 'enemy'
          ? false
          : skill.target_self,
    abilityConfig:
      abilityConfig ??
      projectAbilityConfig(
        composeStarterModel({
          productType: 'skill',
          element: skill.element,
          name: skill.name,
          description: skill.description,
          affixIds: ['skill-core-damage'],
        }) as SkillProductModel,
      ),
    productModel:
      productModel ??
      composeStarterModel({
        productType: 'skill',
        element: skill.element,
        name: skill.name,
        description: skill.description,
        affixIds: ['skill-core-damage'],
      }),
  } as InitializedSkill;
}
