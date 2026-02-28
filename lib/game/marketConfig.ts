import { getRealmOrder } from '@/lib/admin/realm';
import type { MapNode } from '@/lib/game/mapSystem';
import { getMapNode } from '@/lib/game/mapSystem';
import type { Quality, RealmType } from '@/types/constants';
import type {
  MarketAccessRule,
  MarketAccessState,
  MarketLayer,
  RegionProfileKey,
} from '@/types/market';
import mapData from '../../data/map.json';

export const MARKET_CACHE_TTL_SEC = 7200;
export const MARKET_STALE_RETRY_MS = 15000;
export const MYSTERY_MAPPING_TTL_SEC = 72 * 60 * 60;
export const DEFAULT_BLACK_MYSTERY_CHANCE = 0.7;

const FALLBACK_NODE_ID = 'TN_YUE_01';

type LayerConfig = {
  count: number;
  rankRange: { min: Quality; max: Quality };
  access: MarketAccessRule;
  mysteryChance?: number;
};

export const MARKET_LAYER_CONFIG: Record<MarketLayer, LayerConfig> = {
  common: {
    count: 10,
    rankRange: { min: '凡品', max: '玄品' },
    access: {},
  },
  treasure: {
    count: 8,
    rankRange: { min: '玄品', max: '地品' },
    access: { minRealm: '筑基', entryFee: 0 },
  },
  heaven: {
    count: 6,
    rankRange: { min: '地品', max: '神品' },
    access: { minRealm: '元婴' },
  },
  black: {
    count: 8,
    rankRange: { min: '灵品', max: '仙品' },
    access: { minRealm: '筑基' },
    mysteryChance: DEFAULT_BLACK_MYSTERY_CHANCE,
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

function getRawMainNodes(): MapNode[] {
  return (mapData as { map_nodes: MapNode[] }).map_nodes;
}

export function getDefaultMarketNodeId(): string {
  const firstEnabled = getRawMainNodes().find(
    (node) => node.market_config?.enabled,
  );
  return firstEnabled?.id ?? FALLBACK_NODE_ID;
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
