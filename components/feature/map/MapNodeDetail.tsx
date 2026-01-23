'use client';

import { InkButton } from '@/components/ui/InkButton';
import { InkTag } from '@/components/ui/InkTag';
import type { MapNode } from '@/lib/game/mapSystem';

export interface MapNodeDetailProps {
  node: MapNode;
  onClose: () => void;
  onSelect: () => void;
}

/**
 * 地图节点详情面板组件
 */
export function MapNodeDetail({ node, onClose, onSelect }: MapNodeDetailProps) {
  return (
    <div className="absolute bottom-16 left-4 right-4 z-40 md:w-96 md:left-auto md:right-8 bg-background">
      <div className="shadow-xl animate-in slide-in-from-bottom duration-300 border-ink/20 p-3">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-xl font-bold">{node.name}</h2>
          <InkButton variant="ghost" className="p-0!" onClick={onClose}>
            ×
          </InkButton>
        </div>

        <p className="text-sm text-ink-secondary leading-relaxed mb-4">
          {node.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
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

        <InkButton
          variant="primary"
          className="w-full justify-center"
          onClick={onSelect}
        >
          选择此地
        </InkButton>
      </div>
    </div>
  );
}
