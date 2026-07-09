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
    layerName: '防御与减伤',
    shortDesc: '物防、法防、受到伤害',
  },
  sinew_bone: {
    name: '炼体·筋骨',
    layerName: '气血与抗暴',
    shortDesc: '气血上限、暴击减伤、自然恢复',
  },
  organs: {
    name: '炼体·脏腑',
    layerName: '攻击与回蓝',
    shortDesc: '物攻、法攻、高耗蓝技能回蓝',
  },
  qi_blood: {
    name: '炼体·气血',
    layerName: '气血与治疗',
    shortDesc: '气血上限、治疗效果、自然恢复',
  },
  primordial_spirit: {
    name: '炼体·元神',
    layerName: '控制与抗暴',
    shortDesc: '控制抗性、抗暴、心魔概率',
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
  requiredTrackLevels?: Partial<Record<BodyCultivationTrackKey, number>>;
  requiredAnyTracks?: {
    count: number;
    minLevel: number;
  };
  minAllTracksLevel?: number;
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
    unlockText: '初始肉身',
  },
  bronze_skin: {
    realm: 'bronze_skin',
    label: BODY_REALM_LABELS.bronze_skin,
    minCultivationRealm: '炼气',
    totalLevel: 12,
    requiredAnyTracks: { count: 3, minLevel: 3 },
    softTrackCap: 10,
    unlockText: '开启环境侵蚀减免',
  },
  iron_bone: {
    realm: 'iron_bone',
    label: BODY_REALM_LABELS.iron_bone,
    minCultivationRealm: '筑基',
    totalLevel: 30,
    requiredTrackLevels: {
      sinew_bone: 8,
      skin: 6,
    },
    softTrackCap: 15,
    unlockText: '开启战后伤势降级',
  },
  jade_marrow: {
    realm: 'jade_marrow',
    label: BODY_REALM_LABELS.jade_marrow,
    minCultivationRealm: '金丹',
    totalLevel: 55,
    requiredTrackLevels: {
      sinew_bone: 12,
      qi_blood: 10,
    },
    softTrackCap: 22,
    unlockText: '开启濒死保护',
  },
  golden_body: {
    realm: 'golden_body',
    label: BODY_REALM_LABELS.golden_body,
    minCultivationRealm: '元婴',
    totalLevel: 90,
    minAllTracksLevel: 10,
    softTrackCap: 30,
    unlockText: '开启燃血爆发',
  },
  dharma_body: {
    realm: 'dharma_body',
    label: BODY_REALM_LABELS.dharma_body,
    minCultivationRealm: '化神',
    totalLevel: 140,
    requiredTrackLevels: {
      organs: 18,
      primordial_spirit: 18,
    },
    softTrackCap: 45,
    unlockText: '开局控制抗性提升',
  },
  dao_body: {
    realm: 'dao_body',
    label: BODY_REALM_LABELS.dao_body,
    minCultivationRealm: '合体',
    totalLevel: 220,
    minAllTracksLevel: 25,
    softTrackCap: 55,
    unlockText: '降低渡劫时的损失与风险',
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
