import {
  BASE_ATTRIBUTE_TOTAL,
  getRealmStageAttributeBudget,
} from '@shared/config/realmProgression';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';

export const ARTIFACT_REALM_SCALING_EXPONENT = 0.3;
export const DEFAULT_ARTIFACT_REALM_SCALING_STAGE: RealmStage = '圆满';

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

export interface ArtifactScalableModifier {
  attrType: AttributeType;
  type: ModifierType;
  value: number;
}

export function getArtifactRealmGrowthFactor(
  realm?: RealmType,
  realmStage?: RealmStage,
): number {
  if (!realm) return 1;

  const resolvedStage = realmStage ?? DEFAULT_ARTIFACT_REALM_SCALING_STAGE;
  const budget = getRealmStageAttributeBudget(realm, resolvedStage);
  if (!budget) return 1;

  return Math.pow(budget / BASE_ATTRIBUTE_TOTAL, ARTIFACT_REALM_SCALING_EXPONENT);
}

export function getArtifactWearerRealmFactor(
  anchorRealm: RealmType | undefined,
  anchorRealmStage: RealmStage | undefined,
  wearerRealm: RealmType,
  wearerRealmStage: RealmStage,
): number {
  const anchorFactor = getArtifactRealmGrowthFactor(
    anchorRealm,
    anchorRealmStage,
  );
  const wearerFactor = getArtifactRealmGrowthFactor(
    wearerRealm,
    wearerRealmStage,
  );

  if (anchorFactor <= wearerFactor) return 1;
  return wearerFactor / anchorFactor;
}

export function isArtifactMainPanelFixedModifier(
  modifier: Pick<ArtifactScalableModifier, 'attrType' | 'type'>,
): boolean {
  return (
    modifier.type === ModifierType.FIXED &&
    ARTIFACT_MAIN_PANEL_ATTRS.has(modifier.attrType)
  );
}

export function scaleArtifactMainPanelFixedModifiers<
  T extends ArtifactScalableModifier,
>(modifiers: T[] | undefined, factor: number): T[] {
  if (!modifiers?.length) return [];
  if (factor >= 0.999) return modifiers;

  return modifiers.map((modifier) => {
    if (!isArtifactMainPanelFixedModifier(modifier)) {
      return modifier;
    }
    return {
      ...modifier,
      value: modifier.value * factor,
    };
  });
}
