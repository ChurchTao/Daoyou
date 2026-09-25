import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type { VaultView } from '@shared/contracts/forging';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';

export function VaultWithdrawal({
  onChanged,
}: { onChanged?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <InkButton onClick={() => setOpen(true)}>从洞府宝库取出</InkButton>
      <InkDetailDrawer
        isOpen={open}
        title="洞府宝库 · 取出物品"
        onClose={() => setOpen(false)}
        size="sm"
      >
        {open ? <VaultWithdrawalList onChanged={onChanged} /> : null}
      </InkDetailDrawer>
    </>
  );
}

/** Historical facts stay in a text list; only withdrawn items enter the shared grid. */
export function VaultWithdrawalList({
  onChanged,
}: { onChanged?: () => void } = {}) {
  const owner = usePlayerSession().data?.activeCultivator?.id;
  return <VaultList key={owner} onChanged={onChanged} />;
}

function VaultList({ onChanged }: { onChanged?: () => void }) {
  const [view, setView] = useState<VaultView>();
  const [kind, setKind] = useState<'material' | 'consumable'>('material');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const alive = useRef(true);
  const { pushToast } = useInkUI();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<VaultView>(
      `/api/combat-v6/forging/vault?${new URLSearchParams({ page: String(page), search, kind })}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setView(data);
          setPage(data.page);
          setError('');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [page, search, kind, refresh]);
  async function withdraw(items: VaultView['items']) {
    if (busy.current || items.length === 0) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await consumeResourceMutation<{ stored: boolean }>(
        await fetch(
          items.length === 1
            ? '/api/combat-v6/forging/vault/withdraw'
            : '/api/combat-v6/forging/vault/withdraw-page',
          mutationBody(
            items.length === 1
              ? {
                  id: items[0].id,
                  kind: items[0].kind,
                  expectedQuantity: items[0].quantity,
                }
              : {
                  items: items.map((item) => ({
                    id: item.id,
                    kind: item.kind,
                    expectedQuantity: item.quantity,
                  })),
                },
          ),
        ),
      );
      if (!alive.current) return;
      pushToast({
        message:
          items.length === 1
            ? `已取出 ${items[0].name} ×${items[0].quantity}${result.stored ? '，背包放不下的部分已存入储藏室' : ''}`
            : `已取出本页 ${items.length} 种物品${result.stored ? '，背包放不下的部分已存入储藏室' : ''}`,
        tone: 'success',
      });
      onChanged?.();
    } catch (e) {
      if (alive.current)
        pushToast({
          message: e instanceof Error ? e.message : '取出失败，请重新核对',
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (alive.current) {
        setPending(false);
        setView(undefined);
        setRefresh((n) => n + 1);
      }
    }
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="宝库物品类型"
          value={kind}
          disabled={pending}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setPage(0);
            setView(undefined);
          }}
        >
          <option value="material">材料与灵种</option>
          <option value="consumable">丹药与消耗品</option>
        </select>
        <input
          aria-label="搜索宝库物品"
          placeholder="搜索宝库物品"
          value={search}
          disabled={pending}
          className="border-ink/20 min-w-0 flex-1 border-b bg-transparent p-2"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
            setView(undefined);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="text-crimson">
          {error}{' '}
          <InkButton
            disabled={pending}
            onClick={() => {
              setView(undefined);
              setRefresh((n) => n + 1);
            }}
          >
            重新读取
          </InkButton>
        </p>
      ) : null}
      {!view && !error ? <p role="status">正在读取宝库……</p> : null}
      {view?.total === 0 ? (
        <p className="text-ink-secondary">暂无物品。</p>
      ) : null}
      {view && view.items.some((item) => !item.unavailableReason) ? (
        <InkButton
          disabled={pending}
          pending={pending}
          onClick={() =>
            void withdraw(view.items.filter((item) => !item.unavailableReason))
          }
        >
          取出本页
        </InkButton>
      ) : null}
      <div className="divide-ink/10 divide-y">
        {view?.items.map((item) => (
          <div key={item.id} className="space-y-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words">
                  {item.name}{' '}
                  <span className="font-mono">×{item.quantity}</span>
                </p>
                <p className="text-ink-secondary">
                  {item.rank} ·{' '}
                  {item.type === 'seed'
                    ? '灵种'
                    : (MATERIAL_TYPE_NAMES[
                        item.type as keyof typeof MATERIAL_TYPE_NAMES
                      ] ?? item.type)}
                </p>
              </div>
              <InkButton
                disabled={pending || !!item.unavailableReason}
                onClick={() => void withdraw([item])}
              >
                全部取出
              </InkButton>
            </div>
            {item.description ? (
              <p className="text-ink-secondary break-words whitespace-pre-line">
                {item.description}
              </p>
            ) : null}
            {item.unavailableReason ? (
              <p className="text-ink-secondary">{item.unavailableReason}</p>
            ) : null}
          </div>
        ))}
      </div>
      {view && view.total > 40 ? (
        <div className="flex items-center justify-between">
          <InkButton
            disabled={pending || view.page === 0}
            onClick={() => {
              setPage(view.page - 1);
              setView(undefined);
            }}
          >
            上一页
          </InkButton>
          <span className="font-mono">
            {view.page + 1} / {Math.ceil(view.total / 40)}
          </span>
          <InkButton
            disabled={pending || (view.page + 1) * 40 >= view.total}
            onClick={() => {
              setPage(view.page + 1);
              setView(undefined);
            }}
          >
            下一页
          </InkButton>
        </div>
      ) : null}
    </div>
  );
}
