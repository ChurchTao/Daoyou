import { InkTag } from '@/components/ui/InkTag';
import { MapNodeInfo } from '@/lib/game/mapSystem';

export function MapNodeCard({ node }: { node: MapNodeInfo }) {
  return (
    <div
      className={`border-crimson bg-crimson/5 ring-crimson rounded border transition-all duration-300`}
    >
      <div className="cursor-pointer p-3">
        <div className="mb-1 flex items-start justify-between">
          <h3 className={`text-crimson font-bold`}>{node.name}</h3>
          <span className="text-crimson text-xs">● 已选择</span>
        </div>
        <p className="text-ink-secondary mb-2 line-clamp-2 text-xs">
          {node.description}
        </p>
        <div className="flex flex-wrap gap-1">
          {node.tags.slice(0, 3).map((t) => (
            <InkTag
              key={t}
              variant="outline"
              tone="neutral"
              className="py-0 text-[10px]"
            >
              {t}
            </InkTag>
          ))}
        </div>
      </div>
    </div>
  );
}
