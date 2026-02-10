'use client';

import { MapNode, MapNodeDetail, MapSatellite } from '@/components/feature/map';
import { InkButton } from '@/components/ui/InkButton';
import {
  getAllMapNodes,
  getAllSatelliteNodes,
  getMapNode,
  MapNode as MapNodeType,
} from '@/lib/game/mapSystem';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

const getInitPosition = () => {
  if (typeof window === 'undefined') return { x: -2382, y: -1224 };
  return window.innerWidth < 768
    ? { x: -2382, y: -1224 }
    : { x: -1318, y: -1262 };
};

export default function MapPage() {
  const router = useRouter();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const initPosition = getInitPosition();

  const allNodes = getAllMapNodes();
  const allSatellites = getAllSatelliteNodes();
  const selectedNode = selectedNodeId
    ? (getMapNode(selectedNodeId) as MapNodeType)
    : null;

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
  };

  const handleSelectNode = () => {
    if (!selectedNodeId) return;
    router.push(`/game/dungeon?nodeId=${selectedNodeId}`);
  };

  return (
    <div className="bg-paper fixed inset-0 flex flex-col overflow-hidden">
      {/* Header Overlay */}
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
          <div className="text-ink-secondary text-xs">人界·全图</div>
        </div>
      </div>

      {/* Map Canvas */}
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
            {/* The Map Container */}
            <div
              className="relative"
              style={{
                width: '3056px',
                height: '2143px',
              }}
            >
              {/* Grid Lines for style */}
              <div className="bgi-map ring-ink/50 absolute inset-0 opacity-80 shadow ring-10" />

              {/* Region Labels (Background) */}
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

              {/* Connections (Edges) */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {allNodes.flatMap((node) =>
                  node.connections.map((targetId) => {
                    const target = getMapNode(targetId) as MapNodeType;
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

              {/* Main Nodes */}
              {allNodes.map((node) => (
                <MapNode
                  key={node.id}
                  id={node.id}
                  name={node.name}
                  x={node.x}
                  y={node.y}
                  selected={selectedNodeId === node.id}
                  onClick={handleNodeClick}
                />
              ))}

              {/* Satellite Nodes */}
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

      {/* Selected Node Details Panel */}
      {selectedNode && (
        <MapNodeDetail
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onSelect={handleSelectNode}
        />
      )}
    </div>
  );
}
