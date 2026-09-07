import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import { getManualSlotCount } from '@shared/engine/combat-v6/manuals/compiler';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import type { ManualSlotV1 } from '@shared/engine/combat-v6/manuals/types';
import { itemDefinition, type InventoryItem } from '@shared/inventory';
import { previewManualAction } from '@shared/manuals/action';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { combatV6Request, mutationBody } from '../combat-v6/request';

const endpoint = '/api/combat-v6/manuals';
const definitions = new Map(
  CHARACTER_MANUALS_V1.map((manual) => [manual.id, manual]),
);
const slots: ManualSlotV1[] = [1, 2, 3, 4, 5, 6];
const unlockRealms = ['炼气', '炼气', '筑基', '金丹', '元婴', '化神'];

export function ManualRoom() {
  const [params] = useSearchParams();
  const [view, setView] = useState<ManualView>();
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<ManualSlotV1>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const reader = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reader.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    reader.current = controller;
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
    setNotice('');
    reader.current?.abort();
    try {
      await consumeResourceMutation(
        await fetch(endpoint, {
          ...mutationBody(action),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      if (mounted.current)
        setNotice(
          action.action === 'forget'
            ? '道印已散去。'
            : '道印已铭刻，下一场战斗生效。',
        );
    } catch (e) {
      if (mounted.current)
        setError(
          `${e instanceof Error ? e.message : '请求失败'}；请核对道印与剩余玉简后操作。`,
        );
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        setSelected(undefined);
        setView(undefined);
        setRefresh((n) => n + 1);
      }
    }
  }
  const jade = view?.items.find((item) => item.id === params.get('itemId'));
  const available = view ? getManualSlotCount(view.realm) : 0;
  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-4 text-sm">
        {error ? (
          <p role="alert" className="text-crimson">
            {error}{' '}
            <button
              className="underline"
              disabled={pending}
              onClick={() => {
                setError('');
                setRefresh((n) => n + 1);
              }}
            >
              重新读取
            </button>
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        {!view ? (
          <p className="text-ink-secondary">正在查看道印……</p>
        ) : (
          <>
            {view.blockedReason ? (
              <p role="status">
                {view.blockedReason}{' '}
                <button
                  className="underline"
                  disabled={pending}
                  onClick={() => {
                    setView(undefined);
                    setSelected(undefined);
                    setRefresh((n) => n + 1);
                  }}
                >
                  刷新状态
                </button>
              </p>
            ) : null}
            {jade ? (
              <p>
                已选「{itemDefinition(jade.definitionId).name}」，请选择道印位。
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {slots.map((slot) => {
                const learned = view.state?.build.slots.find(
                  (entry) => entry.slot === slot,
                );
                const manual = learned
                  ? definitions.get(learned.manualId)
                  : undefined;
                return (
                  <button
                    key={slot}
                    disabled={slot > available || !view.state || pending}
                    onClick={() => setSelected(slot)}
                    className="border-ink/15 hover:bg-ink/5 min-w-0 space-y-2 rounded border p-4 text-left disabled:opacity-50"
                  >
                    <span className="text-ink-secondary block">
                      道印位 {slot}
                    </span>
                    <span className="block font-medium">
                      {slot > available
                        ? `${unlockRealms[slot - 1]}解锁`
                        : (manual?.name ?? '选择玉简参悟')}
                    </span>
                    {manual ? (
                      <span className="text-ink-secondary line-clamp-2 block">
                        {manual.description}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="text-ink-secondary">
              储物袋中玉简{' '}
              {view.items.reduce((n, item) => n + item.quantity, 0)} 本{' '}
              <InkTooltip label="道印规则">
                参悟和改修只消耗一本玉简，必定成功。真解可直接参悟；同源本篇原位升级。散功不返还，活动战斗期间不可调整。
              </InkTooltip>
            </p>
            {selected && view.state ? (
              <ManualDrawer
                key={`${selected}:${view.state.revision}`}
                view={view}
                slot={selected}
                initialItemId={jade?.id}
                pending={pending}
                close={() => {
                  if (!busy.current) setSelected(undefined);
                }}
                submit={submit}
              />
            ) : null}
          </>
        )}
      </div>
    </GameSceneFrame>
  );
}

function ManualDrawer({
  view,
  slot,
  initialItemId,
  pending,
  close,
  submit,
}: {
  view: ManualView;
  slot: ManualSlotV1;
  initialItemId?: string;
  pending: boolean;
  close: () => void;
  submit: (action: ManualAction) => Promise<void>;
}) {
  const [itemId, setItemId] = useState(initialItemId ?? '');
  const [forgetting, setForgetting] = useState(false);
  const state = view.state!;
  const learned = state.build.slots.find((entry) => entry.slot === slot);
  const current = learned ? definitions.get(learned.manualId) : undefined;
  const item = view.items.find((entry) => entry.id === itemId);
  const next = item
    ? definitions.get(itemDefinition(item.definitionId).manualId!)
    : undefined;
  const actionFor = (jade: InventoryItem): ManualAction => ({
    action: 'learn',
    slot,
    expectedRevision: state.revision,
    expectedManualId: learned?.manualId ?? null,
    item: { id: jade.id, revision: jade.revision },
  });
  const action: ManualAction | undefined =
    forgetting && learned
      ? {
          action: 'forget',
          slot,
          expectedRevision: state.revision,
          expectedManualId: learned.manualId,
        }
      : item
        ? actionFor(item)
        : undefined;
  const preview = action
    ? previewManualAction(state, view.realm, action, item)
    : undefined;
  const problem =
    view.blockedReason ??
    (preview && !preview.ok
      ? preview.diagnostics.map((d) => d.message).join('；')
      : null);
  const upgrade =
    current &&
    next &&
    current.lineageId === next.lineageId &&
    current.rank === 'base' &&
    next.rank === 'true';
  const label = forgetting
    ? '散功'
    : upgrade
      ? '升级真解'
      : current
        ? '改修'
        : '参悟';
  return (
    <InkDetailDrawer isOpen title={`道印位 ${slot}`} onClose={close} size="sm">
      <div className="space-y-4 text-sm">
        {current ? (
          <section className="space-y-2">
            <p className="font-medium">当前 · {current.name}</p>
            <p className="text-ink-secondary">{current.description}</p>
          </section>
        ) : (
          <p>此位尚未铭刻道印。</p>
        )}
        {forgetting ? (
          <p>散去「{current?.name}」，不返还玉简或资源，无法撤销。</p>
        ) : (
          <>
            <p className="text-ink-secondary">储物袋中的玉简</p>
            {!view.items.length ? (
              <p>暂无可用玉简，可通过野外战斗获取。储藏室中的玉简需先取出。</p>
            ) : (
              view.items.map((jade) => {
                const definition = itemDefinition(jade.definitionId);
                const manual = definitions.get(definition.manualId!)!;
                const result = previewManualAction(
                  state,
                  view.realm,
                  actionFor(jade),
                  jade,
                );
                return (
                  <div
                    key={jade.id}
                    className="border-ink/10 space-y-1 border-b pb-3"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        disabled={pending || !!view.blockedReason || !result.ok}
                        aria-pressed={itemId === jade.id}
                        className="text-left underline underline-offset-4 disabled:opacity-50"
                        onClick={() => setItemId(jade.id)}
                      >
                        {definition.name} ×{jade.quantity}
                      </button>
                      <InkTooltip label={`${manual.name}说明`}>
                        {manual.description}
                      </InkTooltip>
                    </div>
                    {!result.ok ? (
                      <p className="text-ink-secondary">
                        {result.diagnostics.map((d) => d.message).join('；')}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
            {next ? (
              <section className="space-y-2">
                <p className="font-medium">
                  {upgrade ? '升级为' : '铭刻'} · {next.name}
                </p>
                <p>{next.description}</p>
                <p>
                  消耗「{itemDefinition(item!.definitionId).name}」×1。
                  {current ? '当前道印将被替换，不返还。' : '必定成功。'}
                </p>
              </section>
            ) : null}
          </>
        )}
        {problem ? (
          <p role="alert" className="text-crimson">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {action ? (
            <InkButton
              pending={pending}
              disabled={!!problem || !preview?.ok}
              onClick={() => void submit(action)}
            >
              确认{label}
            </InkButton>
          ) : null}
          {current ? (
            <InkButton
              disabled={pending || !!view.blockedReason}
              onClick={() => {
                setForgetting(!forgetting);
                setItemId('');
              }}
            >
              {forgetting ? '返回改修' : '散功'}
            </InkButton>
          ) : null}
        </div>
      </div>
    </InkDetailDrawer>
  );
}
