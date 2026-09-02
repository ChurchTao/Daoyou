import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  BodyCultivationTrackPath,
  ConditionProgressTrack,
  LegacyTemperingTrackKey,
  LegacyTemperingTrackPath,
} from '@shared/types/condition';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';

export const BODY_CULTIVATION_TRACK_KEYS = [
  'skin',
  'sinew_bone',
  'organs',
  'qi_blood',
  'primordial_spirit',
] as const satisfies BodyCultivationTrackKey[];

export const BODY_CULTIVATION_TRACK_PATHS = BODY_CULTIVATION_TRACK_KEYS.map(
  (key) => `body.${key}` as BodyCultivationTrackPath,
);

export const LEGACY_TEMPERING_TO_BODY_TRACK = {
  vitality: 'qi_blood',
  spirit: 'organs',
  wisdom: 'primordial_spirit',
  speed: 'skin',
  willpower: 'sinew_bone',
} as const satisfies Record<LegacyTemperingTrackKey, BodyCultivationTrackKey>;

export const BODY_TRACK_LABELS = {
  skin: {
    name: '炼体·皮肤',
    layerName: '防御修炼',
    shortDesc: '提升 combat-v6 防御修炼',
  },
  sinew_bone: {
    name: '炼体·筋骨',
    layerName: '攻法修炼',
    shortDesc: '提升 combat-v6 攻法修炼',
  },
  organs: {
    name: '炼体·脏腑',
    layerName: '法术修炼',
    shortDesc: '提升 combat-v6 法术修炼',
  },
  qi_blood: {
    name: '炼体·气血',
    layerName: '生命根基',
    shortDesc: '提升裸身气血与固定治疗强度',
  },
  primordial_spirit: {
    name: '炼体·元神',
    layerName: '抗法修炼',
    shortDesc: '提升 combat-v6 抗法修炼',
  },
} as const satisfies Record<
  BodyCultivationTrackKey,
  { name: string; layerName: string; shortDesc: string }
>;

export const BODY_REALM_LABELS = {
  mortal_body: '凡躯',
  bronze_skin: '铜皮',
  iron_bone: '铁骨',
  jade_marrow: '玉髓',
  golden_body: '金身',
  dharma_body: '法身',
  dao_body: '道体',
} as const satisfies Record<BodyCultivationRealm, string>;

export const BODY_CULTIVATION_REALM_ORDER = [
  'mortal_body',
  'bronze_skin',
  'iron_bone',
  'jade_marrow',
  'golden_body',
  'dharma_body',
  'dao_body',
] as const satisfies BodyCultivationRealm[];

export interface BodyCultivationRealmRequirement {
  realm: BodyCultivationRealm;
  label: string;
  minCultivationRealm: RealmType;
  totalLevel: number;
  softTrackCap: number;
  unlockText: string;
}

export const BODY_CULTIVATION_REALM_REQUIREMENTS = {
  mortal_body: {
    realm: 'mortal_body',
    label: BODY_REALM_LABELS.mortal_body,
    minCultivationRealm: '炼气',
    totalLevel: 0,
    softTrackCap: 5,
    unlockText: '五轨单轨上限 Lv.5',
  },
  bronze_skin: {
    realm: 'bronze_skin',
    label: BODY_REALM_LABELS.bronze_skin,
    minCultivationRealm: '炼气',
    totalLevel: 12,
    softTrackCap: 10,
    unlockText: '五轨单轨上限提升至 Lv.10',
  },
  iron_bone: {
    realm: 'iron_bone',
    label: BODY_REALM_LABELS.iron_bone,
    minCultivationRealm: '筑基',
    totalLevel: 30,
    softTrackCap: 15,
    unlockText: '五轨单轨上限提升至 Lv.15',
  },
  jade_marrow: {
    realm: 'jade_marrow',
    label: BODY_REALM_LABELS.jade_marrow,
    minCultivationRealm: '金丹',
    totalLevel: 55,
    softTrackCap: 22,
    unlockText: '五轨单轨上限提升至 Lv.22',
  },
  golden_body: {
    realm: 'golden_body',
    label: BODY_REALM_LABELS.golden_body,
    minCultivationRealm: '元婴',
    totalLevel: 90,
    softTrackCap: 30,
    unlockText: '五轨单轨上限提升至 Lv.30',
  },
  dharma_body: {
    realm: 'dharma_body',
    label: BODY_REALM_LABELS.dharma_body,
    minCultivationRealm: '化神',
    totalLevel: 140,
    softTrackCap: 45,
    unlockText: '五轨单轨上限提升至 Lv.45',
  },
  dao_body: {
    realm: 'dao_body',
    label: BODY_REALM_LABELS.dao_body,
    minCultivationRealm: '合体',
    totalLevel: 220,
    softTrackCap: 60,
    unlockText: '五轨单轨上限提升至 Lv.60',
  },
} as const satisfies Record<
  BodyCultivationRealm,
  BodyCultivationRealmRequirement
>;

export function createEmptyProgressTrack(): ConditionProgressTrack {
  return { level: 0, progress: 0 };
}

export function getBodyCultivationThresholdByLevel(level: number): number {
  return 100 + 70 * Math.max(0, Math.floor(level));
}

export function getNextBodyCultivationRealm(
  realm: BodyCultivationRealm,
): BodyCultivationRealm | null {
  const index = BODY_CULTIVATION_REALM_ORDER.indexOf(realm);
  return BODY_CULTIVATION_REALM_ORDER[index + 1] ?? null;
}

export function isCultivationRealmAtLeast(
  current: RealmType | undefined,
  required: RealmType,
): boolean {
  if (!current) return false;
  return REALM_ORDER[current] >= REALM_ORDER[required];
}

export function isBodyCultivationTrackPath(
  value: string,
): value is BodyCultivationTrackPath {
  return BODY_CULTIVATION_TRACK_PATHS.includes(
    value as BodyCultivationTrackPath,
  );
}

export function isLegacyTemperingTrackPath(
  value: string,
): value is LegacyTemperingTrackPath {
  return value.startsWith('tempering.');
}

export function getBodyTrackKeyFromPath(
  path: BodyCultivationTrackPath | LegacyTemperingTrackPath,
): BodyCultivationTrackKey {
  if (isBodyCultivationTrackPath(path)) {
    return path.replace('body.', '') as BodyCultivationTrackKey;
  }

  const legacyKey = path.replace(
    'tempering.',
    '',
  ) as LegacyTemperingTrackKey;
  return LEGACY_TEMPERING_TO_BODY_TRACK[legacyKey];
}
