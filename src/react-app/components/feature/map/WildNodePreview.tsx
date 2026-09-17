import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { getWildRegion } from '@shared/engine/combat-v6/wild/content';

export function WildNodePreview({ nodeId }: { nodeId: string }) {
  const region = getWildRegion(nodeId);
  if (!region) return null;
  return (
    <div className="my-3 text-sm">
      <p>灵兽栖息地 · 偶有幼崽</p>
      <ul className="text-ink-secondary mt-2 space-y-1">
        {region.species.map((entry) => (
          <li key={entry.speciesId} className="flex justify-between gap-3">
            <span>
              {BEAST_SPECIES.find((s) => s.id === entry.speciesId)?.name}
            </span>
            <span className="font-mono text-xs">
              {entry.minLevel}～{entry.maxLevel}级
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
