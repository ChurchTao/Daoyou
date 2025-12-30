'use client';

import { InkCard } from '@/components/ui';
import type { DungeonOptionCost } from '@/lib/dungeon/types';
import {
  getResourceDisplayName,
  getResourceIcon,
} from '@/lib/utils/statusDisplay';

interface ResourceCostCardProps {
  costs: DungeonOptionCost[];
  hpLossPercent: number;
  mpLossPercent: number;
  compact?: boolean;
}

/**
 * 资源损耗统计卡片
 * 显示副本中累积的资源消耗，包括HP/MP损失和各类资源
 */
export function ResourceCostCard({
  costs,
  hpLossPercent,
  mpLossPercent,
  compact = false,
}: ResourceCostCardProps) {
  // 按类型分组资源消耗（排除虚拟损耗类型）
  const resourceCosts = costs.filter((c) =>
    ['spirit_stones', 'lifespan', 'cultivation_exp', 'material'].includes(
      c.type,
    ),
  );

  const hasAnyLoss =
    hpLossPercent > 0 || mpLossPercent > 0 || resourceCosts.length > 0;

  return (
    <InkCard className={compact ? 'p-3' : 'p-4'}>
      {!compact && <h3 className="font-bold mb-3">资源损耗</h3>}
      <div className="space-y-2 text-sm">
        {/* HP/MP损失 */}
        {(hpLossPercent > 0 || mpLossPercent > 0) && (
          <div className="space-y-1">
            {hpLossPercent > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-red-600 flex items-center gap-1">
                  <span>{getResourceIcon('hp_loss')}</span>
                  <span>{getResourceDisplayName('hp_loss')}</span>
                </span>
                <span className="font-bold text-crimson">
                  {(hpLossPercent * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {mpLossPercent > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-blue-600 flex items-center gap-1">
                  <span>{getResourceIcon('mp_loss')}</span>
                  <span>{getResourceDisplayName('mp_loss')}</span>
                </span>
                <span className="font-bold text-crimson">
                  {(mpLossPercent * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* 资源消耗 */}
        {resourceCosts.length > 0 && (
          <div
            className={`space-y-1 ${hpLossPercent > 0 || mpLossPercent > 0 ? 'border-t border-ink/10 pt-2' : ''}`}
          >
            {resourceCosts.map((cost, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <span>{getResourceIcon(cost.type)}</span>
                  <span>
                    {cost.type === 'material' && cost.name
                      ? cost.name
                      : cost.desc || getResourceDisplayName(cost.type)}
                  </span>
                </span>
                <span className="font-bold text-crimson">-{cost.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!hasAnyLoss && (
          <p className="text-ink-secondary text-center py-2">暂无损耗</p>
        )}
      </div>
    </InkCard>
  );
}
