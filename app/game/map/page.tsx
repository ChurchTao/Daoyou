'use client';

import { InkButton, InkTag } from '@/components/InkComponents';
import {
  getAllMapNodes,
  getAllSatelliteNodes,
  getMapNode,
  MapNode,
} from '@/lib/game/mapSystem';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

export default function MapPage() {
  const router = useRouter();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // const [isLandscape, setIsLandscape] = useState(false);

  const allNodes = getAllMapNodes();
  const selectedNode = selectedNodeId
    ? (getMapNode(selectedNodeId) as MapNode)
    : null;

  // Handle Mobile Orientation via CSS logic simulation or just checking window
  // For now simple toggle button for "Immersive Mode" which forces landscape-like container

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
  };

  const handleSelectNode = () => {
    if (!selectedNodeId) return;
    // Navigate back to dungeon page with selected node
    router.push(`/game/dungeon?nodeId=${selectedNodeId}`);
  };

  return (
    <div className={`fixed inset-0 bg-paper overflow-hidden flex flex-col`}>
      {/* Header Overlay - Keep existing */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
          <InkButton
            onClick={() => router.back()}
            variant="outline"
            className="px-2 text-sm shadow bg-background!"
          >
            关闭
          </InkButton>
          {/* <InkButton
            onClick={() => setIsLandscape(!isLandscape)}
            variant="outline"
            disabled
            className="md:hidden px-2 text-sm shadow bg-background!"
          >
            {isLandscape ? '切换竖屏' : '切换横屏'}
          </InkButton> */}
        </div>
        <div className="pointer-events-auto px-4 py-2 rounded border border-ink/10 shadow bg-background">
          <div className=" font-bold text-ink">修仙界</div>
          <div className="text-xs text-ink-secondary">人界·全图</div>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="flex-1 w-full h-full  relative cursor-grab active:cursor-grabbing">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          limitToBounds={false}
          initialPositionX={-2382}
          initialPositionY={-1224}
        >
          <TransformComponent
            wrapperClass="w-full h-full"
            contentClass="w-full h-full"
          >
            {/* The Map Container - Fixed Aspect Ratio or Large Grid */}
            <div
              className="relative"
              style={{
                width: '3056px',
                height: '2143px',
              }}
            >
              {/* Grid Lines for style */}
              <div className="absolute inset-0 opacity-80 bgi-map shadow ring-10 ring-ink/50" />

              {/* Region Labels (Background) - Keep existing */}
              <div className="absolute top-[65%] right-[35%] text-6xl  text-ink/40 pointer-events-none select-none tracking-widest rotate-6">
                乱星海
              </div>
              <div className="absolute top-[48%] left-[33%] text-6xl  text-ink/40 pointer-events-none select-none tracking-widest rotate-6">
                无边海
              </div>
              <div className="absolute bottom-[4%] right-[15%] text-6xl  text-ink/40 pointer-events-none select-none tracking-widest">
                天南
              </div>
              <div className="absolute top-[30%] left-[44%] text-6xl  text-ink/40 pointer-events-none select-none tracking-widest writing-vertical">
                大晋
              </div>

              {/* Connections (Edges) - Keep existing */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {allNodes.flatMap((node) =>
                  node.connections.map((targetId) => {
                    const target = getMapNode(targetId) as MapNode;
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
                <div key={node.id}>
                  <div
                    id={`node-${node.id}`}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300
                                      ${selectedNodeId === node.id ? 'z-30 scale-125' : 'z-20 hover:scale-110'}
                                  `}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                  >
                    {/* Marker Icon */}
                    <div
                      className={`
                                      w-4 h-4 rounded-full border-2 
                                      ${selectedNodeId === node.id ? 'bg-crimson border-paper ring-4 ring-crimson/20' : 'border-ink hover:bg-crimson/50 bg-background'}
                                      shadow-lg
                                  `}
                    />
                    {/* Label */}
                    <div
                      className={`
                                      absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded
                                      ${selectedNodeId === node.id ? 'bg-crimson text-paper' : 'text-ink shadow-sm border border-ink/10 bg-background'}
                                  `}
                    >
                      {node.name.split('·').pop()}
                    </div>
                  </div>
                </div>
              ))}

              {/* Satellite Nodes - Rendered separately now with explicit logic */}
              {getAllSatelliteNodes().map((sat) => (
                <div
                  key={sat.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300
                                    ${selectedNodeId === sat.id ? 'z-30 scale-125' : 'z-10 hover:scale-110'}
                                `}
                  style={{ left: `${sat.x}%`, top: `${sat.y}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(sat.id);
                  }}
                >
                  {/* Improved Satellite Icon */}
                  <div
                    className={`w-3 h-3 rotate-45 border 
                        ${selectedNodeId === sat.id ? 'bg-crimson border-paper ring-2 ring-crimson/20' : 'bg-ink/60 border-paper hover:bg-crimson/60'}
                        shadow-sm
                    `}
                  />

                  {/* Label appears on hover or select */}
                  {selectedNodeId === sat.id && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-crimson text-paper px-1 rounded z-40">
                      {sat.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Selected Node Details Panel */}
      {selectedNode && (
        <div className="absolute bottom-16 left-4 right-4 z-40 md:w-96 md:left-auto md:right-8 bg-background">
          <div className="shadow-xl animate-in slide-in-from-bottom duration-300 border-ink/20 p-3">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold">{selectedNode.name}</h2>
              <InkButton
                variant="ghost"
                className="p-0!"
                onClick={() => setSelectedNodeId(null)}
              >
                ×
              </InkButton>
            </div>

            <p className="text-sm text-ink-secondary leading-relaxed mb-4">
              {selectedNode.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {selectedNode.tags.map((tag) => (
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
              onClick={handleSelectNode}
            >
              选择此地
            </InkButton>
          </div>
        </div>
      )}
    </div>
  );
}
