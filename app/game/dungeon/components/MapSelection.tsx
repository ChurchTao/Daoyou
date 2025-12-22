import { InkTag } from '@/components/InkComponents';
import {
  MapNode,
  getAllMapNodes,
  getNodesByRegion,
  getSatellitesForNode,
} from '@/lib/game/mapSystem';
import { useMemo, useState } from 'react';

interface MapSelectionProps {
  onSelect: (nodeId: string) => void;
  selectedId: string | null;
}

export function MapSelection({ onSelect, selectedId }: MapSelectionProps) {
  // Region tabs could be useful, for now let's just list everything cleanly.
  // Group by region
  const nodes = getAllMapNodes();
  const regions = Array.from(new Set(nodes.map((n) => n.region)));
  const [activeRegion, setActiveRegion] = useState(regions[0]);

  const regionNodes = useMemo(
    () => getNodesByRegion(activeRegion),
    [activeRegion],
  );

  return (
    <div className="space-y-4">
      {/* Region Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {regions.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap transition-colors
              ${
                activeRegion === r
                  ? 'bg-crimson text-paper font-bold'
                  : 'bg-paper border border-ink/20 text-ink/60 hover:border-crimson/50'
              }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Nodes List */}
      <div className="grid gap-3">
        {regionNodes.map((node) => (
          <MapNodeCard
            key={node.id}
            node={node}
            isSelected={selectedId === node.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function MapNodeCard({
  node,
  isSelected,
  onSelect,
}: {
  node: MapNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const satellites = getSatellitesForNode(node.id);

  return (
    <div
      className={`border rounded transition-all duration-300 ${isSelected ? 'border-crimson bg-crimson/5 ring-1 ring-crimson' : 'border-ink/10 hover:border-ink/30 bg-paper'}`}
    >
      <div className="p-3 cursor-pointer" onClick={() => onSelect(node.id)}>
        <div className="flex justify-between items-start mb-1">
          <h3
            className={`font-bold ${isSelected ? 'text-crimson' : 'text-ink'}`}
          >
            {node.name}
          </h3>
          {isSelected && <span className="text-crimson text-xs">● 已选择</span>}
        </div>
        <p className="text-xs text-ink-secondary line-clamp-2 mb-2">
          {node.description}
        </p>
        <div className="flex flex-wrap gap-1">
          {node.tags.slice(0, 3).map((t) => (
            <InkTag
              key={t}
              variant="outline"
              tone="neutral"
              className="text-[10px] py-0"
            >
              {t}
            </InkTag>
          ))}
        </div>
      </div>

      {/* Satellites */}
      {satellites.length > 0 && (
        <div className="border-t border-ink/5 bg-ink/5 p-2 space-y-2">
          <div className="text-[10px] text-ink-secondary font-bold px-1">
            周边探索点:
          </div>
          {satellites.map((sat) => (
            <div
              key={sat.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(sat.id);
              }}
              className={`p-2 rounded border cursor-pointer flex justify-between items-center
                        ${isSelected /* Logic for sat selection if we tracked it separately */ ? '' : ''}
                        hover:bg-paper hover:border-crimson/30 border-transparent bg-paper/50
                    `}
            >
              <div>
                <div className="text-xs font-medium text-ink/80">
                  {sat.name}
                </div>
                <div className="text-[10px] text-ink-secondary">{sat.type}</div>
              </div>
              {/* Simplified selection visual for sat would be needed in parent state */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
