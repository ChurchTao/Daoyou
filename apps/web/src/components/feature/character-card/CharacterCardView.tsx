import { InkModal } from '@app/components/layout';
import { GameIcon } from '@app/components/ui/GameIcon';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import type {
  CharacterCard,
  CharacterCardBeast,
  CharacterCardEquipment,
} from '@daoyou/contracts/player/card';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { SPONSORSHIP_TIER_META } from '@daoyou/game-domain/sponsorship';
import { useLayoutEffect, useRef, useState } from 'react';
import { BeastTradeDetails } from '../beasts/BeastTradePreview';
import { itemPresentation } from '../items/itemPresentation';
import { ItemPreview } from '../items/ItemPreview';
import { MeritStamp } from '../merit/MeritStamp';

type CardDetail =
  | { kind: 'equipment'; item: CharacterCardEquipment }
  | { kind: 'beast'; beast: CharacterCardBeast };

function beastIcon(beast: CharacterCardBeast) {
  return (
    BEAST_SPECIES.find((entry) => entry.id === beast.speciesId)?.icon ?? '🐾'
  );
}

function CardThumb({
  label,
  icon,
  color,
  onClick,
}: {
  label: string;
  icon: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`查看${label}`}
      onClick={onClick}
      className="bg-paper border-ink/20 hover:border-crimson/50 @container relative aspect-square min-h-0 min-w-0 cursor-pointer overflow-hidden border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-1 top-[18%] grid h-[44%] place-items-center text-[clamp(1.25rem,44cqw,2.5rem)] leading-none"
      >
        <GameIcon value={icon} purpose="artwork" />
      </span>
      <span
        className={cn(
          'pointer-events-none absolute inset-x-1 top-[60%] flex h-[34%] items-center justify-center text-center wrap-anywhere',
          label.length > 5
            ? 'text-[clamp(0.5rem,16cqw,0.625rem)] leading-[1.05]'
            : 'text-[clamp(0.625rem,16cqw,0.75rem)] leading-[1.1]',
          color,
        )}
      >
        <span className="line-clamp-2 w-full">{label}</span>
      </span>
    </button>
  );
}

function CardBackground({ text }: { text: string }) {
  const probe = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = probe.current;
    if (!element) return;
    const measure = () => {
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className="relative">
      <p
        ref={probe}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 line-clamp-3 leading-6 break-words whitespace-pre-wrap"
      >
        {text}
      </p>
      <p
        className={cn(
          'text-ink-secondary leading-6 break-words whitespace-pre-wrap',
          !expanded && 'line-clamp-3',
        )}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          aria-expanded={expanded}
          className="text-teal mt-1 cursor-pointer text-sm"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '收起' : '展开'}
        </button>
      ) : null}
    </div>
  );
}

export function CharacterCardBeastSlot({
  beast,
}: {
  beast: CharacterCardBeast;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CardThumb
        label={beast.name}
        icon={beastIcon(beast)}
        onClick={() => setOpen(true)}
      />
      <InkModal isOpen={open} title={beast.name} onClose={() => setOpen(false)}>
        <BeastTradeDetails beast={beast} tradeNotice={false} />
      </InkModal>
    </>
  );
}

export function CharacterCardView({
  card,
  onDetailChange,
}: {
  card: CharacterCard;
  onDetailChange?: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const active =
    detail &&
    (detail.kind === 'equipment'
      ? card.equipment.some((item) => item.id === detail.item.id)
      : card.beasts.some((beast) => beast.id === detail.beast.id))
      ? detail
      : null;
  const showDetail = (next: CardDetail) => {
    setDetail(next);
    onDetailChange?.(true);
  };
  const hideDetail = () => {
    setDetail(null);
    onDetailChange?.(false);
  };

  return (
    <div className="relative isolate text-sm">
      {!active && card.sponsorshipTier ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <MeritStamp
              tier={card.sponsorshipTier}
              className="absolute top-0 -right-4 size-32 opacity-[0.12]"
            />
          </div>
          <span className="sr-only">
            最高赞助：{SPONSORSHIP_TIER_META[card.sponsorshipTier].name}
          </span>
        </>
      ) : null}
      {active ? (
        <div className="space-y-3">
          <InkButton className="px-0" onClick={hideDetail}>
            返回名片
          </InkButton>
          {active.kind === 'equipment' ? (
            <ItemPreview item={active.item} options={{ hideQuantity: true }} />
          ) : (
            <BeastTradeDetails beast={active.beast} tradeNotice={false} />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <header className="flex items-center gap-3">
            <GameIcon
              value={
                card.gender === '女'
                  ? 'icon:cultivator-female-avatar'
                  : 'icon:cultivator-male-avatar'
              }
              purpose="artwork"
              label={`${card.name}的墨像`}
              className="h-24 w-16 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-xl leading-tight font-semibold break-words">
                {card.name}
              </h2>
              {card.title ? (
                <p className="text-crimson leading-snug break-words">
                  「{card.title}」
                </p>
              ) : null}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                <span className={tierColorMap[card.realm]}>
                  {card.realm} · {card.realmStage}
                </span>
                <span className="text-ink-secondary">
                  {card.sectName ?? '散修'}
                </span>
              </div>
            </div>
          </header>
          {card.background ? <CardBackground text={card.background} /> : null}
          {card.equipment.length || card.beasts.length ? (
            <div className="space-y-2">
              {card.equipment.length ? (
                <section
                  aria-label="展示道装"
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3"
                >
                  <h3 className="text-ink-secondary text-xs">道装</h3>
                  <div className="grid grid-cols-[repeat(3,minmax(0,4rem))] gap-1.5">
                    {card.equipment.map((item) => {
                      const summary = itemPresentation(item);
                      return (
                        <CardThumb
                          key={item.id}
                          label={item.name}
                          icon={summary.icon}
                          color={summary.color}
                          onClick={() =>
                            showDetail({ kind: 'equipment', item })
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}
              {card.beasts.length ? (
                <section
                  aria-label="展示灵兽"
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3"
                >
                  <h3 className="text-ink-secondary text-xs">灵兽</h3>
                  <div className="grid grid-cols-[repeat(3,minmax(0,4rem))] gap-1.5">
                    {card.beasts.map((beast) => (
                      <CardThumb
                        key={beast.id}
                        label={beast.name}
                        icon={beastIcon(beast)}
                        onClick={() => showDetail({ kind: 'beast', beast })}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
