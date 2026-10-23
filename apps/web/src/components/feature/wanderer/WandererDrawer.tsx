import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { useHunts } from '@app/components/feature/hunts/useHunts';
import { itemPresentation } from '@app/components/feature/items/itemPresentation';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import type { DisplayItem } from '@app/components/feature/items/presentation/types';
import { useInkUI } from '@app/components/providers/useInkUI';
import {
  InkButton,
  InkDetailDrawer,
  InkNotice,
  InkTag,
} from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { cn } from '@app/lib/cn';
import type {
  WandererBeastOffer,
  WandererBeastSaleResult,
  WandererBookPurchaseResult,
  WandererDewPurchaseResult,
  WandererIncensePurchaseResult,
  WandererState,
} from '@daoyou/contracts/wanderer';
import { BEAST_SUPERIOR_BOOK_SKILL_IDS } from '@daoyou/game-content/beasts';
import { BEAST_LURE } from '@daoyou/game-content/items/beasts';
import { findItemDefinition } from '@daoyou/game-content/items';
import { WANDERER_SUPERIOR_DEW_ID } from '@daoyou/game-rules/wanderer';
import { useState, type ReactNode } from 'react';

type View = 'meet' | 'beasts' | 'stall';
type Received =
  | { kind: 'dew'; quantity: number; line: string }
  | { kind: 'book'; definitionId: string; line: string }
  | { kind: 'incense'; line: string };

function sealedBookIcon() {
  const skillId = [...BEAST_SUPERIOR_BOOK_SKILL_IDS][0];
  return skillId
    ? itemPresentation(shelfItem(`book.${skillId}`, 1)).icon
    : '📕';
}

function shelfItem(definitionId: string, quantity: number): DisplayItem {
  return {
    definitionId,
    name: findItemDefinition(definitionId)?.name ?? definitionId,
    quantity,
    instanceData: null,
  };
}

function closingTime(expiresAt: number) {
  return new Date(expiresAt).toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <p className="text-base leading-8">
      <span className="sr-only">云游商人：</span>
      <span aria-hidden="true">“</span>
      {children}
      <span aria-hidden="true">”</span>
    </p>
  );
}

function StonePrice({ amount }: { amount: number }) {
  return (
    <p className="mt-1 text-center text-sm">
      <SpiritStones amount={amount} className="font-semibold" />
    </p>
  );
}

function choiceClass(tone: 'primary' | 'normal') {
  return cn(
    'border-ink/15 bg-ink/[0.025] focus-visible:outline-crimson enabled:hover:border-crimson/45 enabled:hover:bg-crimson/6 enabled:hover:text-crimson flex w-full cursor-pointer items-start border-l-2 px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-50',
    tone === 'primary' ? 'text-crimson' : 'text-ink',
  );
}

function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <p role="alert" className="text-crimson text-sm leading-6">
      {message}{' '}
      <button type="button" className="underline" onClick={onRetry}>
        重试
      </button>
    </p>
  );
}

function Receipt({ received }: { received: Received }) {
  const item =
    received.kind === 'book'
      ? shelfItem(received.definitionId, 1)
      : received.kind === 'incense'
        ? shelfItem(BEAST_LURE.id, 1)
        : shelfItem(WANDERER_SUPERIOR_DEW_ID, received.quantity);
  return (
    <div role="status" className="space-y-3">
      <Quote>{received.line}</Quote>
      <div className="w-28">
        <ItemSlot item={item} className="w-full" quantityLabel="奖励" />
      </div>
    </div>
  );
}

export function WandererDrawer({ onClose }: { onClose: () => void }) {
  const { openDialog } = useInkUI();
  const stateFeed = useHunts<WandererState>('/api/wanderer', 15000);
  const beastFeed = useHunts<{ beasts: WandererBeastOffer[] }>(
    '/api/wanderer/beasts',
    15000,
  );
  const state = stateFeed.data;
  const [view, setView] = useState<View>('meet');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [received, setReceived] = useState<Received | null>(null);
  const beasts = [...(beastFeed.data?.beasts ?? [])].sort((left, right) => {
    const leftWanted = left.speciesId === state?.wantedSpeciesId;
    const rightWanted = right.speciesId === state?.wantedSpeciesId;
    if (leftWanted !== rightWanted) return leftWanted ? -1 : 1;
    return left.speciesName.localeCompare(right.speciesName, 'zh');
  });

  const openView = (next: View) => {
    setView(next);
    setError('');
    setReceived(null);
  };

  const trade = async (action: () => Promise<Received>) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      setReceived(await action());
      stateFeed.refresh();
      beastFeed.refresh();
    } catch (cause) {
      setReceived(null);
      setError(cause instanceof Error ? cause.message : '交易没有完成');
      stateFeed.refresh();
      beastFeed.refresh();
    } finally {
      setPending(false);
    }
  };

  const askBeast = (beast: WandererBeastOffer) => {
    if (pending || beast.lead || beast.isLocked) return;
    openDialog({
      title: '交给游商',
      content: (
        <p className="text-sm leading-7">
          交出「{beast.name}」，换 {beast.bottles} 瓶上品归元灵露。
        </p>
      ),
      confirmLabel: '交出',
      cancelLabel: '再想想',
      onConfirm: () =>
        trade(async () => {
          const result = await combatV6Request<WandererBeastSaleResult>(
            '/api/wanderer/beasts',
            mutationBody({
              requestId: crypto.randomUUID(),
              beastId: beast.id,
              expectedRevision: beast.revision,
              expectedBottles: beast.bottles,
            }),
          );
          return {
            kind: 'dew',
            quantity: result.bottles,
            line: '这只我收下了。',
          };
        }),
    });
  };

  const askBook = () => {
    if (pending || !state || state.bookPrice === null) return;
    const expectedPrice = state.bookPrice;
    openDialog({
      title: '买下灵印',
      content: (
        <p className="text-sm leading-7">
          花费 <SpiritStones amount={expectedPrice} />，买一本随机上品传承灵印。
        </p>
      ),
      confirmLabel: '买下',
      cancelLabel: '再想想',
      onConfirm: () =>
        trade(async () => {
          const result = await combatV6Request<WandererBookPurchaseResult>(
            '/api/wanderer/book',
            mutationBody({
              requestId: crypto.randomUUID(),
              expectedPrice,
            }),
          );
          return {
            kind: 'book',
            definitionId: result.definitionId,
            line: '你自己揭开看。',
          };
        }),
    });
  };

  const askIncense = () => {
    if (pending || !state) return;
    const expectedPrice = state.incensePrice;
    openDialog({
      title: '买下引妖香',
      content: (
        <p className="text-sm leading-7">
          花费 <SpiritStones amount={expectedPrice} />，买 1
          份引妖香。
        </p>
      ),
      confirmLabel: '买下',
      cancelLabel: '再想想',
      onConfirm: () =>
        trade(async () => {
          await combatV6Request<WandererIncensePurchaseResult>(
            '/api/wanderer/incense',
            mutationBody({
              requestId: crypto.randomUUID(),
              expectedPrice,
            }),
          );
          return { kind: 'incense', line: '拿好，进山前点燃。' };
        }),
    });
  };

  const askDew = () => {
    if (pending || !state) return;
    const expectedPrice = state.dewPrice;
    openDialog({
      title: '买下灵露',
      content: (
        <p className="text-sm leading-7">
          花费 <SpiritStones amount={expectedPrice} />，买 1
          瓶上品归元灵露。
        </p>
      ),
      confirmLabel: '买下',
      cancelLabel: '再想想',
      onConfirm: () =>
        trade(async () => {
          await combatV6Request<WandererDewPurchaseResult>(
            '/api/wanderer/dew',
            mutationBody({
              requestId: crypto.randomUUID(),
              expectedPrice,
            }),
          );
          return { kind: 'dew', quantity: 1, line: '拿好。' };
        }),
    });
  };

  return (
    <InkDetailDrawer
      isOpen
      title="云游商人"
      closeLabel="告辞"
      onClose={onClose}
      size="lg"
    >
      {view === 'meet' ? (
        <div className="space-y-5">
          {stateFeed.error ? (
            <LoadError message={stateFeed.error} onRetry={stateFeed.refresh} />
          ) : null}
          {state ? (
            <div className="space-y-3">
              <div className="flex justify-center py-2">
                <BeastIcon
                  speciesId={state.wantedSpeciesId}
                  isMutant
                  className="text-8xl"
                />
              </div>
              <div className="space-y-2 text-center">
                <Quote>
                  {state.wantedSpeciesName}
                  我找了一路。你要是带着，灵露我给得比别的都多。
                </Quote>
                <p className="text-ink-secondary text-sm leading-6">
                  {state.regionName}这一带我还转转，大约{' '}
                  {closingTime(state.expiresAt)} 就走。
                </p>
              </div>
            </div>
          ) : stateFeed.error ? null : (
            <InkNotice>正在打听这位游商。</InkNotice>
          )}
          <div className="space-y-1.5">
            <button
              type="button"
              className={choiceClass('primary')}
              disabled={!state || pending}
              onClick={() => openView('beasts')}
            >
              我这儿有变异灵兽
            </button>
            <button
              type="button"
              className={choiceClass('normal')}
              disabled={!state || pending}
              onClick={() => openView('stall')}
            >
              看看你摊上的货
            </button>
          </div>
        </div>
      ) : null}

      {view === 'beasts' ? (
        <div className="space-y-4">
          <InkButton disabled={pending} onClick={() => openView('meet')}>
            先不交
          </InkButton>
          {error ? (
            <p role="alert" className="text-crimson text-sm leading-6">
              {error}
            </p>
          ) : null}
          {received ? <Receipt received={received} /> : null}
          {beastFeed.error ? (
            <LoadError message={beastFeed.error} onRetry={beastFeed.refresh} />
          ) : null}
          {!beastFeed.error && !beastFeed.data ? (
            <InkNotice>正在清点你的灵兽。</InkNotice>
          ) : null}
          {!beastFeed.error && beastFeed.data && beasts.length === 0 ? (
            <InkNotice>你没有可交给他的变异灵兽。</InkNotice>
          ) : null}
          <ul className="space-y-2">
            {beasts.map((beast) => {
              const wanted = beast.speciesId === state?.wantedSpeciesId;
              return (
                <li key={beast.id}>
                  <button
                    type="button"
                    disabled={pending || beast.lead || beast.isLocked || !state}
                    onClick={() => askBeast(beast)}
                    className="bg-paper border-ink/20 hover:border-crimson/50 focus-visible:outline-crimson flex w-full min-w-0 items-center gap-4 border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <BeastIcon
                      speciesId={beast.speciesId}
                      isMutant
                      className="shrink-0 text-6xl"
                    />
                    <span className="min-w-0 flex-1 space-y-1 text-sm">
                      <span className="flex flex-wrap items-center gap-2 text-base">
                        <span className="truncate">{beast.name}</span>
                        {wanted ? <InkTag tone="info">心仪</InkTag> : null}
                      </span>
                      <span className="text-ink-secondary block">
                        {beast.speciesName} ·{' '}
                        <span className="font-mono">{beast.level}</span>级
                      </span>
                      <span className="block">
                        <span className="font-mono font-semibold">
                          {beast.bottles}
                        </span>{' '}
                        瓶上品归元灵露
                      </span>
                      {beast.isLocked ? (
                        <span className="text-ink-secondary block">
                          已锁定，请先解锁
                        </span>
                      ) : beast.lead ? (
                        <span className="text-ink-secondary block">
                          正在首发，先取消首发
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {view === 'stall' ? (
        <div className="space-y-4">
          <InkButton disabled={pending} onClick={() => openView('meet')}>
            先不看
          </InkButton>
          {error ? (
            <p role="alert" className="text-crimson text-sm leading-6">
              {error}
            </p>
          ) : null}
          {received ? <Receipt received={received} /> : null}
          {stateFeed.error ? (
            <LoadError message={stateFeed.error} onRetry={stateFeed.refresh} />
          ) : null}
          {!state && !stateFeed.error ? (
            <InkNotice>正在打听这位游商。</InkNotice>
          ) : null}
          {state ? (
            <div className="grid grid-cols-3 items-start gap-3">
              <div className="w-full max-w-28 justify-self-center">
                <ItemSlot
                  item={shelfItem(BEAST_LURE.id, 1)}
                  className="w-full"
                  quantityLabel="奖励"
                  disabled={pending}
                >
                  {(close) => (
                    <InkButton
                      disabled={pending}
                      onClick={() => {
                        close();
                        askIncense();
                      }}
                    >
                      买下
                    </InkButton>
                  )}
                </ItemSlot>
                <StonePrice amount={state.incensePrice} />
              </div>
              <div className="w-full max-w-28 justify-self-center">
                <ItemSlot
                  item={shelfItem(WANDERER_SUPERIOR_DEW_ID, 1)}
                  className="w-full"
                  quantityLabel="奖励"
                  disabled={pending}
                >
                  {(close) => (
                    <InkButton
                      disabled={pending}
                      onClick={() => {
                        close();
                        askDew();
                      }}
                    >
                      买下
                    </InkButton>
                  )}
                </ItemSlot>
                <StonePrice amount={state.dewPrice} />
              </div>
              <div className="w-full max-w-28 justify-self-center">
                <ItemSlot
                  className="w-full"
                  emptyLabel="随机上品传承灵印"
                  emptyIcon={
                    <GameIcon
                      value={sealedBookIcon()}
                      purpose="artwork"
                      className="text-ink"
                    />
                  }
                  disabled={pending || state.bookPrice === null}
                  onQuickAction={askBook}
                />
                {state.bookPrice === null ? (
                  <p className="text-ink-secondary mt-1 text-center text-sm">
                    今日已不可再售
                  </p>
                ) : (
                  <StonePrice amount={state.bookPrice} />
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </InkDetailDrawer>
  );
}
