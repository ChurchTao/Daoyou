import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkNotice } from '@app/components/ui/InkNotice';
import { MapNodeInfo } from '@shared/lib/game/mapSystem';
import { MapNodeCard } from '../MapNodeCard';
import type { NoviceDungeonReadiness } from '@shared/lib/noviceGuidance';
import type { RealmType } from '@shared/types/constants';

interface DungeonMapSelectorProps {
  selectedNode: MapNodeInfo | null;
  onStart: (nodeId: string) => Promise<void>;
  isStarting: boolean;
  readiness: NoviceDungeonReadiness | null;
  realmBlockReason?: string | null;
  playerRealm?: RealmType;
}

/**
 * 副本地图选择组件
 * 显示地图信息并提供启动按钮
 */
export function DungeonMapSelector({
  selectedNode,
  onStart,
  isStarting,
  readiness,
  realmBlockReason,
  playerRealm,
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
      <MapNodeCard node={selectedNode} playerRealm={playerRealm} />
      {realmBlockReason ? (
        <InkNotice tone="warning">{realmBlockReason}</InkNotice>
      ) : null}
      {readiness?.shouldBlock ? (
        <InkNotice tone="warning">
          {readiness.reasons[0] ?? '首次探秘前还需准备。'}
        </InkNotice>
      ) : null}
      <div className="flex justify-center gap-4">
        <InkButton href="/game/map" disabled={isStarting}>
          重新选择
        </InkButton>
        <InkButton
          variant="primary"
          onClick={() => onStart(selectedNode.id)}
          disabled={isStarting || Boolean(realmBlockReason) || readiness?.shouldBlock}
        >
          {isStarting
            ? '启动中...'
            : realmBlockReason
              ? '境界不足'
              : readiness?.shouldBlock
              ? '准备未足'
              : '开始探索'}
        </InkButton>
      </div>
    </div>
  );
}
