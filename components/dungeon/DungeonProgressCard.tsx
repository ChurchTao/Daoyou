'use client';

import { StatusCard } from '@/components/cultivator/StatusCard';
import { InkSection } from '@/components/layout';
import type { DungeonState } from '@/lib/dungeon/types';
import { InkButton } from '../ui';
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
  const hasBuffs = state.persistentBuffs && state.persistentBuffs.length > 0;

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
        {hasBuffs && (
          <StatusCard buffs={state.persistentBuffs} title="持久状态" compact />
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
