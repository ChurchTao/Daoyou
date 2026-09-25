import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { InkButton, InkInput, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import type { InventoryView } from '@shared/contracts/inventory';
import type { SummonedBeast } from '@shared/engine/combat-v6/beasts';
import { useEffect, useRef, useState } from 'react';
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
  const bagQuery = useInventoryBag();
  const bag = bagQuery.data;
  const bagUnavailable = !bag || bagQuery.isRefreshing || !!bagQuery.error;
  const [selectedRef, setSelected] = useState<InventoryView['items'][number]>();
  const [selectedBeast, setSelectedBeast] = useState<SummonedBeast>();
  const [beasts, setBeasts] = useState<SummonedBeast[]>([]);
  const [beastError, setBeastError] = useState('');
  const [source, setSource] = useState<'items' | 'beasts'>('items');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/combat-v6/beasts', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success)
          throw new Error(result.error || '灵兽读取失败');
        if (!controller.signal.aborted)
          setBeasts((result.data as BeastManagementView).beasts);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setBeastError(
            error instanceof Error ? error.message : '灵兽读取失败',
          );
      });
    return () => controller.abort();
  }, []);
  const selected = [...(bag?.items ?? []), ...(bag?.equippedItems ?? [])].find(
    (item) =>
      item.id === selectedRef?.id && item.revision === selectedRef.revision,
  );
  const [text, setText] = useState('');
  const error = bagQuery.error;
  const loading = bagQuery.loading;
  const [bagOpen, setBagOpen] = useState(false);
  const pending = useRef(false);
  const refresh = () => {
    setSelected(undefined);
    return bagQuery.reload();
  };
  const busy = posting || bagUnavailable;
  function choose(item: InventoryView['items'][number]) {
    if (busy || pending.current) return;
    setSelected(item);
    setBagOpen(false);
  }
  async function submit() {
    if (
      (!selected && !selectedBeast) ||
      posting ||
      pending.current ||
      (source === 'items' && busy)
    )
      return;
    pending.current = true;
    try {
      const sent = selectedBeast
        ? await send({
            beastId: selectedBeast.id,
            revision: selectedBeast.revision,
            textContent: text.trim() || undefined,
          })
        : await send({
            itemId: selected!.id,
            revision: selected!.revision,
            textContent: text.trim() || undefined,
          });
      if (sent) onClose();
    } finally {
      pending.current = false;
    }
  }
  const inventory = (
    <div className="space-y-3">
      <InventoryHeader
        capacity={<> {bag?.used ?? '—'} / 40</>}
        actions={
          <InkButton
            disabled={posting || bagQuery.isRefreshing}
            onClick={() => void refresh()}
          >
            刷新选物
          </InkButton>
        }
      />
      <InventoryItems
        items={bag?.items ?? []}
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
      {bag?.equippedItems.length ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">已穿戴装备</p>
          <div className="grid grid-cols-5 gap-1.5">
            {bag.equippedItems.map((item) => (
              <ItemSlot
                key={item.id}
                item={item}
                disabled={busy}
                selected={selected?.id === item.id}
                onQuickAction={() => choose(item)}
              >
                {(close) => (
                  <InkButton
                    disabled={busy}
                    onClick={() => {
                      close();
                      choose(item);
                    }}
                  >
                    选择展示
                  </InkButton>
                )}
              </ItemSlot>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
  return (
    <InkModal
      isOpen
      title={`展示物品 · ${channelName}`}
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
          <div className="flex gap-2">
            <InkButton
              onClick={() => {
                setSource('items');
                setSelectedBeast(undefined);
              }}
            >
              背包道具
            </InkButton>
            <InkButton
              onClick={() => {
                setSource('beasts');
                setSelected(undefined);
              }}
            >
              灵兽
            </InkButton>
          </div>
          {source === 'items' && (
            <div className="lg:hidden">
              <InkButton disabled={posting} onClick={() => setBagOpen(true)}>
                选择随身物品
              </InkButton>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="w-20 shrink-0">
              {source === 'items' ? (
                <ItemSlot
                  item={selected}
                  emptyLabel="待展示"
                  className="w-full"
                />
              ) : selectedBeast ? (
                <BeastIcon
                  speciesId={selectedBeast.speciesId}
                  isMutant={selectedBeast.isMutant}
                  className="text-5xl"
                />
              ) : null}
            </div>
            <p className="text-sm">
              {selectedBeast?.name ??
                selected?.name ??
                '选择一件物品供道友鉴赏'}
            </p>
          </div>
          {source === 'beasts' && selectedBeast ? (
            <div className="max-h-64 overflow-y-auto">
              <BeastTradeDetails beast={selectedBeast} tradeNotice={false} />
            </div>
          ) : null}
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
              disabled={
                posting ||
                (source === 'items' ? busy || !selected : !selectedBeast)
              }
              onClick={() => void submit()}
            >
              发送展示
            </InkButton>
          </div>
        </div>
        <section className="min-w-0" aria-label="选择展示物品">
          {source === 'items' ? (
            <div className="hidden lg:block">{inventory}</div>
          ) : (
            <div className="max-h-[65vh] space-y-2 overflow-y-auto">
              {beastError ? (
                <InkNotice tone="warning">{beastError}</InkNotice>
              ) : null}
              {beasts.map((beast) => (
                <button
                  key={beast.id}
                  type="button"
                  className={`hover:border-ink/50 w-full border p-2 text-left ${selectedBeast?.id === beast.id ? 'border-teal' : 'border-ink/20'}`}
                  onClick={() => setSelectedBeast(beast)}
                >
                  <span className="font-semibold">{beast.name}</span> ·{' '}
                  {beast.skills.length}技能{beast.isMutant ? ' · 变异' : ''}
                </button>
              ))}
            </div>
          )}
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
