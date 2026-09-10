import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { InkButton, InkInput, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { InventoryView } from '@shared/contracts/inventory';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SendWorldChatShowcaseInput } from './worldChatFeedContext';

export function WorldChatShowcaseDialog({
  channelName,
  posting,
  send,
  onClose,
}: {
  channelName: string;
  posting: boolean;
  send(input: SendWorldChatShowcaseInput): Promise<boolean>;
  onClose(): void;
}) {
  const [bag, setBag] = useState<InventoryView>();
  const [selected, setSelected] = useState<InventoryView['items'][number]>();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [bagOpen, setBagOpen] = useState(false);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setSelected(undefined);
    try {
      const response = await fetch('/api/combat-v6/inventory?location=bag');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '读取失败');
      setBag(result.data);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const busy = posting || loading;
  function choose(item: InventoryView['items'][number]) {
    if (busy || pending.current) return;
    setSelected(item);
    setBagOpen(false);
  }
  async function submit() {
    if (!selected || busy || pending.current) return;
    pending.current = true;
    try {
      const sent = await send({
        itemId: selected.id,
        revision: selected.revision,
        textContent: text.trim() || undefined,
      });
      if (sent) onClose();
    } finally {
      pending.current = false;
    }
  }
  const inventory = (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>
          随身物品 <span className="font-mono">{bag?.used ?? '—'} / 40</span>
        </span>
        <InkButton disabled={busy} onClick={() => void refresh()}>
          刷新选物
        </InkButton>
      </div>
      <InventoryItems
        items={bag?.items ?? []}
        className="grid-cols-5 gap-1 sm:grid-cols-5"
        slotProps={(item) => ({
          disabled: !item || busy,
          selected: !!item && selected?.id === item.id,
          onQuickAction: item ? () => choose(item) : undefined,
          children: item
            ? (close) => (
                <InkButton
                  disabled={busy}
                  onClick={() => {
                    close();
                    choose(item);
                  }}
                >
                  选择展示
                </InkButton>
              )
            : undefined,
        })}
      />
    </div>
  );
  return (
    <InkModal
      isOpen
      title={`展示道具 · ${channelName}`}
      className="max-w-5xl"
      onClose={() => {
        if (posting || pending.current) return;
        if (bagOpen) setBagOpen(false);
        else onClose();
      }}
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
          {loading ? <p className="text-sm">正在读取背包…</p> : null}
          {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
          <div className="lg:hidden">
            <InkButton disabled={busy} onClick={() => setBagOpen(true)}>
              选择随身物品
            </InkButton>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 shrink-0">
              <ItemSlot item={selected} emptyLabel="待展示" className="w-full" />
            </div>
            <p className="text-sm">
              {selected?.name ?? '选择一件随身物品供道友鉴赏'}
            </p>
          </div>
          <InkInput
            label="附言（可选）"
            value={text}
            multiline
            rows={3}
            disabled={posting}
            onChange={(value) =>
              setText(Array.from(value).slice(0, 100).join(''))
            }
            hint={`${Array.from(text).length}/100`}
          />
          <p className="text-ink-secondary text-sm">
            展示发送时的物品状态，不消耗物品。
          </p>
          <div className="flex justify-end gap-3">
            <InkButton disabled={posting} onClick={onClose}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={posting}
              disabled={busy || !selected}
              onClick={() => void submit()}
            >
              发送展示
            </InkButton>
          </div>
        </div>
        <section className="hidden min-w-0 lg:block" aria-label="随身物品">
          {inventory}
        </section>
      </div>
      <InkDetailDrawer
        isOpen={bagOpen}
        onClose={() => setBagOpen(false)}
        title="随身物品"
        size="sm"
      >
        {inventory}
      </InkDetailDrawer>
    </InkModal>
  );
}
