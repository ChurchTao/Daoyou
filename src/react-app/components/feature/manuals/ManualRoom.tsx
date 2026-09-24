import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import { manualAttributeValue } from '@shared/engine/combat-v6/manuals/attributes';
import {
  getManualSlotCount,
  MAX_MANUALS_PER_SLOT,
} from '@shared/engine/combat-v6/manuals/compiler';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import { MANUAL_REALMS } from '@shared/engine/combat-v6/manuals/pack';
import type { CharacterManualDefV1 } from '@shared/engine/combat-v6/manuals/types';
import { itemDefinition } from '@shared/inventory';
import { CHARACTER_ATTRIBUTE_LABELS } from '@shared/lib/characterAttributeLabels';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { combatV6Request, mutationBody } from '../combat-v6/request';
import { ManualDetail } from './ManualDetail';
import { ManualJadePicker } from './ManualJadePicker';
import { ManualRealmSlot } from './ManualRealmSlot';
import { manualMechanismSummary } from './manualPresentation';

const endpoint = '/api/combat-v6/manuals';
const desktopQuery = '(min-width: 1024px)';
const subscribeViewport = (notify: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;
type Realm = CharacterManualDefV1['realm'];

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
    realm: Realm;
    manualId?: string;
    item?: { id: string; revision: number };
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
        await fetch(endpoint, {
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
              realm: CHARACTER_MANUALS_V1.find((m) => m.id === action.manualId)!
                .realm,
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
  const realm = selection?.realm ?? hintedManual?.realm ?? MANUAL_REALMS[0];
  const unlocked = view ? getManualSlotCount(view.realm) : 0;
  const realmOpen = MANUAL_REALMS.indexOf(realm) < unlocked;
  const learnedManuals = CHARACTER_MANUALS_V1.filter(
    (m) =>
      m.realm === realm &&
      view?.state?.learned.some((p) => p.manualId === m.id),
  );
  const currentManual = learnedManuals.find((m) =>
    view?.state?.build.slots.some((s) => s.manualId === m.id),
  );
  const manual = CHARACTER_MANUALS_V1.find(
    (m) =>
      m.id ===
      (selection?.manualId ??
        (!selection ? hintedManual?.id : undefined) ??
        currentManual?.id ??
        learnedManuals[0]?.id),
  );
  const itemChoice =
    selection?.item ??
    (!selection && hintedItem
      ? { id: hintedItem.id, revision: hintedItem.revision }
      : undefined);
  const choose = (m: CharacterManualDefV1) => {
    setSelection({ realm: m.realm, manualId: m.id });
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
        key={manual.id}
        manual={manual}
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
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-7">
            <section
              aria-label="当前所修功法"
              className="relative grid grid-cols-2 gap-2 lg:sticky lg:top-3 lg:min-h-[32rem] lg:grid-cols-[6.5rem_minmax(0,1fr)_6.5rem] lg:grid-rows-2 lg:items-center lg:gap-y-12 lg:py-12"
            >
              {gender ? (
                <GameImage
                  src={`/assets/manuals/cultivator-${gender === '女' ? 'female' : 'male'}-meditation.webp`}
                  alt=""
                  width={960}
                  height={960}
                  draggable={false}
                  className="pointer-events-none absolute inset-0 hidden h-full w-full object-contain select-none lg:block"
                />
              ) : null}
              {MANUAL_REALMS.map((slotRealm, index) => {
                const activeManual = CHARACTER_MANUALS_V1.find(
                  (m) =>
                    m.realm === slotRealm &&
                    view.state?.build.slots.some((s) => s.manualId === m.id),
                );
                const progress = view.state?.learned.find(
                  (p) => p.manualId === activeManual?.id,
                );
                return (
                  <div
                    key={slotRealm}
                    className={`relative ${index === 0 ? 'lg:col-start-1 lg:row-start-1' : index === 1 ? 'lg:col-start-1 lg:row-start-2' : index === 2 ? 'lg:col-start-3 lg:row-start-1' : 'lg:col-start-3 lg:row-start-2'} ${feedback?.manualId === activeManual?.id ? 'motion-safe:animate-pulse' : ''}`}
                  >
                    <ManualRealmSlot
                      realm={slotRealm}
                      manual={activeManual}
                      progress={progress}
                      unlocked={index < unlocked}
                      selected={realm === slotRealm}
                      onSelect={() => {
                        if (pending) return;
                        setSelection({
                          realm: slotRealm,
                          manualId: activeManual?.id,
                        });
                        setFeedback(undefined);
                        setDrawer(
                          !activeManual &&
                            !view.state?.learned.some((p) =>
                              CHARACTER_MANUALS_V1.some(
                                (m) =>
                                  m.id === p.manualId && m.realm === slotRealm,
                              ),
                            )
                            ? 'picker'
                            : null,
                        );
                      }}
                    />
                  </div>
                );
              })}
            </section>
            <section
              aria-label={`${realm}功法书目`}
              className="lg:border-ink/15 min-w-0 lg:border-l lg:pl-7"
            >
              <header className="mb-3 flex min-h-11 items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-medium">{realm}</h3>
                  <span className="text-ink-secondary font-mono text-xs">
                    {learnedManuals.length}/{MAX_MANUALS_PER_SLOT}
                  </span>
                </div>
                {learnedManuals.length < MAX_MANUALS_PER_SLOT ? (
                  <InkButton
                    disabled={
                      pending ||
                      !realmOpen ||
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {learnedManuals.map((m) => {
                    const progress = view.state!.learned.find(
                      (p) => p.manualId === m.id,
                    )!;
                    const active = currentManual?.id === m.id;
                    const effect = m.effects[0];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-label={`预览${m.name}`}
                        aria-pressed={manual?.id === m.id}
                        disabled={pending}
                        onClick={() => choose(m)}
                        className={`relative min-h-20 border px-2 py-2 text-left transition-colors disabled:opacity-60 ${manual?.id === m.id ? 'border-ink/50 bg-ink/5' : 'border-ink/15 hover:border-ink/40'}`}
                      >
                        <span className="block pr-3 text-sm font-medium">
                          {m.name}
                        </span>
                        {active ? (
                          <span
                            className="text-crimson absolute top-2 right-1 text-[10px]"
                            aria-label="当前生效"
                          >
                            修
                          </span>
                        ) : null}
                        <span className="text-ink-secondary mt-1 block text-xs">
                          <span className="font-mono">{progress.level}</span> 层
                          ·{' '}
                          {progress.level === 9
                            ? '圆满'
                            : manualMechanismSummary(m, progress.level).tag}
                        </span>
                        <span className="mt-1 block text-xs">
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
                  <p>{realmOpen ? '此境界尚未习得功法' : `${realm}期开放`}</p>
                  <p className="mt-2 text-xs">
                    {realmOpen
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
        title={drawer === 'picker' ? '储物袋 · 功法玉简' : '参悟功法'}
        size="md"
      >
        {notices}
        {drawer === 'picker' && view ? (
          <ManualJadePicker
            view={view}
            realm={realm}
            disabled={pending || !!view.blockedReason}
            onChoose={(action) => {
              const chosen = CHARACTER_MANUALS_V1.find(
                (m) => m.id === action.manualId,
              )!;
              setSelection({
                realm: chosen.realm,
                manualId: chosen.id,
                item: 'item' in action ? action.item : undefined,
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
