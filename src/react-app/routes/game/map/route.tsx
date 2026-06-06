import { MapNode, MapNodeDetail, type MapNodeDetailAction, MapSatellite, } from '@app/components/feature/map';
import {
  getAllMapNodes, getAllSatelliteNodes, getMapNode, type MapNodeInfo, } from '@shared/lib/game/mapSystem';
import { useMemo, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { useNavigate, useSearchParams } from 'react-router';

const MAP_WIDTH = 3056;
const MAP_HEIGHT = 2143;

const getInitPosition = (targetNode?: MapNodeInfo | null) => {
  if (typeof window === 'undefined') return { x: -2382, y: -1224 };
  if (targetNode) {
    return {
      x: window.innerWidth * 0.5 - (MAP_WIDTH * targetNode.x) / 100,
      y: window.innerHeight * 0.45 - (MAP_HEIGHT * targetNode.y) / 100,
    };
  }

  return window.innerWidth < 768
    ? { x: -2382, y: -1224 }
    : { x: -1318, y: -1262 };
};

type MapIntent = 'market' | 'dungeon';

type ManualNodeSelection = {
  nodeId: string | null;
  requestedNodeId: string | null;
};

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
    dungeon: ({ selectedNodeId: id, isMainNode }) => {
      // 只有卫星节点可以进行副本挑战
      if (isMainNode) return [];
      return [
        {
          key: 'enter-dungeon',
          label: '前往历练',
          variant: 'primary',
          onClick: () => navigate(`/game/dungeon?nodeId=${id}`),
        },
      ];
    },
    market: ({ selectedNodeId: id, isMainNode, marketEnabled }) => {
      const actions: MapNodeDetailAction[] = [];

      // 只有卫星节点可以进行副本挑战
      if (!isMainNode) {
        actions.push({
          key: 'enter-dungeon',
          label: '前往历练',
          variant: 'secondary',
          onClick: () => navigate(`/game/dungeon?nodeId=${id}`),
        });
      }

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedNodeId = searchParams.get('nodeId');
  const requestedNode = requestedNodeId ? (getMapNode(requestedNodeId) ?? null) : null;
  const [manualSelection, setManualSelection] =
    useState<ManualNodeSelection | null>(null);
  const selectedNodeId =
    manualSelection?.requestedNodeId === requestedNodeId
      ? manualSelection.nodeId
      : (requestedNode?.id ?? null);
  const initPosition = getInitPosition(requestedNode);
  const intent: MapIntent =
    searchParams.get('intent') === 'market' ? 'market' : 'dungeon';

  const allNodes = getAllMapNodes();
  const allSatellites = getAllSatelliteNodes();
  const selectedNode: MapNodeInfo | null = selectedNodeId
    ? (getMapNode(selectedNodeId) ?? null)
    : null;

  const handleNodeClick = (id: string) => {
    setManualSelection({ nodeId: id, requestedNodeId });
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
      (path) => navigate(path),
    );
  }, [
    intent,
    nodeContext.isMainNode,
    nodeContext.marketEnabled,
    navigate,
    selectedNodeId,
  ]);

  return (
    <div className="relative h-full overflow-hidden">
      <div className="relative h-full w-full flex-1 cursor-grab active:cursor-grabbing">
        <TransformWrapper
          key={requestedNode?.id ?? 'default'}
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
                width: `${MAP_WIDTH}px`,
                height: `${MAP_HEIGHT}px`,
              }}
            >
              <div className="bgi-map absolute inset-0 opacity-80" />

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
          onClose={() => setManualSelection({ nodeId: null, requestedNodeId })}
          actions={nodeActions}
        />
      )}
    </div>
  );
}
