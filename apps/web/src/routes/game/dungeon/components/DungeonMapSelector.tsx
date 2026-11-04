import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import type { RealmType } from '@daoyou/constants/realms';
import { QI_ACTION_COSTS } from '@daoyou/game-content/qi/config';
import { MapNodeInfo } from '@daoyou/game-domain/world/map';
import { dungeonReadiness } from '@daoyou/game-rules/dungeon';
import { MapNodeCard } from '../MapNodeCard';
import { MysteryWaiting } from './MysteryWaiting';
type NoviceDungeonReadiness = ReturnType<typeof dungeonReadiness>;

interface DungeonMapSelectorProps {
  selectedNode: MapNodeInfo | null;
  onStart: (nodeId: string) => Promise<void>;
  isStarting: boolean;
  readiness: NoviceDungeonReadiness | null;
  realmBlockReason?: string | null;
  playerRealm?: RealmType;
}

/**
 * 秘境选择：未选定时引导去地图；选定后介绍此地，并给出开局消耗与开始按钮。
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
      <div className="border-ink/20 space-y-4 border border-dashed px-6 py-10 text-center">
        <p className="leading-8">
          还没有选定秘境。
          <br />
          在地图上点一处有秘境的地点，就能从这里出发。
        </p>
        <InkButton href="/game/map-v2" variant="primary">
          前往地图
        </InkButton>
      </div>
    );
  }

  const blocked = Boolean(realmBlockReason) || readiness?.shouldBlock;

  return (
    <div className="space-y-5">
      <MapNodeCard node={selectedNode} playerRealm={playerRealm} />
      {realmBlockReason ? (
        <InkNotice tone="warning">{realmBlockReason}</InkNotice>
      ) : readiness?.shouldBlock ? (
        <InkNotice tone="warning">
          {readiness.reasons[0] ?? '出行前还需准备。'}
        </InkNotice>
      ) : null}
      <div className="border-ink/15 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
        <span className="text-ink-secondary text-sm">
          开局消耗灵气{' '}
          <span className="text-ink font-mono font-semibold tracking-tight">
            {QI_ACTION_COSTS.dungeon_start}
          </span>
        </span>
        <div className="flex gap-2">
          <InkButton
            href="/game/map-v2"
            variant="secondary"
            disabled={isStarting}
          >
            重新选择
          </InkButton>
          <InkButton
            variant="primary"
            onClick={() => onStart(selectedNode.id)}
            disabled={blocked}
            pending={isStarting}
            pendingLabel="启动中……"
          >
            {realmBlockReason
              ? '境界不足'
              : readiness?.shouldBlock
                ? '准备未足'
                : '开始探索'}
          </InkButton>
        </div>
      </div>
      <MysteryWaiting active={isStarting} kind="start" />
    </div>
  );
}
