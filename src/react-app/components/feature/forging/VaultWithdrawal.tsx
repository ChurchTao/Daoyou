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
  const [selected, setSelected] = useState<string>();
  const [quantity, setQuantity] = useState(1);
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
  async function withdraw(item: VaultView['items'][number]) {
    if (busy.current || item.unavailableReason) return;
    busy.current = true;
    setPending(true);
    try {
      await consumeResourceMutation(
        await fetch(
          '/api/combat-v6/forging/vault/withdraw',
          mutationBody({
            id: item.id,
            kind: item.kind,
            quantity,
            expectedQuantity: item.quantity,
          }),
        ),
      );
      if (!alive.current) return;
      pushToast({
        message: `已取出 ${item.name} ×${quantity}`,
        tone: 'success',
      });
      setSelected(undefined);
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
            setSelected(undefined);
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
            setSelected(undefined);
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
                onClick={() => {
                  setSelected(selected === item.id ? undefined : item.id);
                  setQuantity(1);
                }}
              >
                取出
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
            {selected === item.id && !item.unavailableReason ? (
              <div className="flex flex-wrap items-center gap-3">
                <label>
                  取出数量{' '}
                  <input
                    aria-label="取出数量"
                    type="number"
                    min={1}
                    max={Math.min(item.quantity, 3960)}
                    value={quantity}
                    disabled={pending}
                    className="border-ink/20 w-20 border bg-transparent p-2 font-mono"
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </label>
                <InkButton
                  pending={pending}
                  disabled={
                    pending ||
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    quantity > Math.min(item.quantity, 3960)
                  }
                  onClick={() => void withdraw(item)}
                >
                  确认取出
                </InkButton>
                <InkButton
                  disabled={pending}
                  onClick={() => setSelected(undefined)}
                >
                  取消
                </InkButton>
              </div>
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
              setSelected(undefined);
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
              setSelected(undefined);
            }}
          >
            下一页
          </InkButton>
        </div>
      ) : null}
    </div>
  );
}
