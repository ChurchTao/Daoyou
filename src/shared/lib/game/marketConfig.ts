import type { MapNode } from '@shared/lib/game/mapSystem';
import { getMapNode } from '@shared/lib/game/mapSystem';
import {
  MATERIAL_TYPE_VALUES,
  REALM_ORDER,
  type MaterialType,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import type {
  MarketAccessRule,
  MarketAccessState,
  MarketLayer,
  RegionProfile,
  RegionProfileKey,
  ResolvedLayerConfig,
} from '@shared/types/market';
import { MARKET_ITEM_COUNT, MARKET_REFRESH_MS } from '@shared/types/market';
import mapData from '../../data/map.json';

export const MARKET_STALE_RETRY_MS = 15000;
export const MYSTERY_MAPPING_TTL_SEC = 72 * 60 * 60;
export const DEFAULT_BLACK_MYSTERY_CHANCE = 0.7;
export const BLACK_MARKET_MIN_HIGH_TIER_COUNT = 2;
export const BLACK_MARKET_HIGH_TIER_MIN: Quality = '地品';
export const BLACK_MARKET_QUALITY_WEIGHTS: Partial<Record<Quality, number>> = {
  真品: 45,
  地品: 25,
  天品: 17,
  仙品: 9,
  神品: 4,
};

const FALLBACK_NODE_ID = 'TN_YUE_01';

type LayerConfig = {
  count: number;
  rankRange: { min: Quality; max: Quality };
  access: MarketAccessRule;
  mysteryChance?: number;
  qualityWeights?: Partial<Record<Quality, number>>;
  minHighTierCount?: number;
};

export interface MarketProfileHint {
  nodeId: string;
  nodeName: string;
  region: string;
  title: string;
  description: string;
  signatureTags: string[];
  dominantMaterialTypes: MaterialType[];
  priceTendency: string;
  layerHints: string[];
}

export interface MarketNodeSwitchOption {
  id: string;
  name: string;
  region: string;
  realmRequirement: RealmType;
  allowedLayers: MarketLayer[];
  signatureTags: string[];
  dominantMaterialTypes: MaterialType[];
  summary: string;
}

export const MARKET_LAYER_CONFIG: Record<MarketLayer, LayerConfig> = {
  common: {
    count: MARKET_ITEM_COUNT,
    rankRange: { min: '凡品', max: '玄品' },
    access: {},
  },
  treasure: {
    count: MARKET_ITEM_COUNT,
    rankRange: { min: '玄品', max: '地品' },
    access: { minRealm: '筑基', entryFee: 0 },
  },
  heaven: {
    count: MARKET_ITEM_COUNT,
    rankRange: { min: '地品', max: '神品' },
    access: { minRealm: '元婴' },
  },
  black: {
    count: MARKET_ITEM_COUNT,
    rankRange: { min: '真品', max: '神品' },
    access: { minRealm: '筑基' },
    mysteryChance: DEFAULT_BLACK_MYSTERY_CHANCE,
    qualityWeights: BLACK_MARKET_QUALITY_WEIGHTS,
    minHighTierCount: BLACK_MARKET_MIN_HIGH_TIER_COUNT,
  },
};

// ─── 地域 Profile 配置 ───

export const REGION_PROFILES: Record<RegionProfileKey, RegionProfile> = {
  tiannan: {
    typeWeights: {
      herb: 3, aux: 2, ore: 1, monster: 1, tcdb: 0.5,
      gongfa_manual: 0.5, skill_manual: 0.5,
    } satisfies Partial<Record<MaterialType, number>>,
    priceModifier: { min: 0.75, max: 1.1 },
    layerOverrides: {},
    signatureTags: ['灵草', '阵材', '药王谷', '天南特产'],
    signatureRatio: 0.4,
  },
  luanxinghai: {
    typeWeights: {
      monster: 3, ore: 2, tcdb: 1.5, herb: 0.5, aux: 1,
      gongfa_manual: 0.3, skill_manual: 0.8,
    } satisfies Partial<Record<MaterialType, number>>,
    priceModifier: { min: 0.9, max: 1.5 },
    layerOverrides: {
      black: { mysteryChance: 0.85 },
    },
    signatureTags: ['深海', '妖兽', '乱星海', '海底矿脉'],
    signatureRatio: 0.45,
  },
  dajin: {
    typeWeights: {
      ore: 2, tcdb: 3, herb: 1, monster: 1, aux: 1.5,
      gongfa_manual: 1.2, skill_manual: 1,
    } satisfies Partial<Record<MaterialType, number>>,
    priceModifier: { min: 1.1, max: 1.6 },
    layerOverrides: {
      heaven: { rankRange: { min: '地品', max: '神品' } },
      treasure: { rankRange: { min: '真品', max: '天品' } },
    },
    signatureTags: ['皇都', '贡品', '大晋商会', '上古遗珍'],
    signatureRatio: 0.35,
  },
  default: {
    typeWeights: {},
    priceModifier: { min: 0.85, max: 1.25 },
    layerOverrides: {},
    signatureTags: ['散修', '杂货'],
    signatureRatio: 0.2,
  },
};

const REGION_MARKET_FLAVOR: Record<
  RegionProfileKey,
  { title: string; description: string }
> = {
  tiannan: {
    title: '天南坊市',
    description: '商旅往来密集，灵草与阵材流通最盛。',
  },
  luanxinghai: {
    title: '乱星海坊市',
    description: '海风腥咸，妖兽骨甲与深海矿砂最受追捧。',
  },
  dajin: {
    title: '大晋坊市',
    description: '皇都商会云集，珍稀天材地宝层出不穷。',
  },
  default: {
    title: '云游坊市',
    description: '四方散修汇聚于此，机缘与风险并存。',
  },
};

// ─── 工具函数 ───

function getRawMainNodes(): MapNode[] {
  return (mapData as { map_nodes: MapNode[] }).map_nodes;
}

export function getDefaultMarketNodeId(): string {
  const firstEnabled = getRawMainNodes().find(
    (node) => node.market_config?.enabled,
  );
  return firstEnabled?.id ?? FALLBACK_NODE_ID;
}

export function getEnabledMarketNodeIds(): string[] {
  return getRawMainNodes()
    .filter((node) => node.market_config?.enabled)
    .map((node) => node.id);
}

export function getMarketConfigByNodeId(
  nodeId: string,
): MapNode['market_config'] {
  const node = getMapNode(nodeId);
  if (!node || !('region' in node)) return undefined;
  return node.market_config;
}

export function getNodeRegionTags(nodeId: string): string[] {
  const node = getMapNode(nodeId);
  if (!node) return [];
  const region = 'region' in node ? node.region : '';
  return [region, node.name, ...node.tags];
}

export function isMarketNodeEnabled(nodeId: string): boolean {
  const config = getMarketConfigByNodeId(nodeId);
  return Boolean(config?.enabled);
}

export function getRegionProfile(nodeId: string): RegionProfile {
  const config = getMarketConfigByNodeId(nodeId);
  const key = config?.region_profile ?? 'default';
  return REGION_PROFILES[key];
}

export function getDominantMarketMaterialTypes(
  nodeId: string,
  limit = 3,
): MaterialType[] {
  const profile = getRegionProfile(nodeId);
  return MATERIAL_TYPE_VALUES.filter(
    (type) => (profile.typeWeights[type] ?? 0) > 0,
  )
    .sort((a, b) => {
      const weightDelta =
        (profile.typeWeights[b] ?? 0) - (profile.typeWeights[a] ?? 0);
      if (weightDelta !== 0) return weightDelta;
      return MATERIAL_TYPE_VALUES.indexOf(a) - MATERIAL_TYPE_VALUES.indexOf(b);
    })
    .slice(0, limit);
}

function getRealmOrder(realm: RealmType): number {
  return REALM_ORDER[realm] ?? -1;
}

function getPriceTendency(profile: RegionProfile): string {
  const averageModifier =
    (profile.priceModifier.min + profile.priceModifier.max) / 2;
  if (averageModifier <= 0.98) return '市价偏松，常有平价补给。';
  if (averageModifier >= 1.25) return '货色稀罕，市价多有溢价。';
  return '行价平稳，偶有珍货浮动。';
}

function getLayerHints(profile: RegionProfile, layer: MarketLayer): string[] {
  const hints: string[] = [];
  const blackOverride = profile.layerOverrides.black;
  const heavenOverride = profile.layerOverrides.heaven;
  const treasureOverride = profile.layerOverrides.treasure;

  if (layer === 'black') {
    hints.push('黑市疑货多，价格浮动大，高阶材料概率更高。');
  }
  if (blackOverride?.mysteryChance) {
    hints.push('黑市疑货更多，适合赌眼力。');
  }
  if (heavenOverride?.rankRange) {
    hints.push('天宝殿偏重高阶天材。');
  }
  if (treasureOverride?.rankRange) {
    hints.push('珍宝阁门槛与货品更高。');
  }

  return hints;
}

function getEnabledMarketNodes(): MapNode[] {
  return getRawMainNodes().filter((node) => node.market_config?.enabled);
}

export function getMarketProfileHint(
  nodeId: string,
  layer: MarketLayer,
): MarketProfileHint {
  const node = getMapNode(nodeId);
  const mainNode = node && 'region' in node ? node : undefined;
  const profile = getRegionProfile(nodeId);
  const flavor = getRegionFlavor(nodeId, layer);

  return {
    nodeId,
    nodeName: mainNode?.name ?? nodeId,
    region: mainNode?.region ?? '未知地域',
    title: flavor.title,
    description: flavor.description,
    signatureTags: profile.signatureTags,
    dominantMaterialTypes: getDominantMarketMaterialTypes(nodeId),
    priceTendency: getPriceTendency(profile),
    layerHints: getLayerHints(profile, layer),
  };
}

export function getMarketNodeSwitchOptions(): MarketNodeSwitchOption[] {
  return getEnabledMarketNodes().map((node) => {
    const profile = getRegionProfile(node.id);
    const signatureTags = profile.signatureTags.slice(0, 3);

    return {
      id: node.id,
      name: node.name,
      region: node.region,
      realmRequirement: node.realm_requirement,
      allowedLayers: node.market_config?.allowed_layers ?? [],
      signatureTags,
      dominantMaterialTypes: getDominantMarketMaterialTypes(node.id),
      summary:
        signatureTags.length > 0
          ? `${node.region}商路，${signatureTags.slice(0, 2).join('、')}走俏。`
          : `${node.region}商路，货源混杂。`,
    };
  });
}

export function resolveMarketSwitchLayer(
  targetNodeId: string,
  preferredLayer: MarketLayer,
): MarketLayer {
  const config = getMarketConfigByNodeId(targetNodeId);
  if (config?.allowed_layers.includes(preferredLayer)) return preferredLayer;
  if (config?.allowed_layers.includes('common')) return 'common';
  return config?.allowed_layers[0] ?? 'common';
}

export function getRefreshInterval(layer: MarketLayer): number {
  return MARKET_REFRESH_MS[layer];
}

export function getCurrentCycle(layer: MarketLayer): number {
  return Math.floor(Date.now() / getRefreshInterval(layer));
}

export function getCycleEndTime(layer: MarketLayer): number {
  return (getCurrentCycle(layer) + 1) * getRefreshInterval(layer);
}

/**
 * 合并层级配置：全局默认 ← RegionProfile 覆盖 ← 节点级覆盖
 */
export function resolveLayerConfig(
  layer: MarketLayer,
  profile: RegionProfile,
): ResolvedLayerConfig {
  const base = MARKET_LAYER_CONFIG[layer];
  const regionOverride = profile.layerOverrides[layer];

  return {
    count: regionOverride?.count ?? base.count,
    rankRange: regionOverride?.rankRange ?? base.rankRange,
    mysteryChance: regionOverride?.mysteryChance ?? base.mysteryChance,
    qualityWeights: regionOverride?.qualityWeights ?? base.qualityWeights,
    minHighTierCount:
      regionOverride?.minHighTierCount ?? base.minHighTierCount,
    access: base.access,
  };
}

export function validateLayerAccess(
  cultivatorRealm: RealmType,
  layer: MarketLayer,
  config?: MapNode['market_config'],
): MarketAccessState {
  if (!config?.enabled) {
    return { allowed: false, reason: '此地坊市尚未开放' };
  }

  if (!config.allowed_layers.includes(layer)) {
    return { allowed: false, reason: '此层暂未对外开放' };
  }

  const rule = MARKET_LAYER_CONFIG[layer].access;
  if (rule.minRealm) {
    const myOrder = getRealmOrder(cultivatorRealm);
    const requiredOrder = getRealmOrder(rule.minRealm);
    if (myOrder < requiredOrder) {
      return {
        allowed: false,
        reason: `境界不足，需达到${rule.minRealm}`,
        entryFee: rule.entryFee,
      };
    }
  }

  return { allowed: true, entryFee: rule.entryFee };
}

export function getLayerConfig(layer: MarketLayer): LayerConfig {
  return MARKET_LAYER_CONFIG[layer];
}

export function getRegionFlavor(nodeId: string, layer: MarketLayer) {
  const config = getMarketConfigByNodeId(nodeId);
  const profile = config?.region_profile ?? 'default';
  const baseFlavor = REGION_MARKET_FLAVOR[profile];
  const layerSuffix: Record<MarketLayer, string> = {
    common: '凡市',
    treasure: '珍宝阁',
    heaven: '天宝殿',
    black: '黑市',
  };
  return {
    title: `${baseFlavor.title}·${layerSuffix[layer]}`,
    description: baseFlavor.description,
  };
}
