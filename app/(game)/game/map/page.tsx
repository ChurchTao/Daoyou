'use client';

import {
  MapNode,
  MapNodeDetail,
  type MapNodeDetailAction,
  MapSatellite,
} from '@/components/feature/map';
import { InkButton } from '@/components/ui/InkButton';
import {
  getAllMapNodes,
  getAllSatelliteNodes,
  getMapNode,
  type MapNodeInfo,
} from '@/lib/game/mapSystem';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

const getInitPosition = () => {
  if (typeof window === 'undefined') return { x: -2382, y: -1224 };
  return window.innerWidth < 768
    ? { x: -2382, y: -1224 }
    : { x: -1318, y: -1262 };
};

type MapIntent = 'market' | 'dungeon';

type NodeActionContext = {
  selectedNodeId: string;
  isMainNode: boolean;
  marketEnabled: boolean;
};

function buildNodeActions(
  intent: MapIntent,
  ctx: NodeActionContext,
  navigate: (path: string) => void,
): MapNodeDetailAction[] {
  const builders: Record<MapIntent, (input: NodeActionContext) => MapNodeDetailAction[]> = {
    dungeon: ({ selectedNodeId: id }) => [
      {
        key: 'enter-dungeon',
        label: '前往历练',
        variant: 'primary',
        onClick: () => navigate(`/game/dungeon?nodeId=${id}`),
      },
    ],
    market: ({ selectedNodeId: id, isMainNode, marketEnabled }) => {
      const actions: MapNodeDetailAction[] = [
        {
          key: 'enter-dungeon',
          label: '前往历练',
          variant: 'secondary',
          onClick: () => navigate(`/game/dungeon?nodeId=${id}`),
        },
      ];

      // 需求约束：只有主节点且已开放坊市时才展示按钮
      if (isMainNode && marketEnabled) {
        actions.unshift({
          key: 'enter-market',
          label: '进入坊市',
          variant: 'primary',
          onClick: () => navigate(`/game/market?nodeId=${id}&layer=common`),
        });
      }
      return actions;
    },
  };

  return builders[intent](ctx);
}

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const initPosition = getInitPosition();
  const intent: MapIntent =
    searchParams.get('intent') === 'market' ? 'market' : 'dungeon';

  const allNodes = getAllMapNodes();
  const allSatellites = getAllSatelliteNodes();
  const selectedNode: MapNodeInfo | null = selectedNodeId
    ? (getMapNode(selectedNodeId) ?? null)
    : null;

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
  };

  const nodeContext = useMemo(() => {
    if (!selectedNode || !selectedNodeId) {
      return {
        isMainNode: false,
        marketEnabled: false,
      };
    }
    const isMainNode = 'region' in selectedNode;
    return {
      isMainNode,
      marketEnabled: isMainNode && Boolean(selectedNode.market_config?.enabled),
    };
  }, [selectedNode, selectedNodeId]);

  const nodeActions = useMemo(() => {
    if (!selectedNodeId) return [];
    return buildNodeActions(
      intent,
      {
        selectedNodeId,
        isMainNode: nodeContext.isMainNode,
        marketEnabled: nodeContext.marketEnabled,
      },
      (path) => router.push(path),
    );
  }, [
    intent,
    nodeContext.isMainNode,
    nodeContext.marketEnabled,
    router,
    selectedNodeId,
  ]);

  return (
    <div className="bg-paper fixed inset-0 flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex gap-2">
          <InkButton
            onClick={() => router.back()}
            variant="outline"
            className="bg-background! px-2 text-sm shadow"
          >
            关闭
          </InkButton>
        </div>
        <div className="border-ink/10 bg-background pointer-events-auto rounded border px-4 py-2 shadow">
          <div className="text-ink font-bold">修仙界</div>
          <div className="text-ink-secondary text-xs">
            人界·全图 · {intent === 'market' ? '坊市选址' : '历练选址'}
          </div>
        </div>
      </div>

      <div className="relative h-full w-full flex-1 cursor-grab active:cursor-grabbing">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          limitToBounds={false}
          initialPositionX={initPosition.x}
          initialPositionY={initPosition.y}
        >
          <TransformComponent
            wrapperClass="w-full h-full"
            contentClass="w-full h-full"
          >
            <div
              className="relative"
              style={{
                width: '3056px',
                height: '2143px',
              }}
            >
              <div className="bgi-map ring-ink/50 absolute inset-0 opacity-80 shadow ring-10" />

              <div className="text-ink/40 pointer-events-none absolute top-[65%] right-[35%] rotate-6 text-6xl tracking-widest select-none">
                乱星海
              </div>
              <div className="text-ink/40 pointer-events-none absolute top-[48%] left-[33%] rotate-6 text-6xl tracking-widest select-none">
                无边海
              </div>
              <div className="text-ink/40 pointer-events-none absolute right-[15%] bottom-[4%] text-6xl tracking-widest select-none">
                天南
              </div>
              <div className="text-ink/40 writing-vertical pointer-events-none absolute top-[30%] left-[44%] text-6xl tracking-widest select-none">
                大晋
              </div>

              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {allNodes.flatMap((node) =>
                  node.connections.map((targetId) => {
                    const target = getMapNode(targetId);
                    if (!target) return null;
                    if (node.id > targetId) return null;

                    return (
                      <line
                        key={`${node.id}-${targetId}`}
                        x1={`${node.x}%`}
                        y1={`${node.y}%`}
                        x2={`${target.x}%`}
                        y2={`${target.y}%`}
                        stroke="#2c1810"
                        strokeWidth="2"
                        strokeOpacity="0.2"
                        strokeDasharray="5,5"
                      />
                    );
                  }),
                )}
              </svg>

              {allNodes.map((node) => (
                <MapNode
                  key={node.id}
                  id={node.id}
                  name={node.name}
                  realmRequirement={node.realm_requirement}
                  x={node.x}
                  y={node.y}
                  marketEnabled={Boolean(node.market_config?.enabled)}
                  selected={selectedNodeId === node.id}
                  onClick={handleNodeClick}
                />
              ))}

              {allSatellites.map((sat) => (
                <MapSatellite
                  key={sat.id}
                  id={sat.id}
                  name={sat.name}
                  realmRequirement={sat.realm_requirement}
                  x={sat.x}
                  y={sat.y}
                  selected={selectedNodeId === sat.id}
                  onClick={handleNodeClick}
                />
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {selectedNode && (
        <MapNodeDetail
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          actions={nodeActions}
        />
      )}
    </div>
  );
}
