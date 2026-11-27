import { GameIcon } from '@app/components/ui/GameIcon';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import type { CharacterCard } from '@daoyou/contracts/player/card';
import { useId, useState, type KeyboardEvent } from 'react';
import { MeritStamp } from '../merit/MeritStamp';
import { CardPageContent } from './CharacterCardPages';

const pages = ['基本', '装备', '功法', '炼体', '根基'] as const;
export type CardPage = (typeof pages)[number];

export function CharacterCardView({ card }: { card: CharacterCard }) {
  const [page, setPage] = useState<CardPage>('基本');
  const id = useId();
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = {
      ArrowDown: (index + 1) % pages.length,
      ArrowUp: (index + pages.length - 1) % pages.length,
      Home: 0,
      End: pages.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setPage(pages[next]);
    event.currentTarget.parentElement?.querySelectorAll('button')[next].focus();
  }

  return (
    <article className="text-ink text-sm">
      <header className="border-ink/20 from-ink/6 relative isolate mb-3 flex min-h-24 items-center gap-3 overflow-hidden border-b bg-linear-to-r to-transparent px-2">
        <GameIcon
          value={
            card.gender === '女'
              ? 'icon:cultivator-female-avatar'
              : 'icon:cultivator-male-avatar'
          }
          purpose="artwork"
          label={`${card.name}的墨像`}
          className="h-24 w-20"
        />
        <div className="min-w-0 py-2">
          {card.title && (
            <p className="text-crimson text-xs tracking-widest wrap-anywhere">
              {card.title}
            </p>
          )}
          <h3 className="font-heading my-1 text-3xl leading-tight wrap-anywhere">
            {card.name}
          </h3>
          <p className="flex flex-wrap gap-x-3">
            <span className={tierColorMap[card.realm]}>
              {card.realm}
              {card.realmStage}
            </span>
            <span className="text-ink-secondary">
              {card.sectName ?? '散修'}
            </span>
          </p>
        </div>
        {card.sponsorshipTier && (
          <MeritStamp
            tier={card.sponsorshipTier}
            className="pointer-events-none absolute -right-3 -bottom-3 -z-10 size-20 opacity-15"
          />
        )}
      </header>
      <div className="character-card-pages">
        <div
          className="character-card-rail"
          aria-label="名片资料"
          role="tablist"
          aria-orientation="vertical"
        >
          {pages.map((p, i) => (
            <button
              key={p}
              type="button"
              id={id + '-tab-' + p}
              role="tab"
              aria-controls={id + '-panel'}
              aria-selected={p === page}
              tabIndex={p === page ? 0 : -1}
              onKeyDown={(e) => moveTab(e, i)}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div
          key={page}
          role="tabpanel"
          id={id + '-panel'}
          aria-labelledby={id + '-tab-' + page}
          tabIndex={0}
          className="character-card-panel battle-scroll min-w-0 space-y-4 overflow-y-auto overscroll-contain pt-1 pr-3 pb-2"
        >
          <CardPageContent card={card} page={page} />
        </div>
      </div>
    </article>
  );
}
