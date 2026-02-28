'use client';

import { InkButton } from '@/components/ui/InkButton';
import { InkTag } from '@/components/ui/InkTag';
import type { MapNodeInfo } from '@/lib/game/mapSystem';
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

/**
 * 地图节点详情面板组件
 */
export function MapNodeDetail({
  node,
  onClose,
  actions,
}: MapNodeDetailProps) {
  return (
    <div className="bg-background absolute right-4 bottom-16 left-4 z-40 md:right-8 md:left-auto md:w-96">
      <div className="animate-in slide-in-from-bottom border-ink/20 p-3 shadow-xl duration-300">
        <div className="mb-2 flex items-start justify-between">
          <h2 className="text-xl font-bold">{node.name}</h2>
          <InkButton variant="ghost" className="p-0!" onClick={onClose}>
            ×
          </InkButton>
        </div>

        <p className="text-ink-secondary mb-4 text-sm leading-relaxed">
          {node.description}
        </p>

        <div className="text-ink-secondary mb-3 text-xs">
          推荐境界：<span className="text-ink font-semibold">{node.realm_requirement}</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
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

        {actions.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
