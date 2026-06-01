import {
  getEnabledMarketNodeIds,
  getMarketConfigByNodeId,
} from '@shared/lib/game/marketConfig';
import {
  preGenerateMarket,
} from '@server/lib/services/MarketService';
import type { MarketLayer } from '@shared/types/market';

const MARKET_LAYERS: MarketLayer[] = ['common', 'treasure', 'heaven', 'black'];

/**
 * 坊市定时预生成任务
 *
 * 遍历所有已启用的坊市节点 × 4 层级，
 * 检查当前周期的缓存是否存在，不存在则生成。
 *
 * 由 internalCronScheduler 每 5 分钟调度一次。
 */
export async function runMarketRefreshJob(): Promise<{
  success: true;
  processed: number;
  skipped: boolean;
  generated: string[];
}> {
  const nodeIds = getEnabledMarketNodeIds();
  const generated: string[] = [];

  for (const nodeId of nodeIds) {
    const nodeConfig = getMarketConfigByNodeId(nodeId);
    if (!nodeConfig?.enabled) continue;

    const allowedLayers = nodeConfig.allowed_layers;

    for (const layer of MARKET_LAYERS) {
      if (!allowedLayers.includes(layer)) continue;

      try {
        await preGenerateMarket(nodeId, layer);
        generated.push(`${nodeId}:${layer}`);
      } catch (error) {
        console.error(`[market-scheduler] failed to pre-generate ${nodeId}:${layer}`, error);
      }
    }
  }

  return {
    success: true,
    processed: generated.length,
    skipped: false,
    generated,
  };
}
