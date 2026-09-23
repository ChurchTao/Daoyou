import { ItemSlot } from '@app/components/feature/items/ItemSlot';
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
import { AdminDialog } from './AdminDialog';
import { AdminPageHeader } from './AdminPage';
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
  const [editorError, setEditorError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
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
    setEditorError('');
    setEditorOpen(true);
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
    setEditorError('');
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
      setEditorOpen(false);
      await load();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (item: ItemExchangeShopItemView) => {
    setSaving(true);
    try {
      const response = await fetch(`${endpoint}/${item.id}/archive`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '下架失败');
      pushToast({ message: '商品已下架', tone: 'success' });
      await load();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '下架失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };
  const visibleItems = items.filter(
    (item) =>
      (filter === 'all' || item.status === filter) &&
      (item.item?.name ?? item.itemLibraryItemId ?? '').includes(query),
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={title}
        description="管理商品、兑换价格与每周限购。"
        actions={
          <InkButton
            variant="primary"
            onClick={() => {
              reset();
              setEditorError('');
              setEditorOpen(true);
            }}
          >
            新增商品
          </InkButton>
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <InkInput label="搜索商品" value={query} onChange={setQuery} />
        <InkSelect label="商品状态" value={filter} onChange={setFilter}>
          <option value="all">全部</option>
          <option value="active">上架中</option>
          <option value="archived">已下架</option>
        </InkSelect>
        <span className="text-ink-secondary pb-2 text-sm">
          共 <span className="font-mono">{visibleItems.length}</span> 件商品
        </span>
      </div>
      {loading ? (
        <InkNotice>商品加载中…</InkNotice>
      ) : !visibleItems.length ? (
        <InkNotice>
          {query || filter !== 'all' ? '没有匹配的商品' : emptyText}
        </InkNotice>
      ) : (
        <div className="grid gap-x-8 md:grid-cols-2">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className="border-ink/10 flex min-w-0 gap-4 border-b py-5"
            >
              {item.item && (
                <div className="grid w-20 shrink-0 self-start">
                  <ItemSlot item={item.item} quantityLabel="奖励" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold break-words">
                    {item.item?.name ?? '待重新配置的旧商品'}
                  </p>
                  <span
                    className={`text-xs ${item.status === 'active' ? 'text-crimson' : 'text-ink-secondary'}`}
                  >
                    {item.status === 'active' ? '上架中' : '已下架'}
                  </span>
                </div>
                <p className="text-sm">
                  <span className="font-mono">{item.price}</span>{' '}
                  {currencyLabel} · 每次{' '}
                  <span className="font-mono">{item.quantity}</span> 件
                </p>
                <p className="text-ink-secondary text-xs">
                  每周限购 {item.perUserLimit ?? '不限'} · 排序 {item.sortOrder}
                </p>
                <div className="flex gap-2">
                  <InkButton disabled={saving} onClick={() => edit(item)}>
                    {item.item ? '编辑' : '重新配置'}
                  </InkButton>
                  {item.status === 'active' && (
                    <InkButton
                      disabled={saving}
                      variant="secondary"
                      onClick={() => void archive(item)}
                    >
                      下架
                    </InkButton>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <AdminDialog
        error={editorError}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        busy={saving}
        title={draft.id ? '编辑商品' : '新增商品'}
        footer={
          <>
            <InkButton disabled={saving} onClick={() => setEditorOpen(false)}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={saving}
              onClick={save}
              disabled={!draft.item}
            >
              {draft.id ? '保存修改' : '保存商品'}
            </InkButton>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            {draft.item && (
              <div className="grid w-24 shrink-0">
                <ItemSlot
                  item={rewardDisplayItem({
                    ...draft.item,
                    quantity: Number(draft.quantity) || 1,
                  })}
                  quantityLabel="奖励"
                />
              </div>
            )}
            <div className="space-y-2">
              {draft.item && (
                <p className="font-semibold">
                  {rewardDisplayItem(draft.item).name}
                </p>
              )}
              <RewardItemPicker
                label={draft.item ? '更换道具' : '选择道具'}
                disabled={saving}
                onSelect={(item) =>
                  setDraft((current) => ({ ...current, item, quantity: '1' }))
                }
              />
            </div>
          </div>
          {draft.item && (
            <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
              <InkInput
                label={priceLabel}
                value={draft.price}
                onChange={(price) =>
                  setDraft((current) => ({ ...current, price }))
                }
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
            </fieldset>
          )}
        </div>
      </AdminDialog>
    </div>
  );
}
