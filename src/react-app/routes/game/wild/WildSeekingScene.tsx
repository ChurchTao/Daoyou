import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTag } from '@app/components/ui/InkTag';
import type { WildRegionView } from '@shared/contracts/combatV6Wild';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { getMapNode } from '@shared/lib/game/mapSystem';
import './wild-seeking.css';

export function WildSeekingScene({
  region,
  searching,
  starting,
  unavailable,
  qi,
  onSearch,
  onStart,
}: {
  region: WildRegionView;
  searching: boolean;
  starting: boolean;
  unavailable: boolean;
  qi: number | null;
  onSearch: () => void;
  onStart: () => void;
}) {
  const encounter = region.encounter;
  const cubs = encounter?.combatants.filter((c) => c.level === 0).length ?? 0;
  const location = getMapNode(region.nodeId);
  const parent =
    location && 'parent_id' in location ? getMapNode(location.parent_id) : null;
  const insufficient = qi !== null && qi < region.qiCost;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 sm:px-8">
      <header className="from-teal/5 relative bg-linear-to-b to-transparent px-2 pt-8 pb-7 text-center">
        <p className="text-ink-secondary text-xs tracking-widest">
          {parent?.name ?? '山野'} · 野外
        </p>
        <h1 className="font-heading text-ink mt-2 text-3xl tracking-widest">
          {region.name}
        </h1>
        <p className="text-ink-secondary mt-3 text-sm leading-7">
          {region.description}
        </p>
      </header>
      <section
        className="border-ink/10 flex min-h-64 flex-col justify-center border-t py-7"
        aria-label="本次寻觅"
        aria-busy={searching}
      >
        {searching ? (
          <GameLoadingState
            variant="inline"
            immediate
            message={region.searchText}
          />
        ) : encounter ? (
          <div key={encounter.id} className="wild-seeking-result">
            <div className="mb-6 flex items-baseline justify-between gap-4 text-sm">
              <span>发现灵兽</span>
              <span className="text-ink-secondary font-mono text-xs">
                {encounter.combatants.length} 只
              </span>
            </div>
            <ul
              className="flex flex-wrap justify-center gap-x-5 gap-y-6 sm:gap-x-8"
              aria-label="本次发现的灵兽"
            >
              {encounter.combatants.map((c) => (
                <li
                  key={c.unitId}
                  className="flex w-28 flex-col items-center text-center"
                >
                  <div
                    className={
                      c.level === 0
                        ? 'bg-wood/10 rounded-full p-3'
                        : 'bg-ink/5 rounded-full p-3'
                    }
                  >
                    <BeastIcon speciesId={c.speciesId} className="text-5xl" />
                  </div>
                  <span className="mt-3 text-sm">
                    {BEAST_SPECIES.find((s) => s.id === c.speciesId)?.name ??
                      '灵兽'}
                  </span>
                  <span className="text-ink-secondary mt-1 flex items-center gap-1 text-xs">
                    <span className="font-mono">{c.level}级</span>
                    {c.level === 0 ? (
                      <InkTag tone="info">幼崽</InkTag>
                    ) : (
                      <span>成年</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p
              className="text-ink-secondary mt-6 text-center text-sm"
              role="status"
            >
              {cubs
                ? '草木间的小小身影，是尚未长成的幼崽。'
                : '灵兽的身影渐渐清晰，你已看清眼前的动静。'}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <GameIcon value="🌾" className="text-3xl" />
            <p className="mt-4 text-sm">草木深处，似有灵兽出没。</p>
            <p className="text-ink-secondary mt-2 text-xs">
              静下心来，寻一寻它们的踪迹。
            </p>
          </div>
        )}
      </section>
      <div className="text-center">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <InkButton
            variant={encounter ? 'secondary' : 'primary'}
            pending={searching}
            pendingLabel="正在寻觅……"
            disabled={unavailable || starting || insufficient || qi === null}
            onClick={onSearch}
          >
            {encounter ? '继续寻觅' : '寻觅灵兽'}
          </InkButton>
          {encounter && !searching && (
            <InkButton
              variant="primary"
              pending={starting}
              pendingLabel="正在开战……"
              disabled={unavailable}
              onClick={onStart}
            >
              开战捕捉
            </InkButton>
          )}
        </div>
        <p className="text-ink-secondary mt-3 text-xs leading-6">
          每次寻觅消耗 <span className="font-mono">{region.qiCost}</span>{' '}
          点天地灵气
          {qi !== null && (
            <>
              {' '}
              · 当前 <span className="font-mono">{qi}</span>
            </>
          )}
        </p>
        {insufficient && (
          <p className="text-crimson mt-1 text-xs" role="status">
            天地灵气不足，待自然恢复或补充后再寻觅。
          </p>
        )}
        {encounter && !searching && (
          <p className="text-ink-secondary mt-1 text-xs">
            继续寻觅将离开当前这组灵兽。
          </p>
        )}
      </div>
    </div>
  );
}
