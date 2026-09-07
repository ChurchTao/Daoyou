import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { VaultView } from '@shared/contracts/forging';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';

export function VaultWithdrawal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <InkButton onClick={() => setOpen(true)}>取出铸造材料</InkButton>
      {open ? <WithdrawalDrawer close={() => setOpen(false)} /> : null}
    </>
  );
}
function WithdrawalDrawer({ close }: { close: () => void }) {
  const [view, setView] = useState<VaultView>();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<VaultView>(
      `/api/combat-v6/forging/vault?${new URLSearchParams({ page: String(page), search })}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setView(data);
          setPage(data.page);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [page, search, refresh]);
  const item = view?.items.find((i) => i.id === selected);
  async function withdraw() {
    if (busy.current || !item) return;
    busy.current = true;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await consumeResourceMutation(
        await fetch('/api/combat-v6/forging/vault/withdraw', {
          ...mutationBody({
            id: item.id,
            quantity,
            expectedQuantity: item.quantity,
          }),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      if (alive.current) {
        setNotice(`已取出 ${item.name} ×${quantity}，放入物品栏。`);
        setSelected(undefined);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : '请求失败，请核对物品栏');
    } finally {
      busy.current = false;
      if (alive.current) {
        setPending(false);
        setRefresh((n) => n + 1);
      }
    }
  }
  return (
    <InkDetailDrawer
      isOpen
      title="宝库 · 材料取出"
      onClose={() => {
        if (!pending) close();
      }}
      size="sm"
    >
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
        {item ? (
          <>
            <p>
              {item.name} · {item.rank} · 持有 {item.quantity}
            </p>
            <p>{item.description}</p>
            <label>
              取出数量
              <input
                aria-label="取出数量"
                type="number"
                min={1}
                max={Math.min(item.quantity, 3960)}
                value={quantity}
                disabled={pending}
                className="border-ink/20 ml-3 w-20 border bg-transparent p-2"
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <p>取出后进入物品栏；再次存入时进入新储藏室。</p>
            <div className="flex gap-3">
              <InkButton
                disabled={pending}
                onClick={() => setSelected(undefined)}
              >
                返回
              </InkButton>
              <InkButton
                pending={pending}
                disabled={
                  !Number.isInteger(quantity) ||
                  quantity < 1 ||
                  quantity > Math.min(item.quantity, 3960)
                }
                onClick={() => void withdraw()}
              >
                确认取出
              </InkButton>
            </div>
          </>
        ) : (
          <>
            <input
              aria-label="搜索宝库材料"
              placeholder="搜索材料"
              className="border-ink/20 w-full border-b bg-transparent p-2"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
                setView(undefined);
              }}
            />
            {!view ? (
              <p>正在查看材料……</p>
            ) : (
              view.items.map((m) => (
                <button
                  key={m.id}
                  className="border-ink/10 flex w-full items-center justify-between gap-2 border-b py-3 text-left"
                  onClick={() => {
                    setSelected(m.id);
                    setQuantity(1);
                    setError('');
                  }}
                >
                  <span>
                    {m.name}
                    <span className="text-ink-secondary block">
                      {m.rank} · {MATERIAL_TYPE_NAMES[m.type]}
                    </span>
                  </span>
                  <span>×{m.quantity}</span>
                </button>
              ))
            )}
            {view?.total === 0 ? <p>暂无可取出的铸造材料。</p> : null}
            {view ? (
              <div className="flex items-center justify-between">
                <InkButton
                  disabled={view.page === 0}
                  onClick={() => {
                    setPage(view.page - 1);
                    setView(undefined);
                  }}
                >
                  上一页
                </InkButton>
                <span>
                  {view.page + 1} / {Math.max(1, Math.ceil(view.total / 40))}
                </span>
                <InkButton
                  disabled={(view.page + 1) * 40 >= view.total}
                  onClick={() => {
                    setPage(view.page + 1);
                    setView(undefined);
                  }}
                >
                  下一页
                </InkButton>
              </div>
            ) : null}
          </>
        )}
      </div>
    </InkDetailDrawer>
  );
}
