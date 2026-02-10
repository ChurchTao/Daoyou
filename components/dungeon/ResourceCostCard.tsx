'use client';

import { InkCard } from '@/components/ui/InkCard';
import type { DungeonOptionCost } from '@/lib/dungeon/types';
import {
  getResourceDisplayName,
  getResourceIcon,
} from '@/lib/utils/statusDisplay';
import { format } from 'd3-format';

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
      {!compact && <h3 className="mb-3 font-bold">资源损耗</h3>}
      <div className="space-y-2 text-sm">
        {/* HP/MP损失 */}
        {(hpLossPercent > 0 || mpLossPercent > 0) && (
          <div className="space-y-1">
            {hpLossPercent > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-red-600">
                  <span>{getResourceIcon('hp_loss')}</span>
                  <span>{getResourceDisplayName('hp_loss')}</span>
                </span>
                <span className="text-crimson font-bold">
                  {format('.0%')(hpLossPercent)}
                </span>
              </div>
            )}
            {mpLossPercent > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-blue-600">
                  <span>{getResourceIcon('mp_loss')}</span>
                  <span>{getResourceDisplayName('mp_loss')}</span>
                </span>
                <span className="text-crimson font-bold">
                  {format('.0%')(mpLossPercent)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 资源消耗 */}
        {resourceCosts.length > 0 && (
          <div
            className={`space-y-1 ${hpLossPercent > 0 || mpLossPercent > 0 ? 'border-ink/10 border-t pt-2' : ''}`}
          >
            {resourceCosts.map((cost, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>{getResourceIcon(cost.type)}</span>
                  <span>
                    {cost.type === 'material' && cost.name
                      ? cost.name
                      : cost.desc || getResourceDisplayName(cost.type)}
                  </span>
                </span>
                <span className="text-crimson font-bold">-{cost.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!hasAnyLoss && (
          <p className="text-ink-secondary py-2 text-center">暂无损耗</p>
        )}
      </div>
    </InkCard>
  );
}
