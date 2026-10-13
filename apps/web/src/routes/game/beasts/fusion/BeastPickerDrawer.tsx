import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastPickerPager } from '@app/components/feature/beasts/beastPicker';
import { useBeastPicker } from '@app/components/feature/beasts/useBeastPicker';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { BEAST_FUSION } from '@daoyou/game-content/beasts';
import type { BeastLineup, SummonedBeast } from '@daoyou/game-domain/beasts';
import { beastFusionMaterialReason } from '@daoyou/game-rules/beasts/fusion';
import { useEffect } from 'react';
import { FusionIdentityTag } from './FusionBeastPanel';

export function BeastPickerDrawer({
  side,
  excludeId,
  selectedId,
  onClose,
  onSelect,
  onMeta,
}: {
  side: '左' | '右';
  excludeId?: string;
  selectedId?: string;
  onClose: () => void;
  onSelect: (beast: SummonedBeast) => void;
  onMeta: (meta: { ownerLevel: number; lineup: BeastLineup }) => void;
}) {
  const picker = useBeastPicker();
  const page = picker.data;
  useEffect(() => {
    if (page) onMeta({ ownerLevel: page.ownerLevel, lineup: page.lineup });
  }, [onMeta, page]);
  return (
    <InkDetailDrawer
      isOpen
      title={`选择${side}侧灵兽`}
      description={`每页 ${page?.pageSize ?? 15} 只。达到 ${BEAST_FUSION.minimumLevel} 级的普通灵兽可以融合，在灵兽袋或仓库中都可以。`}
      onClose={onClose}
      size="md"
    >
      {picker.error ? (
        <div role="alert" className="space-y-3 py-6 text-center">
          <p className="text-crimson text-sm">{picker.error}</p>
          <InkButton onClick={picker.reload}>重新加载</InkButton>
        </div>
      ) : !page ? (
        <p className="text-ink-secondary py-8 text-center text-sm">
          正在读取灵兽……
        </p>
      ) : (
        <div className="space-y-2" role="group" aria-label="可选灵兽">
          {page.beasts.map((beast) => {
            const blocked =
              beast.id === excludeId
                ? '已选入另一侧'
                : beastFusionMaterialReason(beast, page.ownerLevel);
            const location = page.lineup.carriedBeastIds.includes(beast.id)
              ? '灵兽袋'
              : '仓库';
            return (
              <button
                type="button"
                key={beast.id}
                disabled={!!blocked}
                aria-pressed={selectedId === beast.id}
                onClick={() => onSelect(beast)}
                className={`focus-visible:outline-teal flex min-h-20 w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${selectedId === beast.id ? 'border-teal bg-teal/8' : 'hover:bg-ink/5 border-transparent'}`}
              >
                <BeastIcon
                  speciesId={beast.speciesId}
                  isMutant={beast.isMutant}
                  className="text-5xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1 text-sm">
                    {beast.name}
                    <FusionIdentityTag beast={beast} />
                    <span className="text-ink-secondary">{location}</span>
                    {page.lineup.leadBeastId === beast.id ? (
                      <span className="text-teal">首发</span>
                    ) : null}
                  </span>
                  <span className="text-ink-secondary mt-1 block text-xs">
                    <span className="font-mono">{beast.level}</span> 级 ·{' '}
                    <span className="font-mono">{beast.skills.length}</span>{' '}
                    技能 · 成长{' '}
                    <span className="font-mono">{beast.growth.toFixed(3)}</span>
                  </span>
                  {blocked ? (
                    <span className="text-ink-secondary mt-2 block text-xs">
                      {blocked}
                    </span>
                  ) : null}
                </span>
                {selectedId === beast.id ? (
                  <span className="text-teal text-xs">已选</span>
                ) : null}
              </button>
            );
          })}
          {!page.total ? (
            <p className="text-ink-secondary py-8 text-center text-sm">
              尚未拥有灵兽
            </p>
          ) : null}
          <BeastPickerPager
            page={page.page}
            total={page.total}
            loading={picker.loading}
            onPage={picker.setPage}
          />
        </div>
      )}
    </InkDetailDrawer>
  );
}
