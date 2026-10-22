import { InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { getElementInfo } from '@daoyou/game-content/presentation/concepts';

export function MarrowWashPanel() {
  const profile = useCultivatorIdentity();
  const identity = profile.data?.cultivator;
  if (!identity) return <InkNotice>尚无洗髓资料。</InkNotice>;
  return (
    <div>
      <dl>
        <dt className="text-ink-secondary text-sm">自由属性点</dt>
        <dd className="mt-1 font-mono text-4xl font-semibold tracking-tight">
          {identity.unallocated_attribute_points ?? 0}
        </dd>
      </dl>
      <section aria-label="灵根后天增益" className="mt-5">
        <h4 className="text-ink-secondary mb-1 text-xs">灵根</h4>
        {identity.spiritual_roots.length ? (
          <dl className="divide-ink/10 divide-y">
            {identity.spiritual_roots.map((root, index) => (
              <div
                key={`${root.element}-${index}`}
                className="flex items-center gap-2 py-2.5"
              >
                <GameIcon
                  value={getElementInfo(root.element).icon}
                  className="size-6 text-xl"
                />
                <div className="min-w-0 flex-1">
                  <dt className="text-sm">{root.element}灵根</dt>
                  <dd className="text-ink-secondary text-xs">
                    先天{' '}
                    <span className="font-mono">
                      {root.baseStrength ?? root.strength}
                    </span>{' '}
                    · 后天{' '}
                    <span className="text-wood font-mono">
                      +{root.marrowWashBonus ?? 0}
                    </span>
                  </dd>
                </div>
                <dd className="font-mono text-lg font-semibold">
                  {root.strength}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-ink-secondary text-xs">暂无灵根</p>
        )}
      </section>
    </div>
  );
}
