import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import {
  RewardItemSchema,
  rewardDisplayItem,
} from '@shared/contracts/adminRewards';
import {
  ITEM_EXCHANGE_SHOP_MAX_PRICE,
  ItemExchangeShopItemMutationSchema,
  type ItemExchangeShopItemMutation,
  type ItemExchangeShopItemView,
} from '@shared/contracts/itemExchangeShop';
import type { ItemGrant } from '@shared/inventory';
import { useCallback, useEffect, useState } from 'react';
import { RewardItemPicker } from './RewardItemPicker';

interface DraftState {
  id: string | null;
  item: ItemGrant | null;
  price: string;
  quantity: string;
  perUserLimit: string;
  status: 'active' | 'archived';
  sortOrder: string;
}

const emptyDraft: DraftState = {
  id: null,
  item: null,
  price: '1000',
  quantity: '1',
  perUserLimit: '',
  status: 'active',
  sortOrder: '0',
};

function parsePositiveInt(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label}必须为正整数`);
  }
  return parsed;
}

function toMutation(draft: DraftState): ItemExchangeShopItemMutation {
  if (!draft.item) throw new Error('请选择道具');
  return ItemExchangeShopItemMutationSchema.parse({
    item: { ...draft.item, quantity: parsePositiveInt(draft.quantity, '数量') },
    price: parsePositiveInt(draft.price, '价格'),
    perUserLimit: draft.perUserLimit.trim()
      ? parsePositiveInt(draft.perUserLimit, '每周限购')
      : null,
    status: draft.status,
    sortOrder: Number(draft.sortOrder),
  });
}

export interface ItemExchangeShopAdminPageProps {
  endpoint: string;
  eyebrow: string;
  title: string;
  priceLabel: string;
  currencyLabel: string;
  emptyText: string;
  successText: string;
}

export function ItemExchangeShopAdminPage({
  endpoint,
  eyebrow,
  title,
  priceLabel,
  currencyLabel,
  emptyText,
  successText,
}: ItemExchangeShopAdminPageProps) {
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<ItemExchangeShopItemView[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = (await response.json()) as {
        items?: ItemExchangeShopItemView[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? '加载商店失败');
      const nextItems = data.items ?? [];
      setItems(nextItems);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [endpoint, pushToast]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const reset = () => setDraft({ ...emptyDraft });
  const edit = (item: ItemExchangeShopItemView) => {
    setDraft({
      id: item.id,
      item: item.item
        ? RewardItemSchema.parse({
            definitionId: item.item.definitionId,
            quantity: item.quantity,
            ...(item.item.instanceData
              ? { instanceData: item.item.instanceData }
              : {}),
          })
        : null,
      price: String(item.price),
      quantity: String(item.quantity),
      perUserLimit: item.perUserLimit ? String(item.perUserLimit) : '',
      status: item.status,
      sortOrder: String(item.sortOrder),
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        draft.id ? `${endpoint}/${draft.id}` : endpoint,
        {
          method: draft.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toMutation(draft)),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? '保存失败');
      pushToast({ message: successText, tone: 'success' });
      reset();
      await load();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const archive = async (item: ItemExchangeShopItemView) => {
    const response = await fetch(`${endpoint}/${item.id}/archive`, {
      method: 'POST',
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      pushToast({ message: data.error ?? '下架失败', tone: 'danger' });
      return;
    }
    pushToast({ message: '商品已下架', tone: 'success' });
    await load();
  };

  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">{eyebrow}</p>
        <h2 className="font-heading text-ink mt-2 text-4xl">{title}</h2>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <RewardItemPicker
              disabled={saving}
              onSelect={(item) =>
                setDraft((current) => ({ ...current, item, quantity: '1' }))
              }
            />
            {draft.item && (
              <div className="w-24">
                <ItemSlot
                  item={rewardDisplayItem({
                    ...draft.item,
                    quantity: Number(draft.quantity) || 1,
                  })}
                  quantityLabel="奖励"
                />
              </div>
            )}
          </div>
          <InkInput
            label={priceLabel}
            value={draft.price}
            onChange={(price) => setDraft((current) => ({ ...current, price }))}
            hint={`最高 ${ITEM_EXCHANGE_SHOP_MAX_PRICE}`}
          />
          <InkInput
            label="单次获得"
            value={draft.quantity}
            onChange={(quantity) =>
              setDraft((current) => ({ ...current, quantity }))
            }
            disabled={draft.item?.definitionId === 'equipment.v6'}
            hint="道装固定 1 件，其他道具最高 30 件"
          />
          <InkInput
            label="每周限购"
            value={draft.perUserLimit}
            onChange={(perUserLimit) =>
              setDraft((current) => ({ ...current, perUserLimit }))
            }
            placeholder="留空表示不限"
          />
          <InkInput
            label="排序"
            value={draft.sortOrder}
            onChange={(sortOrder) =>
              setDraft((current) => ({ ...current, sortOrder }))
            }
          />
          <InkSelect
            label="状态"
            value={draft.status}
            onChange={(status) =>
              setDraft((current) => ({
                ...current,
                status: status as DraftState['status'],
              }))
            }
          >
            <option value="active">上架</option>
            <option value="archived">下架</option>
          </InkSelect>
        </div>

        <div className="flex flex-wrap gap-3">
          <InkButton
            type="button"
            variant="primary"
            onClick={save}
            disabled={saving || !draft.item}
          >
            {draft.id ? '保存修改' : '新增商品'}
          </InkButton>
          <InkButton type="button" variant="secondary" onClick={reset}>
            清空表单
          </InkButton>
        </div>
      </section>

      <section className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        {loading ? (
          <InkNotice tone="muted">商品加载中...</InkNotice>
        ) : items.length === 0 ? (
          <InkNotice tone="muted">{emptyText}</InkNotice>
        ) : (
          <div className="space-y-4">
            <InventoryGrid>
              {items
                .filter((i) => i.item)
                .map((item) => (
                  <ItemSlot
                    key={item.id}
                    item={item.item!}
                    badge={item.status === 'active' ? '上架' : '下架'}
                    quantityLabel="奖励"
                  >
                    {(close) => (
                      <div className="space-y-3">
                        <p className="font-mono">
                          {item.price} {currencyLabel} · 每周限购{' '}
                          {item.perUserLimit ?? '不限'}
                        </p>
                        <div className="flex gap-2">
                          <InkButton
                            onClick={() => {
                              close();
                              edit(item);
                            }}
                          >
                            编辑
                          </InkButton>
                          <InkButton
                            disabled={item.status === 'archived'}
                            onClick={() => {
                              close();
                              void archive(item);
                            }}
                          >
                            下架
                          </InkButton>
                        </div>
                      </div>
                    )}
                  </ItemSlot>
                ))}
            </InventoryGrid>
            {items
              .filter((i) => !i.item)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3"
                >
                  <span>
                    旧商品 {item.itemLibraryItemId} · 已下架，需重新选择道具
                  </span>
                  <InkButton onClick={() => edit(item)}>重新配置</InkButton>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
