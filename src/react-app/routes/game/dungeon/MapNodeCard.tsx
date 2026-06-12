import {
  dungeonDifficultyColorMap,
  tierColorMap,
} from '@app/components/ui/InkBadge';
import { InkTag } from '@app/components/ui/InkTag';
import {
  canChallengeDungeonRealm,
  resolveDungeonMapConfig,
  type MapNodeInfo,
} from '@shared/lib/game/mapSystem';
import { cn } from '@shared/lib/cn';
import type { RealmType } from '@shared/types/constants';

export function MapNodeCard({
  node,
  playerRealm,
}: {
  node: MapNodeInfo;
  playerRealm?: RealmType;
}) {
  const dungeonConfig = resolveDungeonMapConfig(node);
  const isRealmEligible = playerRealm
    ? canChallengeDungeonRealm(playerRealm, node.realm_requirement)
    : true;

  return (
    <div
      className={cn(
        'border transition-colors',
        isRealmEligible
          ? 'border-crimson bg-crimson/5'
          : 'border-ink/20 bg-ink/5',
      )}
    >
      <div className="cursor-pointer p-3">
        <div className="mb-1 flex items-start justify-between">
          <h3 className={cn('font-bold', isRealmEligible ? 'text-crimson' : 'text-ink')}>
            {node.name}
          </h3>
          <span
            className={cn(
              'text-xs',
              isRealmEligible ? 'text-crimson' : 'text-ink-secondary',
            )}
          >
            ● {isRealmEligible ? '已选择' : '境界不足'}
          </span>
        </div>
        <p className="text-ink-secondary mb-2 line-clamp-2 text-xs">
          {node.description}
        </p>
        <div className="text-ink-secondary mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>
            推荐境界：
            <span
              className={cn('font-semibold', tierColorMap[node.realm_requirement])}
            >
              {node.realm_requirement}
            </span>
          </span>
          <span>
            难度：
            <span
              className={cn(
                'font-semibold',
                dungeonDifficultyColorMap[dungeonConfig.difficultyTier],
              )}
            >
              {dungeonConfig.difficultyLabel}
            </span>
          </span>
        </div>
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
