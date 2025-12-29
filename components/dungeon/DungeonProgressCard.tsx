'use client';

import { InkSection } from '@/components/InkLayout';
import { StatusCard } from '@/components/cultivator/StatusCard';
import type { DungeonState } from '@/lib/dungeon/types';
import { InkButton } from '../InkComponents';
import { ResourceCostCard } from './ResourceCostCard';

interface DungeonProgressCardProps {
  state: DungeonState;
  onQuit: () => Promise<boolean>;
}

/**
 * 副本进度卡片
 * 集成状态卡片和资源统计，展示副本整体状态
 */
export function DungeonProgressCard({
  state,
  onQuit,
}: DungeonProgressCardProps) {
  const hasStatuses =
    state.persistentStatuses.length > 0 ||
    state.environmentalStatuses.length > 0;

  return (
    <InkSection title="副本状态" subdued>
      <div className="space-y-3">
        {/* 进度信息 */}
        <div className="flex justify-between px-2">
          <span>
            进度: {state.currentRound}/{state.maxRounds}
          </span>
          <span className="text-crimson font-bold">
            危险: {state.dangerScore}
          </span>
          <InkButton variant="primary" className="p-0!" onClick={onQuit}>
            放弃
          </InkButton>
        </div>

        {/* 角色状态 */}
        {hasStatuses && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {state.persistentStatuses.length > 0 && (
              <StatusCard
                statuses={state.persistentStatuses}
                title="持久状态"
                compact
              />
            )}
            {state.environmentalStatuses.length > 0 && (
              <StatusCard
                statuses={state.environmentalStatuses}
                title="环境影响"
                compact
              />
            )}
          </div>
        )}

        {/* 资源损耗 */}
        <ResourceCostCard
          costs={state.summary_of_sacrifice || []}
          hpLossPercent={state.accumulatedHpLoss}
          mpLossPercent={state.accumulatedMpLoss}
          compact
        />
      </div>
    </InkSection>
  );
}
