import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import {
  getManualSlotCount,
  manualSlot,
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
  const [params] = useSearchParams();
  const [view, setView] = useState<ManualView>();
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [confirmation, setConfirmation] = useState<ManualAction>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
        if (!controller.signal.aborted) setView(data);
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
        setNotice(
          {
            learn: '功法已习得。',
            unlock: '瓶颈已突破，可以继续修炼。',
            train: '功法精进一层。',
            activate: '功法已激活，下一场战斗生效。',
          }[action.action],
        );
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : '操作失败，请刷新核对');
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        setConfirmation(undefined);
        setView(undefined);
        setRefresh((n) => n + 1);
      }
    }
  }

  const hintedItem = view?.items.find(
    (item) => item.id === params.get('itemId'),
  );
  const hintedManual =
    hintedItem && itemDefinition(hintedItem.definitionId).manualId;
  const manual = CHARACTER_MANUALS_V1.find(
    (m) => m.id === (selected ?? hintedManual),
  );
  const learned = view?.state?.learned.find((m) => m.manualId === manual?.id);
  const rule = manual && manualRule(manual);
  const jade =
    manual &&
    view?.items.find(
      (item) => itemDefinition(item.definitionId).manualId === manual.id,
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

  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-4 text-sm">
        {error ? (
          <p role="alert" className="text-crimson">
            {error}{' '}
            <button onClick={() => setRefresh((n) => n + 1)}>刷新重试</button>
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        {!view ? (
          <p>正在翻阅功法……</p>
        ) : (
          <>
            {view.blockedReason ? (
              <p role="status">{view.blockedReason}</p>
            ) : null}
            {MANUAL_REALMS.map((realm, index) => {
              const entry = view.state?.build.slots.find(
                (s) => s.slot === index + 1,
              );
              const current = CHARACTER_MANUALS_V1.find(
                (m) => m.id === entry?.manualId,
              );
              const currentLevel = view.state?.learned.find(
                (m) => m.manualId === entry?.manualId,
              )?.level;
              return (
                <section
                  key={realm}
                  className="border-ink/10 space-y-3 border-b pb-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{realm}功法</h3>
                    <span className="text-ink-secondary text-xs">
                      {index >= unlocked
                        ? realm + '开放'
                        : current
                          ? current.name + ' · ' + currentLevel + '层'
                          : '尚未激活'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {CHARACTER_MANUALS_V1.filter((m) => m.realm === realm).map(
                      (m) => {
                        const progress = view.state?.learned.find(
                          (p) => p.manualId === m.id,
                        );
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelected(m.id);
                              setConfirmation(undefined);
                            }}
                            className="hover:bg-ink/5 rounded px-3 py-2 text-left"
                          >
                            <span className="block">
                              {m.name}
                              {m.rarity === 'rare' ? ' · 珍稀' : ''}
                            </span>
                            <span className="text-ink-secondary block text-xs">
                              {progress ? progress.level + '层' : '未习得'}
                              {entry?.manualId === m.id ? ' · 已激活' : ''}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
      <InkDetailDrawer
        isOpen={!!manual}
        onClose={() => {
          setSelected('');
          setConfirmation(undefined);
        }}
        title={manual?.name ?? '功法'}
      >
        {manual && view && rule ? (
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
                {view.items
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
            {learned?.level === rule.maxLevel ? (
              <p>功法已圆满</p>
            ) : (
              <>
                {nextKind === 'unlock' ? (
                  <p>已遇瓶颈，需一本同名玉简解锁后续层数。</p>
                ) : null}
                <InkButton
                  disabled={!canAct || !preview?.ok}
                  onClick={() => setConfirmation(next)}
                >
                  {nextKind === 'learn'
                    ? '学习功法'
                    : nextKind === 'unlock'
                      ? '突破瓶颈'
                      : '修炼下一层'}
                </InkButton>
                {!preview?.ok ? (
                  <p className="text-ink-secondary">
                    {preview?.diagnostics.map((d) => d.message).join('；') ??
                      '需要一本同名玉简'}
                  </p>
                ) : null}
              </>
            )}
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
                    disabled={pending}
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
