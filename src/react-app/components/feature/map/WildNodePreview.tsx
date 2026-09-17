import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { getWildRegion } from '@shared/engine/combat-v6/wild/content';

export function WildNodePreview({ nodeId }: { nodeId: string }) {
  const region = getWildRegion(nodeId);
  if (!region) return null;
  return (
    <div className="my-3 text-sm">
      <p>
        灵兽栖息地 ·{' '}
        <span className="font-mono">
          {region.minLevel}～{region.maxLevel}
        </span>
        级，偶有幼崽
      </p>
      <p className="text-ink-secondary mt-1">
        {region.speciesIds
          .map((id) => BEAST_SPECIES.find((s) => s.id === id)?.name)
          .join('、')}
      </p>
    </div>
  );
}
