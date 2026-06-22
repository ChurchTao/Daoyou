import type { CreationProductModel } from '@shared/engine/creation-v2/models/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type {
  BodyCultivationRealm,
  CultivatorCondition,
} from '@shared/types/condition';
import {
  BODY_CULTIVATION_REALM_ORDER,
  BODY_REALM_LABELS,
  BODY_TRACK_LABELS,
} from './config';
import { normalizeBodyCultivationState } from './normalize';

export interface BodyCultivationCreationRequirement {
  kind: 'track';
  track: 'organs' | 'primordial_spirit';
  requiredLevel: number;
  currentLevel: number;
  label: string;
  met: boolean;
}

export interface BodyCultivationCreationRealmRequirement {
  kind: 'realm';
  realm: BodyCultivationRealm;
  currentRealm: BodyCultivationRealm;
  label: string;
  met: boolean;
}

export type BodyCultivationCreationRequirementItem =
  | BodyCultivationCreationRequirement
  | BodyCultivationCreationRealmRequirement;

export interface BodyCultivationCreationPrerequisiteResult {
  applies: boolean;
  allowed: boolean;
  requirements: BodyCultivationCreationRequirementItem[];
  reason?: string;
}

const BODY_CULTIVATION_SKILL_KEYWORDS = [
  '炼体',
  '肉身',
  '体修',
  '淬体',
  '金身',
  '法身',
  '道体',
  '燃血',
  '雷音',
  '法天象地',
  '身神',
  '脏腑',
  '元神',
] as const;

const HIGH_TIER_BODY_CULTIVATION_KEYWORDS = [
  '法身',
  '道体',
  '法天象地',
  '身神合一',
  '真神',
  'dao_body',
  'dharma_body',
  'true_body',
] as const;

const BODY_CULTIVATION_STRUCTURAL_KEYWORDS = [
  'blood',
  'bone',
  'beast',
  'true',
  'warform',
  'soul',
] as const;

const ORGANS_REQUIRED_KEYWORDS = [
  'blood',
  'bone',
  'beast',
  'physical',
  'warform',
  '燃血',
  '脏腑',
  '雷音',
] as const;

const PRIMORDIAL_SPIRIT_REQUIRED_KEYWORDS = [
  'soul',
  'spirit',
  'divine',
  'true',
  '魂',
  '元神',
  '身神',
] as const;

function normalizeText(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function getProductSearchText(product: CreationProductModel): string {
  return normalizeText(
    product.name,
    product.originalName,
    product.description,
    ...product.outcomeTags,
    ...product.affixes.flatMap((affix) => [
      affix.id,
      affix.name,
      affix.category,
    ]),
  );
}

function getProductStructuralSearchText(product: CreationProductModel): string {
  return normalizeText(
    ...product.outcomeTags,
    ...product.affixes.flatMap((affix) => [
      affix.id,
      affix.name,
      affix.description,
      affix.category,
      ...affix.tags,
      ...(affix.grantedAbilityTags ?? []),
      ...Object.values(affix.match ?? {}).flat(),
    ]),
    ...product.battleProjection.abilityTags,
  );
}

function hasAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function isBodyRealmAtLeast(
  current: BodyCultivationRealm,
  required: BodyCultivationRealm,
): boolean {
  return (
    BODY_CULTIVATION_REALM_ORDER.indexOf(current) >=
    BODY_CULTIVATION_REALM_ORDER.indexOf(required)
  );
}

function getRequiredTracksForBodyCultivationSkill(
  product: CreationProductModel,
): Array<BodyCultivationCreationRequirement['track']> {
  const text = getProductSearchText(product);
  const structuralText = getProductStructuralSearchText(product);
  const requiresOrgans =
    hasAny(text, ORGANS_REQUIRED_KEYWORDS) ||
    hasAny(structuralText, ORGANS_REQUIRED_KEYWORDS) ||
    product.battleProjection.abilityTags.includes(
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    );
  const requiresPrimordialSpirit =
    hasAny(text, PRIMORDIAL_SPIRIT_REQUIRED_KEYWORDS) ||
    hasAny(structuralText, PRIMORDIAL_SPIRIT_REQUIRED_KEYWORDS) ||
    product.battleProjection.abilityTags.includes(
      GameplayTags.ABILITY.CHANNEL.TRUE,
    );
  const tracks: Array<BodyCultivationCreationRequirement['track']> = [];

  if (requiresOrgans) {
    tracks.push('organs');
  }
  if (requiresPrimordialSpirit) {
    tracks.push('primordial_spirit');
  }

  return tracks;
}

export function detectBodyCultivationCreationRequirements(
  product: CreationProductModel,
): Array<
  | Pick<BodyCultivationCreationRequirement, 'kind' | 'track' | 'requiredLevel'>
  | Pick<BodyCultivationCreationRealmRequirement, 'kind' | 'realm'>
> {
  if (product.productType !== 'skill') {
    return [];
  }

  const text = getProductSearchText(product);
  const structuralText = getProductStructuralSearchText(product);
  const isExplicitBodySkill = hasAny(text, BODY_CULTIVATION_SKILL_KEYWORDS);
  const hasBodyStructuralSignal = hasAny(
    structuralText,
    BODY_CULTIVATION_STRUCTURAL_KEYWORDS,
  );
  const requiredTracks = getRequiredTracksForBodyCultivationSkill(product);

  if (!isExplicitBodySkill && !hasBodyStructuralSignal) {
    return [];
  }

  const isHighTierBodySkill = hasAny(
    `${text} ${structuralText}`,
    HIGH_TIER_BODY_CULTIVATION_KEYWORDS,
  );
  const tracks = isExplicitBodySkill
    ? (['organs', 'primordial_spirit'] as const)
    : requiredTracks;
  const requirements: Array<
    | Pick<BodyCultivationCreationRequirement, 'kind' | 'track' | 'requiredLevel'>
    | Pick<BodyCultivationCreationRealmRequirement, 'kind' | 'realm'>
  > = [];

  if (isHighTierBodySkill) {
    requirements.push({
      kind: 'realm',
      realm: 'dharma_body',
    });
  }

  return [
    ...requirements,
    ...tracks.map((track) => ({
      kind: 'track' as const,
      track,
      requiredLevel: isHighTierBodySkill ? 18 : 6,
    })),
  ];
}

function buildTrackRequirement(
  track: BodyCultivationCreationRequirement['track'],
  requiredLevel: number,
  condition: CultivatorCondition | undefined,
): BodyCultivationCreationRequirement {
  const state = normalizeBodyCultivationState(condition);
  const currentLevel = state.tracks[track].level;
  const trackLabel = BODY_TRACK_LABELS[track].name.replace('炼体·', '');

  return {
    kind: 'track',
    track,
    requiredLevel,
    currentLevel,
    label: `${trackLabel} Lv.${currentLevel}/${requiredLevel}`,
    met: currentLevel >= requiredLevel,
  };
}

function buildRealmRequirement(
  realm: BodyCultivationRealm,
  condition: CultivatorCondition | undefined,
): BodyCultivationCreationRealmRequirement {
  const state = normalizeBodyCultivationState(condition);

  return {
    kind: 'realm',
    realm,
    currentRealm: state.realm,
    label: `肉身阶位 ${BODY_REALM_LABELS[state.realm]}/${BODY_REALM_LABELS[realm]}`,
    met: isBodyRealmAtLeast(state.realm, realm),
  };
}

export function evaluateBodyCultivationCreationPrerequisites(
  condition: CultivatorCondition | undefined,
  product: CreationProductModel,
): BodyCultivationCreationPrerequisiteResult {
  const detectedRequirements =
    detectBodyCultivationCreationRequirements(product);
  if (detectedRequirements.length === 0) {
    return {
      applies: false,
      allowed: true,
      requirements: [],
    };
  }

  const requirements = detectedRequirements.map((requirement) =>
    requirement.kind === 'realm'
      ? buildRealmRequirement(requirement.realm, condition)
      : buildTrackRequirement(
          requirement.track,
          requirement.requiredLevel,
          condition,
        ),
  );
  const missing = requirements.filter((requirement) => !requirement.met);

  return {
    applies: true,
    allowed: missing.length === 0,
    requirements,
    reason:
      missing.length > 0
        ? `肉身神通承载不足：${missing.map((item) => item.label).join('、')}`
        : undefined,
  };
}
