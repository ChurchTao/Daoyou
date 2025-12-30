import { InkTag } from '@/components/ui';
import { MapNodeInfo } from '@/lib/game/mapSystem';

export function MapNodeCard({ node }: { node: MapNodeInfo }) {
  return (
    <div
      className={`border rounded transition-all duration-300 border-crimson bg-crimson/5 ring-crimson`}
    >
      <div className="p-3 cursor-pointer">
        <div className="flex justify-between items-start mb-1">
          <h3 className={`font-bold text-crimson`}>{node.name}</h3>
          <span className="text-crimson text-xs">● 已选择</span>
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
    </div>
  );
}
