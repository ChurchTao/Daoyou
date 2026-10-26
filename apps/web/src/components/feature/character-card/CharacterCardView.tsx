import { GameIcon } from '@app/components/ui/GameIcon';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import type {
  CharacterCard,
  CharacterCardBeast,
} from '@daoyou/contracts/player/card';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { SPONSORSHIP_TIER_META } from '@daoyou/game-domain/sponsorship';
import { BeastTradeDetails } from '../beasts/BeastTradePreview';
import { ItemSlot, PreviewSlot } from '../items/ItemSlot';
import { MeritStamp } from '../merit/MeritStamp';

export function CharacterCardBeastSlot({
  beast,
}: {
  beast: CharacterCardBeast;
}) {
  const species = BEAST_SPECIES.find((entry) => entry.id === beast.speciesId);
  return (
    <PreviewSlot
      item={{
        name: beast.name,
        icon: species?.icon ?? '🐾',
        quantity: 1,
        color: 'text-ink',
      }}
      renderPreview={() => (
        <BeastTradeDetails beast={beast} tradeNotice={false} />
      )}
    />
  );
}

export function CharacterCardView({ card }: { card: CharacterCard }) {
  return (
    <div className="relative isolate text-sm">
      {card.sponsorshipTier ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <MeritStamp
              tier={card.sponsorshipTier}
              className="absolute -right-4 top-0 size-32 opacity-[0.12]"
            />
          </div>
          <span className="sr-only">
            最高赞助：{SPONSORSHIP_TIER_META[card.sponsorshipTier].name}
          </span>
        </>
      ) : null}
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
        {card.background ? (
          <p className="text-ink-secondary leading-6 break-words whitespace-pre-wrap">
            {card.background}
          </p>
        ) : null}
        {card.equipment.length || card.beasts.length ? (
          <div className="space-y-2">
            {card.equipment.length ? (
              <section
                aria-label="展示道装"
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3"
              >
                <h3 className="text-ink-secondary text-xs">道装</h3>
                <div className="grid grid-cols-[repeat(3,minmax(0,4rem))] gap-1.5">
                  {card.equipment.map((item) => (
                    <ItemSlot key={item.id} item={item} />
                  ))}
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
                    <CharacterCardBeastSlot key={beast.id} beast={beast} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
