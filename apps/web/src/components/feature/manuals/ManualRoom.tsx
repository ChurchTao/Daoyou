import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { apiFetch } from '@app/lib/api/fetch';
import { cn } from '@app/lib/cn';
import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type { InventoryView } from '@daoyou/contracts/inventory';
import type { ManualView } from '@daoyou/contracts/manuals';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { CHARACTER_ATTRIBUTE_LABELS } from '@daoyou/game-domain/character';
import type {
  CharacterManualDefV1,
  ManualAction,
  ManualSlotV1,
} from '@daoyou/game-domain/manuals';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import {
  getManualSlotCount,
  isAdvancedManual,
  manualLearnedSlot,
  manualLearningSlot,
  manualAttributeValue,
  MANUAL_SLOT_REALMS,
  MAX_MANUALS_PER_SLOT,
} from '@daoyou/game-rules/manuals/projection';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { combatV6Request, mutationBody } from '../combat-v6/request';
import { ManualDetail } from './ManualDetail';
import { ManualJadePicker } from './ManualJadePicker';
import { ManualRealmSlot } from './ManualRealmSlot';
import { manualMechanismSummary } from './manualPresentation';

const slotPositions = [
  'col-start-1 row-start-2',
  'col-start-3 row-start-2',
  'col-start-1 row-start-3',
  'col-start-3 row-start-3',
  'col-start-1 row-start-1',
  'col-start-3 row-start-1',
] as const;

const endpoint = '/api/combat-v6/manuals';
const desktopQuery = '(min-width: 1024px)';
const subscribeViewport = (notify: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;

export function ManualRoom() {
  const identity = useCultivatorIdentity();
  const gender = identity.data?.cultivator?.gender;
  const bag = useInventoryBag();
  const [params] = useSearchParams();
  const desktop = useSyncExternalStore(
    subscribeViewport,
    desktopSnapshot,
    () => false,
  );
  const [view, setView] = useState<ManualView>();
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<{
    slot: ManualSlotV1;
    manualId?: string;
    item?: InventoryView['items'][number];
  }>();
  const [drawer, setDrawer] = useState<'detail' | 'picker' | null>(() =>
    params.get('itemId') ? 'detail' : null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{
    manualId: string;
    message: string;
  }>();
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<ManualView>(endpoint, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setView(data);
          setError('');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(undefined), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function submit(action: ManualAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setFeedback(undefined);
    let succeeded = false;
    try {
      await consumeResourceMutation(
        await apiFetch(endpoint, {
          ...mutationBody(action),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      succeeded = true;
    } catch (e) {
      if ('item' in action) bag.invalidate();
      if (mounted.current)
        setError(e instanceof Error ? e.message : '操作失败，请刷新核对');
    } finally {
      try {
        const data = await combatV6Request<ManualView>(endpoint);
        if (mounted.current) {
          setView(data);
          if (succeeded) {
            const progress = data.state?.learned.find(
              (m) => m.manualId === action.manualId,
            );
            const name = CHARACTER_MANUALS_V1.find(
              (m) => m.id === action.manualId,
            )?.name;
            setFeedback({
              manualId: action.manualId,
              message:
                action.action === 'unlock'
                  ? `已开放至第 ${progress?.unlockedLevel} 层，可以继续参悟。`
                  : action.action === 'activate'
                    ? `已改修《${name}》。`
                    : action.action === 'learn'
                      ? `已习得《${name}》。`
                      : `${name} · 第 ${progress?.level} 层${progress?.level === 9 ? '，功法圆满。' : '已成。'}`,
            });
            setSelection({
              slot: action.slot,
              manualId: action.manualId,
            });
          }
        }
      } catch {
        if (mounted.current) {
          setView(undefined);
          setError('功法状态读取失败，请刷新核对后继续');
        }
      }
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  const hintedItem = bag.data?.items.find(
    (item) => item.id === params.get('itemId'),
  );
  const hintedManual = CHARACTER_MANUALS_V1.find(
    (m) =>
      m.id === (hintedItem && itemDefinition(hintedItem.definitionId).manualId),
  );
  const unlocked = view ? getManualSlotCount(view.realm) : 0;
  const learnedInSlot = (targetSlot: ManualSlotV1) =>
    CHARACTER_MANUALS_V1.filter((manual) =>
      view?.state?.learned.some(
        (entry) =>
          entry.manualId === manual.id &&
          manualLearnedSlot(manual, entry) === targetSlot,
      ),
    );
  const hintedProgress = view?.state?.learned.find(
    (entry) => entry.manualId === hintedManual?.id,
  );
  const hintedSlot = hintedManual
    ? (hintedProgress && manualLearnedSlot(hintedManual, hintedProgress)) ??
      (isAdvancedManual(hintedManual)
        ? ([5, 6] as const).find(
            (candidate) =>
              candidate <= unlocked &&
              learnedInSlot(candidate).length < MAX_MANUALS_PER_SLOT,
          ) ?? 5
        : manualLearningSlot(hintedManual))
    : undefined;
  const slot = selection?.slot ?? hintedSlot ?? 1;
  const realm = MANUAL_SLOT_REALMS[slot - 1];
  const slotOpen = slot <= unlocked;
  const label = slot > 4 ? '高阶功法' : `${realm} · 基础功法`;
  const learnedManuals = learnedInSlot(slot);
  const currentManual = learnedManuals.find((m) =>
    view?.state?.build.slots.some((s) => s.slot === slot && s.manualId === m.id),
  );
  const manual = CHARACTER_MANUALS_V1.find(
    (m) =>
      m.id ===
      (selection?.manualId ??
        (!selection ? hintedManual?.id : undefined) ??
        currentManual?.id ??
        learnedManuals[0]?.id),
  );
  const itemChoice = selection?.item ?? (!selection ? hintedItem : undefined);
  const choose = (m: CharacterManualDefV1) => {
    setSelection({ slot, manualId: m.id });
    setFeedback(undefined);
    setDrawer(desktop ? null : 'detail');
  };
  const notices = (
    <>
      {error ? (
        <p role="alert" className="text-crimson mb-3 text-sm">
          {error}
          <InkButton
            disabled={pending}
            onClick={() => setRefresh((n) => n + 1)}
          >
            刷新重试
          </InkButton>
        </p>
      ) : null}
      {view?.blockedReason ? (
        <p role="status" className="text-ink-secondary mb-3 text-sm">
          {view.blockedReason}
        </p>
      ) : null}
    </>
  );
  const detail =
    manual && view ? (
      <ManualDetail
        key={`${slot}:${manual.id}`}
        manual={manual}
        slot={slot}
        view={view}
        pending={pending}
        itemChoice={itemChoice}
        onSubmit={(action) => void submit(action)}
      />
    ) : null;
  const status = (
    <p
      role="status"
      aria-live="polite"
      className="text-crimson min-h-5 text-xs"
    >
      {feedback?.manualId === manual?.id ? feedback?.message : ''}
    </p>
  );

  return (
    <>
      <div aria-busy={pending} className="text-sm">
        {drawer === null || (desktop && drawer !== 'picker') ? notices : null}
        {!view ? (
          <p className="text-ink-secondary py-8">
            {error ? '等待重新读取功法。' : '正在翻阅功法……'}
          </p>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-7">
            <section aria-label="当前所修功法" className="lg:sticky lg:top-3">
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] grid-rows-3 items-center gap-x-1 gap-y-2 sm:grid-cols-[5.75rem_minmax(0,1fr)_5.75rem] sm:gap-x-2 lg:grid-cols-[6.25rem_minmax(0,1fr)_6.25rem]">
                {gender ? (
                  <GameImage
                    src={`/assets/manuals/cultivator-${gender === '女' ? 'female' : 'male'}-meditation.webp`}
                    alt=""
                    width={960}
                    height={960}
                    draggable={false}
                    className="pointer-events-none col-start-2 row-span-3 row-start-1 h-56 w-full object-contain select-none sm:h-72 lg:h-[22rem]"
                  />
                ) : (
                  <div className="col-start-2 row-span-3 row-start-1 h-56 sm:h-72 lg:h-[22rem]" />
                )}
                {MANUAL_SLOT_REALMS.map((slotRealm, index) => {
                  const targetSlot = (index + 1) as ManualSlotV1;
                  const activeManual = CHARACTER_MANUALS_V1.find((m) =>
                    view.state?.build.slots.some(
                      (s) => s.slot === targetSlot && s.manualId === m.id,
                    ),
                  );
                  const progress = view.state?.learned.find(
                    (p) => p.manualId === activeManual?.id,
                  );
                  return (
                    <div key={targetSlot} className={slotPositions[index]}>
                      <ManualRealmSlot
                        realm={slotRealm}
                        slot={targetSlot}
                        manual={activeManual}
                        progress={progress}
                        unlocked={index < unlocked}
                        selected={slot === targetSlot}
                        onSelect={() => {
                          if (pending) return;
                          setSelection({
                            slot: targetSlot,
                            manualId: activeManual?.id,
                          });
                          setFeedback(undefined);
                          setDrawer(
                            !activeManual &&
                              learnedInSlot(targetSlot).length === 0
                              ? 'picker'
                              : null,
                          );
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
            <section
              aria-label={`${label}书目，第${slot}位`}
              className="border-ink/15 min-w-0 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7"
            >
              <header className="mb-3 flex min-h-11 items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-medium">
                    <span
                      className={cn(
                        'border-b-2 border-current pb-px',
                        tierColorMap[realm],
                      )}
                    >
                      {realm}
                    </span>
                    {slot > 4 ? ` · 高阶 · 第${slot}位` : ' · 基础功法'}
                  </h3>
                  <span className="text-ink-secondary font-mono text-xs">
                    {learnedManuals.length}/{MAX_MANUALS_PER_SLOT}
                  </span>
                </div>
                {learnedManuals.length < MAX_MANUALS_PER_SLOT ? (
                  <InkButton
                    disabled={
                      pending ||
                      !slotOpen ||
                      !!view.blockedReason ||
                      !view.state
                    }
                    onClick={() => setDrawer('picker')}
                    className="min-h-11 text-sm"
                  >
                    学习新功法
                  </InkButton>
                ) : null}
              </header>
              {learnedManuals.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                  {learnedManuals.map((m) => {
                    const progress = view.state!.learned.find(
                      (p) => p.manualId === m.id,
                    )!;
                    const activeSlot = view.state!.build.slots.find(
                      (s) => s.manualId === m.id,
                    )?.slot;
                    const effect = m.effects[0];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-label={`预览${m.name}`}
                        aria-pressed={manual?.id === m.id}
                        disabled={pending}
                        onClick={() => choose(m)}
                        className={cn(
                          'relative min-h-20 border border-ink/15 border-l-2 border-l-current px-2 py-2 text-left transition-colors disabled:opacity-60',
                          tierColorMap[m.realm],
                          manual?.id === m.id
                            ? 'bg-current/8'
                            : 'hover:bg-current/5',
                        )}
                      >
                        <span className="block pr-3 text-sm font-medium">
                          {m.name}
                        </span>
                        {activeSlot ? (
                          <span
                            className="text-crimson absolute top-2 right-1 text-[10px]"
                            aria-label={`第${activeSlot}位生效`}
                          >
                            {slot > 4 ? `修${activeSlot}` : '修'}
                          </span>
                        ) : null}
                        <span className="text-ink-secondary mt-1 block text-xs">
                          <span className="font-mono">{progress.level}</span> 层
                          ·{' '}
                          {progress.level === 9
                            ? '圆满'
                            : manualMechanismSummary(m, progress.level).tag}
                        </span>
                        <span className="text-ink mt-1 block text-xs">
                          {CHARACTER_ATTRIBUTE_LABELS[effect.attribute]}{' '}
                          <span className="font-mono">
                            +{manualAttributeValue(effect, progress.level)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : !manual ? (
                <div className="border-ink/10 text-ink-secondary border-y py-12 text-center">
                  <p>{slotOpen ? `尚未习得${label}` : `${realm}期开放`}</p>
                  <p className="mt-2 text-xs">
                    {slotOpen
                      ? '以一枚玉简，开启修习。'
                      : '境界提升后，可在此运转一本功法。'}
                  </p>
                </div>
              ) : null}
              {desktop && detail ? (
                <div className="border-ink/15 mt-4 border-t pt-2">
                  {status}
                  <div className="pt-2">{detail}</div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
      <InkDetailDrawer
        isOpen={drawer === 'picker' || (!desktop && drawer === 'detail')}
        onClose={() => setDrawer(null)}
        title={drawer === 'picker' ? '选择功法玉简' : '参悟功法'}
        size="md"
      >
        {notices}
        {drawer === 'picker' && view ? (
          <ManualJadePicker
            view={view}
            slot={slot}
            disabled={pending || !!view.blockedReason}
            onChoose={(action, item) => {
              const chosen = CHARACTER_MANUALS_V1.find(
                (m) => m.id === action.manualId,
              )!;
              setSelection({
                slot: action.slot,
                manualId: chosen.id,
                item,
              });
              setFeedback(undefined);
              setDrawer(desktop ? null : 'detail');
            }}
          />
        ) : (
          <>
            {status}
            {detail}
          </>
        )}
      </InkDetailDrawer>
    </>
  );
}
