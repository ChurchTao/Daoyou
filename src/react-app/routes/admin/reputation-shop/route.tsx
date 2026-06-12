import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
  InkSelect,
} from '@app/components/ui';
import type {
  ReputationShopItemMutation,
  ReputationShopItemView,
} from '@shared/contracts/reputationShop';
import {
  REPUTATION_SHOP_MAX_PRICE,
  REPUTATION_SHOP_MAX_STACK_QUANTITY,
} from '@shared/contracts/reputationShop';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import { QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ItemLibraryResponse {
  items?: ItemLibraryEntry[];
  error?: string;
}

interface ReputationShopAdminResponse {
  items?: ReputationShopItemView[];
  error?: string;
}

interface DraftState {
  id: string | null;
  itemLibraryItemId: string;
  price: string;
  quantity: string;
  perUserLimit: string;
  status: 'active' | 'archived';
  sortOrder: string;
}

const emptyDraft: DraftState = {
  id: null,
  itemLibraryItemId: '',
  price: '1000',
  quantity: '1',
  perUserLimit: '',
  status: 'active',
  sortOrder: '0',
};

function getItemTypeLabel(item: ItemLibraryEntry) {
  switch (item.type) {
    case 'material':
      return '材料';
    case 'consumable':
      return '消耗品';
    case 'artifact':
      return '法宝';
  }
}

function toQualityTier(quality: string | null | undefined): Quality | undefined {
  return QUALITY_VALUES.includes(quality as Quality)
    ? (quality as Quality)
    : undefined;
}

function parsePositiveInt(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label}必须为正整数`);
  }
  return parsed;
}

function normalizeQuantityForItem(
  quantity: string,
  item: ItemLibraryEntry | undefined,
) {
  return item?.type === 'artifact' ? '1' : quantity;
}

function toMutation(
  draft: DraftState,
  item: ItemLibraryEntry | undefined,
): ReputationShopItemMutation {
  const price = parsePositiveInt(draft.price, '价格');
  if (price > REPUTATION_SHOP_MAX_PRICE) {
    throw new Error(`价格最高为 ${REPUTATION_SHOP_MAX_PRICE}`);
  }

  const quantity = parsePositiveInt(
    normalizeQuantityForItem(draft.quantity, item),
    '数量',
  );
  if (item?.type === 'artifact' && quantity !== 1) {
    throw new Error('法宝类商品每次只能发放 1 件');
  }
  if (item?.type !== 'artifact' && quantity > REPUTATION_SHOP_MAX_STACK_QUANTITY) {
    throw new Error(
      `材料和消耗品每次最多发放 ${REPUTATION_SHOP_MAX_STACK_QUANTITY} 件`,
    );
  }

  return {
    itemLibraryItemId: draft.itemLibraryItemId,
    price,
    quantity,
    perUserLimit: draft.perUserLimit.trim()
      ? parsePositiveInt(draft.perUserLimit, '每周限购')
      : null,
    status: draft.status,
    sortOrder: Number.isInteger(Number(draft.sortOrder))
      ? Number(draft.sortOrder)
      : 0,
  };
}

export default function AdminReputationShopPage() {
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<ReputationShopItemView[]>([]);
  const [libraryItems, setLibraryItems] = useState<ItemLibraryEntry[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const libraryByItemId = useMemo(
    () => new Map(libraryItems.map((item) => [item.itemId, item])),
    [libraryItems],
  );
  const selectedLibraryItem = libraryByItemId.get(draft.itemLibraryItemId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shopResponse, libraryResponse] = await Promise.all([
        fetch('/api/admin/reputation-shop', { cache: 'no-store' }),
        fetch('/api/admin/item-library?status=published', { cache: 'no-store' }),
      ]);
      const shopData =
        (await shopResponse.json()) as ReputationShopAdminResponse;
      const libraryData = (await libraryResponse.json()) as ItemLibraryResponse;
      if (!shopResponse.ok) {
        throw new Error(shopData.error ?? '加载声望商店失败');
      }
      if (!libraryResponse.ok) {
        throw new Error(libraryData.error ?? '加载道具库失败');
      }
      const nextLibraryItems = libraryData.items ?? [];
      setItems(shopData.items ?? []);
      setLibraryItems(nextLibraryItems);
      setDraft((current) =>
        current.itemLibraryItemId || nextLibraryItems.length === 0
          ? current
          : {
              ...current,
              itemLibraryItemId: nextLibraryItems[0].itemId,
              quantity: normalizeQuantityForItem(
                current.quantity,
                nextLibraryItems[0],
              ),
            },
      );
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const resetDraft = () => {
    setDraft({
      ...emptyDraft,
      itemLibraryItemId: libraryItems[0]?.itemId ?? '',
      quantity: normalizeQuantityForItem('1', libraryItems[0]),
    });
  };

  const editItem = (item: ReputationShopItemView) => {
    setDraft({
      id: item.id,
      itemLibraryItemId: item.itemLibraryItemId,
      price: String(item.price),
      quantity: normalizeQuantityForItem(String(item.quantity), item.item),
      perUserLimit: item.perUserLimit ? String(item.perUserLimit) : '',
      status: item.status,
      sortOrder: String(item.sortOrder),
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = toMutation(draft, selectedLibraryItem);
      const response = await fetch(
        draft.id
          ? `/api/admin/reputation-shop/${draft.id}`
          : '/api/admin/reputation-shop',
        {
          method: draft.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? '保存失败');
      }
      pushToast({ message: '声望商店商品已保存', tone: 'success' });
      resetDraft();
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

  const archive = async (item: ReputationShopItemView) => {
    const response = await fetch(`/api/admin/reputation-shop/${item.id}/archive`, {
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
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          REPUTATION SHOP
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">声望商店管理</h2>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <InkSelect
            label="道具库道具"
            value={draft.itemLibraryItemId}
            onChange={(itemLibraryItemId) => {
              const item = libraryByItemId.get(itemLibraryItemId);
              setDraft((current) => ({
                ...current,
                itemLibraryItemId,
                quantity: normalizeQuantityForItem(current.quantity, item),
              }));
            }}
            disabled={libraryItems.length === 0}
          >
            {libraryItems.length === 0 ? (
              <option value="">暂无 published 道具</option>
            ) : (
              libraryItems.map((item) => (
                <option key={item.id} value={item.itemId}>
                  {item.name} / {getItemTypeLabel(item)} / {item.itemId}
                </option>
              ))
            )}
          </InkSelect>
          <InkInput
            label="声望价格"
            value={draft.price}
            onChange={(price) => setDraft((current) => ({ ...current, price }))}
            hint={`最高 ${REPUTATION_SHOP_MAX_PRICE}`}
          />
          <InkInput
            label="单次获得"
            value={normalizeQuantityForItem(draft.quantity, selectedLibraryItem)}
            onChange={(quantity) =>
              setDraft((current) => ({ ...current, quantity }))
            }
            disabled={selectedLibraryItem?.type === 'artifact'}
            hint={
              selectedLibraryItem?.type === 'artifact'
                ? '法宝固定发放 1 件'
                : `材料/消耗品最高 ${REPUTATION_SHOP_MAX_STACK_QUANTITY} 件`
            }
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

        {draft.itemLibraryItemId ? (
          <InkNotice tone="muted">
            当前选择：
            {libraryByItemId.get(draft.itemLibraryItemId)?.name ??
              draft.itemLibraryItemId}
          </InkNotice>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <InkButton
            type="button"
            variant="primary"
            onClick={save}
            disabled={saving || !draft.itemLibraryItemId}
          >
            {draft.id ? '保存修改' : '新增商品'}
          </InkButton>
          <InkButton type="button" variant="secondary" onClick={resetDraft}>
            清空表单
          </InkButton>
        </div>
      </section>

      <section className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        {loading ? (
          <InkNotice tone="muted">声望商店加载中...</InkNotice>
        ) : items.length === 0 ? (
          <InkNotice tone="muted">暂未配置声望商店商品。</InkNotice>
        ) : (
          <InkList>
            {items.map((item) => (
              <InkListItem
                key={item.id}
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{item.item.name}</span>
                    <InkBadge tier={toQualityTier(item.item.quality)}>
                      {item.status === 'active' ? '上架' : '下架'}
                    </InkBadge>
                  </div>
                }
                meta={`价格 ${item.price} 声望 · 单次获得 ${item.quantity} · 每周限购 ${
                  item.perUserLimit ?? '不限'
                } · 排序 ${item.sortOrder}`}
                description={item.item.description ?? item.item.payload.description}
                actions={
                  <div className="flex gap-2">
                    <InkButton
                      type="button"
                      variant="secondary"
                      onClick={() => editItem(item)}
                    >
                      编辑
                    </InkButton>
                    <InkButton
                      type="button"
                      variant="secondary"
                      onClick={() => archive(item)}
                      disabled={item.status === 'archived'}
                    >
                      下架
                    </InkButton>
                  </div>
                }
              />
            ))}
          </InkList>
        )}
      </section>
    </div>
  );
}
