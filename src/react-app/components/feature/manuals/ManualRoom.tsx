import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import {
  getManualSlotCount,
  manualSlot,
  MAX_MANUALS_PER_SLOT,
} from '@shared/engine/combat-v6/manuals/compiler';
import {
  CHARACTER_MANUALS_V1,
  manualRule,
} from '@shared/engine/combat-v6/manuals/content';
import { MANUAL_REALMS } from '@shared/engine/combat-v6/manuals/pack';
import type { CharacterManualDefV1 } from '@shared/engine/combat-v6/manuals/types';
import { itemDefinition } from '@shared/inventory';
import { previewManualAction } from '@shared/manuals/action';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { combatV6Request, mutationBody } from '../combat-v6/request';
import { ManualJadePicker } from './ManualJadePicker';
import { ManualRealmSlot } from './ManualRealmSlot';

const endpoint = '/api/combat-v6/manuals';
const labels = {
  vitality: '体魄',
  strength: '力量',
  spirit: '精神',
  endurance: '耐力',
  speed: '速度',
  willpower: '意志',
};
function effects(manual: CharacterManualDefV1, level: number) {
  return manual.effects
    .map((e) => labels[e.attribute] + ' +' + e.valuePerLevel * level)
    .join(' · ');
}

export function ManualRoom() {
  const { pushToast } = useInkUI();
  const identity = useCultivatorIdentity();
  const gender = identity.data?.cultivator?.gender;
  const bag = useInventoryBag();
  const items = bag.data?.items ?? [];
  const [params] = useSearchParams();
  const [view, setView] = useState<ManualView>();
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [selectedJadeId, setSelectedJadeId] = useState<string>();
  const [picking, setPicking] = useState<{
    realm: CharacterManualDefV1['realm'];
    manualId?: string;
  }>();
  const [confirmation, setConfirmation] = useState<ManualAction>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
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

  async function submit(action: ManualAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await consumeResourceMutation(
        await fetch(endpoint, {
          ...mutationBody(action),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      if (mounted.current)
        pushToast({
          message: {
            learn: '功法已习得。',
            unlock: '瓶颈已突破，可以继续修炼。',
            train: '功法精进一层。',
            activate: '功法已激活，下一场战斗生效。',
          }[action.action],
          tone: 'success',
        });
    } catch (e) {
      if ('item' in action) bag.invalidate();
      if (mounted.current)
        setError(e instanceof Error ? e.message : '操作失败，请刷新核对');
    } finally {
      try {
        const data = await combatV6Request<ManualView>(endpoint);
        if (mounted.current) setView(data);
      } catch {
        if (mounted.current) {
          setView(undefined);
          setError('功法状态读取失败，请刷新核对后继续');
        }
      }
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        setConfirmation(undefined);
        setSelectedJadeId(undefined);
      }
    }
  }

  const hintedItem = items.find((item) => item.id === params.get('itemId'));
  const hintedManual =
    hintedItem && itemDefinition(hintedItem.definitionId).manualId;
  const manual = CHARACTER_MANUALS_V1.find(
    (m) => m.id === (selected ?? hintedManual),
  );
  const learned = view?.state?.learned.find((m) => m.manualId === manual?.id);
  const rule = manual && manualRule(manual);
  const jade =
    manual &&
    items.find(
      (item) =>
        item.id ===
          (selectedJadeId ??
            (selected === undefined ? hintedItem?.id : undefined)) &&
        itemDefinition(item.definitionId).manualId === manual.id,
    );
  const unlocked = view ? getManualSlotCount(view.realm) : 0;
  const active = view?.state?.build.slots.some(
    (s) => s.manualId === manual?.id,
  );
  const canAct =
    !!view?.state &&
    !view.blockedReason &&
    !pending &&
    !!manual &&
    manualSlot(manual) <= unlocked;
  function action(kind: ManualAction['action']): ManualAction | undefined {
    if (!view?.state || !manual) return;
    const target = {
      expectedRevision: view.state.revision,
      slot: manualSlot(manual),
      manualId: manual.id,
    };
    if (kind === 'learn' || kind === 'unlock')
      return jade
        ? {
            ...target,
            action: kind,
            item: { id: jade.id, revision: jade.revision },
          }
        : undefined;
    return { ...target, action: kind };
  }
  const nextKind = !learned
    ? 'learn'
    : learned.level === learned.unlockedLevel &&
        learned.level !== rule?.maxLevel
      ? 'unlock'
      : 'train';
  const next = action(nextKind);
  const preview =
    view?.state && next
      ? previewManualAction(
          view.state,
          view.realm,
          next,
          view.resources,
          jade || undefined,
        )
      : undefined;
  const confirmed =
    view?.state && confirmation
      ? previewManualAction(
          view.state,
          view.realm,
          confirmation,
          view.resources,
          jade || undefined,
        )
      : undefined;
  const cap = view?.resources.experienceCap ?? 1;
  const learnedInRealm =
    view?.state?.learned.filter((entry) =>
      CHARACTER_MANUALS_V1.some(
        (definition) =>
          definition.id === entry.manualId &&
          definition.realm === manual?.realm,
      ),
    ).length ?? 0;
  const closeDrawer = () => {
    setSelected('');
    setPicking(undefined);
    setSelectedJadeId(undefined);
    setConfirmation(undefined);
  };
  function openPicker(realm: CharacterManualDefV1['realm'], manualId?: string) {
    setPicking({ realm, manualId });
    setConfirmation(undefined);
    setSelectedJadeId(undefined);
  }

  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-4 text-sm" aria-busy={pending}>
        {error && !manual && !picking ? (
          <p role="alert" className="text-crimson">
            {error}{' '}
            <button onClick={() => setRefresh((n) => n + 1)}>刷新重试</button>
          </p>
        ) : null}
        {!view ? (
          <p>正在翻阅功法……</p>
        ) : (
          <>
            {view.blockedReason ? (
              <p role="status">{view.blockedReason}</p>
            ) : null}
            <div className="grid grid-cols-1 items-center gap-6 py-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-8">
              <div className="mx-auto w-full max-w-64 min-w-0 self-center sm:max-w-80 md:max-w-none">
                {gender ? (
                  <img
                    src={`/assets/manuals/cultivator-${gender === '女' ? 'female' : 'male'}-meditation.webp`}
                    alt={`${gender}修盘膝入定墨像`}
                    width={960}
                    height={960}
                    className="h-auto w-full select-none"
                    draggable={false}
                  />
                ) : null}
              </div>
              <div className="border-ink/15 min-w-0 border-l">
                {MANUAL_REALMS.map((realm, index) => (
                  <ManualRealmSlot
                    key={realm}
                    realm={realm}
                    manuals={CHARACTER_MANUALS_V1.filter(
                      (definition) =>
                        definition.realm === realm &&
                        view.state?.learned.some(
                          (entry) => entry.manualId === definition.id,
                        ),
                    )}
                    state={view.state}
                    unlocked={index < unlocked}
                    disabled={pending || !!view.blockedReason || !view.state}
                    onLearn={() => openPicker(realm)}
                    onStudy={(definition) => {
                      setSelected(definition.id);
                      setSelectedJadeId(undefined);
                      setConfirmation(undefined);
                    }}
                    onActivate={(definition) => {
                      if (view.state)
                        void submit({
                          action: 'activate',
                          expectedRevision: view.state.revision,
                          manualId: definition.id,
                          slot: manualSlot(definition),
                        });
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <InkDetailDrawer
        isOpen={!!manual || !!picking}
        onClose={closeDrawer}
        title={picking ? '储物袋 · 功法玉简' : (manual?.name ?? '功法')}
        size="md"
      >
        {error ? (
          <p role="alert" className="text-crimson mb-4">
            {error}{' '}
            <InkButton
              disabled={pending}
              onClick={() => setRefresh((n) => n + 1)}
            >
              刷新重试
            </InkButton>
          </p>
        ) : null}
        {view?.blockedReason ? (
          <p role="status" className="mb-4 text-sm">
            {view.blockedReason}
          </p>
        ) : null}
        {picking && view ? (
          <ManualJadePicker
            view={view}
            realm={picking.realm}
            manualId={picking.manualId}
            disabled={pending || !!view.blockedReason}
            onChoose={(chosen) => {
              setSelected(chosen.manualId);
              if ('item' in chosen) setSelectedJadeId(chosen.item.id);
              setConfirmation(chosen);
              setPicking(undefined);
            }}
          />
        ) : manual && view && rule ? (
          <div className="space-y-4 text-sm">
            <p>{manual.description}</p>
            <p>
              {manual.realm} · {manual.rarity === 'rare' ? '珍稀' : '常见'} ·{' '}
              {learned ? learned.level + '/' + rule.maxLevel + '层' : '未习得'}
            </p>
            <p className="font-mono">{effects(manual, learned?.level ?? 1)}</p>
            <p className="text-ink-secondary">
              {learned ? '圆满效果：' : '一层即可获得上述效果；圆满效果：'}
              <span className="font-mono">
                {effects(manual, rule.maxLevel)}
              </span>
            </p>
            <p>
              持有同名玉简{' '}
              <span className="font-mono">
                {items
                  .filter(
                    (i) =>
                      itemDefinition(i.definitionId).manualId === manual.id,
                  )
                  .reduce((n, i) => n + i.quantity, 0)}
              </span>{' '}
              本
            </p>
            {learned && !active ? (
              <InkButton
                disabled={!canAct}
                onClick={() => {
                  const a = action('activate');
                  if (a) void submit(a);
                }}
              >
                免费激活
              </InkButton>
            ) : null}
            {!learned ? (
              <p className="text-ink-secondary">
                此境界已学{' '}
                <span className="font-mono">
                  {learnedInRealm}/{MAX_MANUALS_PER_SLOT}
                </span>{' '}
                种。最多学习三种，暂不支持遗忘或替换，请谨慎选择。
              </p>
            ) : null}
            {learned?.level === rule.maxLevel ? (
              <p>功法已圆满</p>
            ) : (
              <>
                {nextKind === 'unlock' ? (
                  <p>已遇瓶颈，需一本同名玉简解锁后续层数。</p>
                ) : null}
                {!confirmation ? (
                  <InkButton
                    disabled={
                      !canAct ||
                      (nextKind === 'train'
                        ? !preview?.ok
                        : nextKind === 'learn' &&
                          learnedInRealm >= MAX_MANUALS_PER_SLOT)
                    }
                    onClick={() => {
                      if (nextKind === 'train') setConfirmation(next);
                      else if (jade && next && preview?.ok)
                        setConfirmation(next);
                      else
                        openPicker(
                          manual.realm,
                          nextKind === 'unlock' ? manual.id : undefined,
                        );
                    }}
                  >
                    {nextKind === 'learn'
                      ? '学习功法'
                      : nextKind === 'unlock'
                        ? '突破瓶颈'
                        : '修炼下一层'}
                  </InkButton>
                ) : null}
                {nextKind === 'learn' &&
                learnedInRealm >= MAX_MANUALS_PER_SLOT ? (
                  <p>该境界位已学满三种功法，不能继续学习新的功法。</p>
                ) : null}
                {nextKind === 'train' && !preview?.ok ? (
                  <p className="text-ink-secondary">
                    {preview?.diagnostics.map((d) => d.message).join('；') ??
                      '需要一本同名玉简'}
                  </p>
                ) : null}
              </>
            )}
            {confirmation && confirmed && !confirmed.ok ? (
              <p role="alert">
                {confirmed.diagnostics.map((d) => d.message).join('；')}
              </p>
            ) : null}
            {confirmation && confirmed?.ok ? (
              <div className="border-ink/10 space-y-3 border-t pt-4">
                {confirmation.action === 'train' ? (
                  <>
                    <p>
                      升至{' '}
                      <span className="font-mono">
                        {(learned?.level ?? 0) + 1}
                      </span>{' '}
                      层：
                      <span className="font-mono">
                        {effects(manual, (learned?.level ?? 0) + 1)}
                      </span>
                    </p>
                    <p>
                      消耗修为{' '}
                      <span className="font-mono">
                        {confirmed.cost.experience}
                      </span>
                      ，道心感悟{' '}
                      <span className="font-mono">
                        {confirmed.cost.insight}
                      </span>
                      。
                    </p>
                    <p>
                      剩余修为{' '}
                      <span className="font-mono">
                        {view.resources.experience - confirmed.cost.experience}
                      </span>
                      ，境界进度{' '}
                      <span className="font-mono">
                        {Math.min(
                          100,
                          ((view.resources.experience -
                            confirmed.cost.experience) /
                            cap) *
                            100,
                        ).toFixed(1)}
                        %
                      </span>
                      ；剩余感悟{' '}
                      <span className="font-mono">
                        {view.resources.insight - confirmed.cost.insight}
                      </span>
                      。
                    </p>
                  </>
                ) : (
                  <p>
                    消耗一本《{manual.name}》玉简
                    {confirmation.action === 'unlock'
                      ? '，解锁后仍需修炼升层'
                      : ''}
                    。
                  </p>
                )}
                <div className="flex gap-3">
                  <InkButton
                    disabled={
                      !canAct ||
                      ('item' in confirmation &&
                        (bag.isRefreshing || !!bag.error || !bag.data))
                    }
                    onClick={() => void submit(confirmation)}
                  >
                    确认
                    {confirmation.action === 'train'
                      ? '修炼'
                      : confirmation.action === 'learn'
                        ? '学习'
                        : '突破'}
                  </InkButton>
                  <InkButton
                    disabled={pending}
                    onClick={() => setConfirmation(undefined)}
                  >
                    取消
                  </InkButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </InkDetailDrawer>
    </GameSceneFrame>
  );
}
