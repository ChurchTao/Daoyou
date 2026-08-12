import {
  dungeonDifficultyColorMap,
  tierColorMap,
} from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTag } from '@app/components/ui/InkTag';
import { cn } from '@shared/lib/cn';
import {
  resolveDungeonMapConfig,
  type MapNodeInfo,
} from '@shared/lib/game/mapSystem';
import type { ComponentProps } from 'react';

type InkButtonVariant = ComponentProps<typeof InkButton>['variant'];

export interface MapNodeDetailAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: InkButtonVariant;
}

export interface MapNodeDetailProps {
  node: MapNodeInfo;
  onClose: () => void;
  actions: MapNodeDetailAction[];
}

function formatRewardBonus(multiplier: number): string {
  const percent = Math.round((multiplier - 1) * 100);
  return `奖励加成 +${Math.max(0, percent)}%`;
}

/**
 * 地图节点详情面板组件
 */
export function MapNodeDetail({ node, onClose, actions }: MapNodeDetailProps) {
  const dungeonConfig = resolveDungeonMapConfig(node);

  return (
    <InkDetailDrawer
      isOpen
      onClose={onClose}
      title={node.name}
      description={node.description}
      size="sm"
      footer={
        actions.length > 0 ? (
          <div className="flex gap-2">
            {actions.map((action) => (
              <InkButton
                key={action.key}
                variant={action.variant || 'secondary'}
                className="w-full justify-center"
                onClick={action.onClick}
              >
                {action.label}
              </InkButton>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="text-ink-secondary mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span>
          推荐境界：
          <span
            className={cn(
              'font-semibold',
              tierColorMap[node.realm_requirement],
            )}
          >
            {node.realm_requirement}
          </span>
        </span>
        <span>
          难度：
          <span
            className={cn(
              'font-semibold',
              dungeonDifficultyColorMap[dungeonConfig.difficultyTier],
            )}
          >
            {dungeonConfig.difficultyLabel}
          </span>
        </span>
        {node.dungeon_config?.difficulty ? (
          <span className="border-crimson/70 bg-crimson/5 text-crimson inline-flex items-center border border-double px-1.5 py-0.5 text-[11px] leading-none font-bold">
            {formatRewardBonus(dungeonConfig.rewardBonus)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {node.tags.map((tag) => (
          <InkTag
            key={tag}
            tone="neutral"
            variant="outline"
            className="text-xs"
          >
            {tag}
          </InkTag>
        ))}
      </div>
    </InkDetailDrawer>
  );
}
