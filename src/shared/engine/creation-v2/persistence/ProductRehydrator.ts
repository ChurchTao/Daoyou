import type { ElementType, Quality } from '@shared/types/constants';
import { QUALITY_ORDER } from '@shared/types/constants';
import { CREATION_PROJECTION_QUALITY_TIERS } from '../config/CreationBalance';
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import {
  DEFAULT_AFFIX_REGISTRY,
  flattenAffixMatcherTags,
} from '../affixes';
import type { AffixRegistry } from '../affixes/AffixRegistry';
import type { AffixDefinition } from '../affixes/types';
import { buildGroupedListeners, buildCreationListenerGuard } from '../composers/shared';
import { CREATION_LISTENER_PRIORITIES } from '../config/CreationBalance';
import type {
  AttributeModifierConfig,
  ListenerConfig,
} from '../contracts/battle';
import { GameplayTags } from '../contracts/battle';
import { AttributeType, ModifierType } from '../contracts/battle';
import { assembleAbilityTags } from '../rules/composition/AbilityTagAssembler';
import { resolveSkillResourceAndCooldown } from '../rules/composition/SkillPacingRules';
import type {
  ActiveSkillBattleProjection,
  ArtifactBattleProjection,
  ArtifactProductModel,
  CreationProductModel,
  GongFaBattleProjection,
  SkillProductModel,
} from '../models/types';
import type {
  CreationProductType,
  CreationSkillProjectionContext,
  RolledAffix,
} from '../types';
import { REALM_STAGE_CAPS, type RealmStage, type RealmType } from '@shared/types/constants';

const translator = new AffixEffectTranslator();

export interface StoredAffixSlim {
  id: string;
  finalMultiplier: number;
  rollScore: number;
  rollEfficiency: number;
  isPerfect: boolean;
  resolvedModifiers?: AttributeModifierConfig[];
}

const ARTIFACT_MAIN_PANEL_ATTRS = new Set<AttributeType>([
  AttributeType.ATK,
  AttributeType.MAGIC_ATK,
  AttributeType.DEF,
  AttributeType.MAGIC_DEF,
  AttributeType.SPIRIT,
  AttributeType.VITALITY,
  AttributeType.SPEED,
  AttributeType.WISDOM,
  AttributeType.WILLPOWER,
]);

function getAnchorGrowthFactor(
  productType: CreationProductType,
  anchorRealm?: RealmType,
  anchorRealmStage?: RealmStage,
): number {
  if (productType !== 'artifact' || !anchorRealm || !anchorRealmStage) {
    return 1;
  }
  const anchorCap = REALM_STAGE_CAPS[anchorRealm][anchorRealmStage];
  return Math.pow(anchorCap / 20, 0.45);
}

function applyArtifactAnchorGrowth(
  productType: CreationProductType,
  attrType: AttributeType,
  modType: ModifierType,
  baseValue: number,
  anchorFactor: number,
): number {
  if (
    productType !== 'artifact' ||
    modType !== ModifierType.FIXED ||
    !ARTIFACT_MAIN_PANEL_ATTRS.has(attrType)
  ) {
    return baseValue;
  }
  return baseValue * anchorFactor;
}

function hydrateRolledAffix(
  stored: StoredAffixSlim,
  def: AffixDefinition,
): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    description: def.displayDescription,
    slot: def.slot,
    rarity: def.rarity,
    match: def.match,
    tags: flattenAffixMatcherTags(def.match),
    grantedAbilityTags: def.grantedAbilityTags,
    weight: def.weight,
    energyCost: def.energyCost,
    exclusiveGroup: def.exclusiveGroup,
    applicableArtifactSlots: def.applicableArtifactSlots,
    targetPolicyConstraint: def.targetPolicyConstraint,
    effectTemplate: def.effectTemplate,
    rollScore: stored.rollScore,
    rollEfficiency: stored.rollEfficiency,
    finalMultiplier: stored.finalMultiplier,
    isPerfect: stored.isPerfect,
    resolvedModifiers: stored.resolvedModifiers,
  };
}

function reProjectPassive(
  productType: 'artifact' | 'gongfa',
  affixes: RolledAffix[],
  qualityOrder: number,
  projectionQuality: string,
  elementBias: ElementType | undefined,
  anchorRealm?: RealmType,
  anchorRealmStage?: RealmStage,
  registry: AffixRegistry = DEFAULT_AFFIX_REGISTRY,
): ArtifactBattleProjection | GongFaBattleProjection {
  const anchorFactor = getAnchorGrowthFactor(
    productType,
    anchorRealm,
    anchorRealmStage,
  );

  const modifiers: AttributeModifierConfig[] = [];
  const rolledListeners: RolledAffix[] = [];

  for (const rolled of affixes) {
    const def = registry.queryById(rolled.id);
    if (!def) {
      throw new Error(`[ProductRehydrator] Unknown affix ID: ${rolled.id}`);
    }

    if (
      def.effectTemplate.type === 'attribute_modifier' ||
      def.effectTemplate.type === 'random_attribute_modifier'
    ) {
      if (rolled.resolvedModifiers?.length) {
        modifiers.push(...rolled.resolvedModifiers);
      } else if (def.effectTemplate.type === 'attribute_modifier') {
        const modifierEntries =
          'modifiers' in def.effectTemplate.params
            ? def.effectTemplate.params.modifiers
            : [
                {
                  attrType: def.effectTemplate.params.attrType,
                  modType: def.effectTemplate.params.modType,
                  value: def.effectTemplate.params.value,
                },
              ];

        for (const entry of modifierEntries) {
          const baseValue = translator.resolveParam(entry.value, qualityOrder);
          const grownValue = applyArtifactAnchorGrowth(
            productType,
            entry.attrType,
            entry.modType,
            baseValue,
            anchorFactor,
          );
          modifiers.push({
            attrType: entry.attrType,
            type: entry.modType,
            value: grownValue * rolled.finalMultiplier,
          });
        }
      }
    } else {
      rolledListeners.push(rolled);
    }
  }

  const defaultListenerSpec =
    productType === 'artifact'
      ? {
          eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: CREATION_LISTENER_PRIORITIES.damageTaken,
        }
      : {
          eventType: GameplayTags.EVENT.ACTION_PRE,
          scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
          priority: CREATION_LISTENER_PRIORITIES.actionPreBuff,
        };

  const listeners = buildGroupedListeners({
    registry,
    translator,
    rolledAffixes: rolledListeners,
    quality: projectionQuality as Parameters<typeof buildGroupedListeners>[0]['quality'],
    defaultListenerSpec,
  });

  const abilityTags = assembleAbilityTags({
    productType,
    rolledAffixes: affixes,
    elementBias,
  });

  const projectionKind =
    productType === 'artifact' ? 'artifact_passive' : 'gongfa_passive';

  return {
    projectionKind,
    abilityTags,
    listeners,
    ...(modifiers.length > 0 ? { modifiers } : {}),
  } as ArtifactBattleProjection | GongFaBattleProjection;
}

function reProjectSkill(
  affixes: RolledAffix[],
  projectionQuality: Quality,
  elementBias: ElementType | undefined,
  projectionBasisEnergy: number | undefined,
  projectionPacingContext: CreationSkillProjectionContext | undefined,
  registry: AffixRegistry = DEFAULT_AFFIX_REGISTRY,
): ActiveSkillBattleProjection {
  const directEffects: import('../contracts/battle').EffectConfig[] = [];
  const extraListeners: ListenerConfig[] = [];

  for (const rolled of affixes) {
    const def = registry.queryById(rolled.id);
    if (!def) {
      throw new Error(`[ProductRehydrator] Unknown affix ID: ${rolled.id}`);
    }

    const effect = translator.translate(
      rolled,
      projectionQuality as Parameters<typeof translator.translate>[1],
    );
    if (def.listenerSpec) {
      const guard = buildCreationListenerGuard(
        def.listenerSpec.eventType,
        effect,
        def.listenerSpec.guard,
      );

      extraListeners.push({
        eventType: def.listenerSpec.eventType,
        scope: def.listenerSpec.scope,
        priority: def.listenerSpec.priority,
        ...(def.listenerSpec.mapping
          ? { mapping: def.listenerSpec.mapping }
          : {}),
        ...(guard ? { guard } : {}),
        effects: [effect],
      });
    } else {
      directEffects.push(effect);
    }
  }

  const abilityTags = assembleAbilityTags({
    productType: 'skill',
    rolledAffixes: affixes,
    elementBias,
  });

  const qualityOrder = QUALITY_ORDER[projectionQuality] ?? 0;
  const coreAffix = affixes.find((affix) => affix.slot === 'core');
  const coreDef = coreAffix ? registry.queryById(coreAffix.id) : undefined;
  const coreType = coreDef?.effectTemplate.type ?? 'damage';
  const fallbackTargetPolicy = {
    team:
      coreDef?.targetPolicyConstraint?.team ??
      (coreType === 'heal' ? ('self' as const) : ('enemy' as const)),
    scope: coreDef?.targetPolicyConstraint?.scope ?? ('single' as const),
  };
  const basisEnergy =
    projectionBasisEnergy ?? inferBasisEnergyFromQuality(projectionQuality);
  const pacing = resolveSkillResourceAndCooldown({
    coreType,
    abilityTags,
    effects: directEffects,
    ...(extraListeners.length > 0 ? { listeners: extraListeners } : {}),
    affixes,
    projectionQualityProfile: {
      quality: projectionQuality,
      qualityOrder,
      basisEnergy,
    },
    ...(projectionPacingContext
      ? { projectionContext: projectionPacingContext }
      : {}),
  });

  return {
    projectionKind: 'active_skill',
    abilityTags,
    mpCost: pacing.mpCost,
    cooldown: pacing.cooldown,
    priority: pacing.priority,
    targetPolicy: fallbackTargetPolicy,
    effects: directEffects,
    ...(extraListeners.length > 0 ? { listeners: extraListeners } : {}),
  };
}

function inferBasisEnergyFromQuality(projectionQuality: string): number {
  let minEnergy = 0;

  for (const tier of CREATION_PROJECTION_QUALITY_TIERS) {
    if (tier.quality === projectionQuality) {
      return minEnergy;
    }
    minEnergy = tier.maxEnergy;
  }

  return 0;
}

/**
 * 从存储的 slim productModel 实时推导出完整的 CreationProductModel。
 * 战斗数据（battleProjection）从词缀注册表重新构建，确保词缀定义变更自动生效。
 */
export function rehydrateProductModel(
  stored: CreationProductModel,
  elementBias?: ElementType,
  registry: AffixRegistry = DEFAULT_AFFIX_REGISTRY,
): CreationProductModel {
  const storedAffixes = (stored.affixes ?? []) as unknown as StoredAffixSlim[];
  const qualityOrder = QUALITY_ORDER[stored.projectionQuality] ?? 0;

  const hydratedAffixes = storedAffixes.map((slim) => {
    const def = registry.queryById(slim.id);
    if (!def) {
      throw new Error(`[ProductRehydrator] Unknown affix ID: ${slim.id}`);
    }
    return hydrateRolledAffix(slim, def);
  });

  switch (stored.productType) {
    case 'artifact': {
      const artModel = stored as ArtifactProductModel;
      const battleProjection = reProjectPassive(
        'artifact',
        hydratedAffixes,
        qualityOrder,
        stored.projectionQuality,
        elementBias,
        artModel.metadata?.anchorRealm,
        artModel.metadata?.anchorRealmStage,
        registry,
      ) as ArtifactBattleProjection;

      return {
        ...stored,
        affixes: hydratedAffixes,
        battleProjection,
      } as ArtifactProductModel;
    }

    case 'gongfa': {
      const battleProjection = reProjectPassive(
        'gongfa',
        hydratedAffixes,
        qualityOrder,
        stored.projectionQuality,
        elementBias,
        undefined,
        undefined,
        registry,
      ) as GongFaBattleProjection;

      return {
        ...stored,
        affixes: hydratedAffixes,
        battleProjection,
      };
    }

    case 'skill': {
      const skillModel = stored as SkillProductModel;
      const skillModelWithoutLegacyAnchor = {
        ...skillModel,
      } as SkillProductModel & { projectionAnchor?: unknown };
      delete skillModelWithoutLegacyAnchor.projectionAnchor;
      const battleProjection = reProjectSkill(
        hydratedAffixes,
        stored.projectionQuality,
        elementBias,
        skillModel.projectionBasisEnergy,
        skillModel.projectionPacingContext,
        registry,
      );

      return {
        ...skillModelWithoutLegacyAnchor,
        affixes: hydratedAffixes,
        battleProjection,
      };
    }
  }
}
