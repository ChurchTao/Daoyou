import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { MapNodeInfo } from '@/lib/game/mapSystem';
import { MapNodeCard } from '../MapNodeCard';

interface DungeonMapSelectorProps {
  selectedNode: MapNodeInfo | null;
  onStart: (nodeId: string) => Promise<void>;
  isStarting: boolean;
}

/**
 * 副本地图选择组件
 * 显示地图信息并提供启动按钮
 */
export function DungeonMapSelector({
  selectedNode,
  onStart,
  isStarting,
}: DungeonMapSelectorProps) {
  if (!selectedNode) {
    return (
      <InkCard className="p-8 text-center">
        <p className="text-ink-secondary">请选择一个秘境</p>
        <InkButton href="/game/map" variant="primary" className="mt-4">
          前往地图
        </InkButton>
      </InkCard>
    );
  }

  return (
    <div className="space-y-4">
      <MapNodeCard node={selectedNode} />
      <div className="flex justify-center gap-4">
        <InkButton href="/game/map" disabled={isStarting}>
          重新选择
        </InkButton>
        <InkButton
          variant="primary"
          onClick={() => onStart(selectedNode.id)}
          disabled={isStarting}
        >
          {isStarting ? '启动中...' : '开始探索'}
        </InkButton>
      </div>
    </div>
  );
}
