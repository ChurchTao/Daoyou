'use client';

import { InkModal } from '@/components/layout/InkModal';
import {
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkNotice,
  InkTabs,
} from '@/components/ui';
import { EffectCard } from '@/components/ui/EffectCard';
import {
  CONSUMABLE_TYPE_VALUES,
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_ORDER,
  QUALITY_VALUES,
  type ConsumableType,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@/types/constants';
import type {
  Artifact,
  Consumable,
  Cultivator,
  Material,
} from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ListItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  cultivator: Cultivator | null;
}

type ItemType = 'material' | 'artifact' | 'consumable';
type SelectableItem = (Material | Artifact | Consumable) & {
  itemType: ItemType;
};

type InventoryApiType = 'materials' | 'artifacts' | 'consumables';

interface InventoryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface InventoryApiPayload {
  success: boolean;
  data?: {
    items?: Array<Material | Artifact | Consumable>;
    pagination?: InventoryPagination;
  };
  error?: string;
}

interface MaterialListFilters {
  rank: Quality | 'all';
  type: MaterialType | 'all';
  element: ElementType | 'all';
  sortBy: 'createdAt' | 'rank' | 'type' | 'element' | 'quantity' | 'name';
  sortOrder: 'asc' | 'desc';
}

interface ArtifactListFilters {
  quality: Quality | 'all';
  sortBy: 'quality' | 'name';
  sortOrder: 'asc' | 'desc';
}

interface ConsumableListFilters {
  quality: Quality | 'all';
  type: ConsumableType | 'all';
  sortBy: 'quality' | 'quantity' | 'name';
  sortOrder: 'asc' | 'desc';
}

const PAGE_SIZE = 20;
const AUCTION_MIN_QUALITY: Quality = '玄品';
const defaultPagination: InventoryPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasMore: false,
};

const itemTypeToApiTypeMap: Record<ItemType, InventoryApiType> = {
  material: 'materials',
  artifact: 'artifacts',
  consumable: 'consumables',
};

const AUCTION_ALLOWED_QUALITIES = QUALITY_VALUES.filter(
  (q) => QUALITY_ORDER[q] >= QUALITY_ORDER[AUCTION_MIN_QUALITY],
);

const defaultMaterialFilters: MaterialListFilters = {
  rank: 'all',
  type: 'all',
  element: 'all',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const defaultArtifactFilters: ArtifactListFilters = {
  quality: 'all',
  sortBy: 'quality',
  sortOrder: 'desc',
};

const defaultConsumableFilters: ConsumableListFilters = {
  quality: 'all',
  type: 'all',
  sortBy: 'quality',
  sortOrder: 'desc',
};

function isStackableItem(
  item: SelectableItem,
): item is (Material | Consumable) & { itemType: 'material' | 'consumable' } {
  return item.itemType !== 'artifact';
}

function getItemQuality(item: SelectableItem): Quality {
  if (item.itemType === 'material') {
    return (item as Material).rank;
  }

  const quality = (item as Artifact | Consumable).quality || '凡品';
  return quality in QUALITY_ORDER ? quality : '凡品';
}

function isAuctionListableItem(item: SelectableItem): boolean {
  const quality = getItemQuality(item);
  return QUALITY_ORDER[quality] >= QUALITY_ORDER[AUCTION_MIN_QUALITY];
}

export function ListItemModal({
  onClose,
  onSuccess,
  cultivator,
}: ListItemModalProps) {
  const [step, setStep] = useState<'select' | 'price'>('select');
  const [activeType, setActiveType] = useState<ItemType>('material');
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [itemsByType, setItemsByType] = useState<
    Record<ItemType, SelectableItem[]>
  >({
    material: [],
    artifact: [],
    consumable: [],
  });
  const [materialFilters, setMaterialFilters] = useState<MaterialListFilters>(
    defaultMaterialFilters,
  );
  const [artifactFilters, setArtifactFilters] = useState<ArtifactListFilters>(
    defaultArtifactFilters,
  );
  const [consumableFilters, setConsumableFilters] =
    useState<ConsumableListFilters>(defaultConsumableFilters);
  const [paginationByType, setPaginationByType] = useState<
    Record<ItemType, InventoryPagination>
  >({
    material: defaultPagination,
    artifact: defaultPagination,
    consumable: defaultPagination,
  });
  const requestIdRef = useRef(0);

  const fetchItemPage = useCallback(
    async (itemType: ItemType, page: number) => {
      if (!cultivator?.id) return;

      const requestId = ++requestIdRef.current;
      setIsItemsLoading(true);
      setListError('');

      try {
        const apiType = itemTypeToApiTypeMap[itemType];
        const params = new URLSearchParams({
          type: apiType,
          page: String(Math.max(1, page)),
          pageSize: String(PAGE_SIZE),
        });

        if (itemType === 'material') {
          params.set(
            'materialRanks',
            materialFilters.rank === 'all'
              ? AUCTION_ALLOWED_QUALITIES.join(',')
              : materialFilters.rank,
          );
          if (materialFilters.type !== 'all') {
            params.set('materialTypes', materialFilters.type);
          }
          if (materialFilters.element !== 'all') {
            params.set('materialElements', materialFilters.element);
          }
          params.set('materialSortBy', materialFilters.sortBy);
          params.set('materialSortOrder', materialFilters.sortOrder);
        }

        const res = await fetch(
          `/api/cultivator/inventory?${params.toString()}`,
        );
        const result = (await res.json()) as InventoryApiPayload;
        if (!res.ok || !result.success) {
          throw new Error(result.error || '读取背包失败');
        }

        if (requestId !== requestIdRef.current) return;

        const mappedItems = (result.data?.items || []).map((item) => ({
          ...item,
          itemType,
        })) as SelectableItem[];

        setItemsByType((prev) => ({
          ...prev,
          [itemType]: mappedItems,
        }));
        setPaginationByType((prev) => ({
          ...prev,
          [itemType]: result.data?.pagination || {
            ...defaultPagination,
            pageSize: PAGE_SIZE,
          },
        }));
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        setListError(e instanceof Error ? e.message : '读取背包失败');
      } finally {
        if (requestId !== requestIdRef.current) return;
        setIsItemsLoading(false);
      }
    },
    [cultivator?.id, materialFilters],
  );

  useEffect(() => {
    if (!cultivator?.id) return;
    void fetchItemPage(activeType, 1);
  }, [activeType, cultivator?.id, fetchItemPage]);

  const handleSelectItem = (item: SelectableItem) => {
    if (!isAuctionListableItem(item)) {
      setListError(`仅玄品及以上物品可寄售，当前为${getItemQuality(item)}`);
      return;
    }

    setSelectedItem(item);
    setQuantity('1');
    setStep('price');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedItem(null);
    setPrice('');
    setQuantity('1');
    setError('');
  };

  const handleSubmitPrice = async () => {
    if (!selectedItem) return;
    if (!selectedItem.id) {
      setError('物品ID无效，请刷新后重试');
      return;
    }

    if (!isAuctionListableItem(selectedItem)) {
      setError(`仅玄品及以上物品可寄售，当前为${getItemQuality(selectedItem)}`);
      return;
    }

    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum < 1) {
      setError('价格必须至少为 1 灵石');
      return;
    }

    const isStackable = isStackableItem(selectedItem);
    const quantityNum = isStackable ? parseInt(quantity) : 1;
    if (
      isStackable &&
      (isNaN(quantityNum) ||
        quantityNum < 1 ||
        quantityNum > selectedItem.quantity)
    ) {
      setError(`数量范围为 1 ~ ${selectedItem.quantity}`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: selectedItem.itemType,
          itemId: selectedItem.id,
          price: priceNum,
          quantity: quantityNum,
        }),
      });

      const result = await res.json();
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || '上架失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '上架失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getItemDisplayProps = (item: SelectableItem) => {
    const baseInfo = {
      name: item.name,
      description: item.description,
    };

    switch (item.itemType) {
      case 'material': {
        const material = item as Material;
        const typeInfo = getMaterialTypeInfo(material.type);
        return {
          ...baseInfo,
          icon: typeInfo.icon,
          quality: material.rank,
          badgeExtra: (
            <>
              <InkBadge tone="default">{typeInfo.label}</InkBadge>
              {material.element && (
                <InkBadge tone="default">{material.element}</InkBadge>
              )}
            </>
          ),
        };
      }
      case 'artifact': {
        const artifact = item as Artifact;
        const slotInfo = getEquipmentSlotInfo(artifact.slot);
        return {
          ...baseInfo,
          icon: slotInfo.icon,
          quality: artifact.quality,
          effects: artifact.effects,
          badgeExtra: (
            <>
              <InkBadge tone="default">{artifact.element}</InkBadge>
              <InkBadge tone="default">{slotInfo.label}</InkBadge>
            </>
          ),
        };
      }
      case 'consumable': {
        const consumable = item as Consumable;
        const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];
        return {
          ...baseInfo,
          icon: typeInfo.icon,
          quality: consumable.quality,
          effects: consumable.effects,
          badgeExtra: (
            <>
              <InkBadge tone="default">{consumable.type}</InkBadge>
            </>
          ),
        };
      }
    }
  };

  const currentPagination = paginationByType[activeType];

  const currentItems = useMemo(() => {
    const baseItems = itemsByType[activeType].filter(isAuctionListableItem);

    if (activeType === 'artifact') {
      const filtered = baseItems.filter((item) => {
        const quality = getItemQuality(item);
        if (
          artifactFilters.quality !== 'all' &&
          quality !== artifactFilters.quality
        ) {
          return false;
        }
        return true;
      });

      return filtered.sort((a, b) => {
        const multiplier = artifactFilters.sortOrder === 'asc' ? 1 : -1;
        const result =
          artifactFilters.sortBy === 'name'
            ? a.name.localeCompare(b.name, 'zh-CN')
            : (QUALITY_ORDER[getItemQuality(a)] ?? -1) -
              (QUALITY_ORDER[getItemQuality(b)] ?? -1);
        return result * multiplier;
      });
    }

    if (activeType === 'consumable') {
      const filtered = baseItems.filter((item) => {
        const consumable = item as Consumable;
        const quality = getItemQuality(item);
        if (
          consumableFilters.quality !== 'all' &&
          quality !== consumableFilters.quality
        ) {
          return false;
        }
        if (
          consumableFilters.type !== 'all' &&
          consumable.type !== consumableFilters.type
        ) {
          return false;
        }
        return true;
      });

      return filtered.sort((a, b) => {
        const multiplier = consumableFilters.sortOrder === 'asc' ? 1 : -1;
        let result = 0;

        if (consumableFilters.sortBy === 'name') {
          result = a.name.localeCompare(b.name, 'zh-CN');
        } else if (consumableFilters.sortBy === 'quantity') {
          const qa = isStackableItem(a) ? a.quantity : 1;
          const qb = isStackableItem(b) ? b.quantity : 1;
          result = qa - qb;
        } else {
          result =
            (QUALITY_ORDER[getItemQuality(a)] ?? -1) -
            (QUALITY_ORDER[getItemQuality(b)] ?? -1);
        }

        return result * multiplier;
      });
    }

    return baseItems;
  }, [
    activeType,
    artifactFilters.quality,
    artifactFilters.sortBy,
    artifactFilters.sortOrder,
    consumableFilters.quality,
    consumableFilters.sortBy,
    consumableFilters.sortOrder,
    consumableFilters.type,
    itemsByType,
  ]);

  const hasAnyLoadedItems = itemsByType[activeType].length > 0;

  const tabs = [
    { label: '材料', value: 'material' },
    { label: '法宝', value: 'artifact' },
    { label: '消耗品', value: 'consumable' },
  ];

  return (
    <InkModal
      isOpen={true}
      onClose={onClose}
      title={step === 'select' ? '选择要寄售的物品' : '设置价格'}
      footer={
        <div className="mt-4 flex gap-2">
          {step === 'price' && (
            <InkButton
              onClick={handleBack}
              variant="secondary"
              className="flex-1"
            >
              返回
            </InkButton>
          )}
          <InkButton onClick={onClose} variant="ghost" className="flex-1">
            取消
          </InkButton>
          {step === 'price' && (
            <InkButton
              onClick={handleSubmitPrice}
              disabled={
                isSubmitting ||
                !price ||
                (selectedItem?.itemType !== 'artifact' && !quantity)
              }
              variant="primary"
              className="flex-1"
            >
              {isSubmitting ? '上架中...' : '确认上架'}
            </InkButton>
          )}
        </div>
      }
    >
      {step === 'select' ? (
        <>
          <InkTabs
            items={tabs}
            activeValue={activeType}
            onChange={(v) => {
              setActiveType(v as ItemType);
              setListError('');
              setIsFilterOpen(false);
            }}
          />

          <div className="bg-ink/5 border-ink/10 mt-4 border p-2">
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary text-sm leading-6">
                筛选与排序
              </span>
              <InkButton
                variant="secondary"
                className="text-sm leading-6"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                disabled={isItemsLoading}
              >
                {isFilterOpen ? '收起筛选' : '展开筛选'}
              </InkButton>
            </div>

            {isFilterOpen && (
              <div className="mt-2 space-y-2">
                {activeType === 'material' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <label className="text-ink-secondary text-xs">
                        品级
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={materialFilters.rank}
                          onChange={(event) =>
                            setMaterialFilters((prev) => ({
                              ...prev,
                              rank: event.target.value as Quality | 'all',
                            }))
                          }
                          disabled={isItemsLoading}
                        >
                          <option value="all">全部可上架品级</option>
                          {AUCTION_ALLOWED_QUALITIES.map((rank) => (
                            <option key={rank} value={rank}>
                              {rank}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-ink-secondary text-xs">
                        种类
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={materialFilters.type}
                          onChange={(event) =>
                            setMaterialFilters((prev) => ({
                              ...prev,
                              type: event.target.value as MaterialType | 'all',
                            }))
                          }
                          disabled={isItemsLoading}
                        >
                          <option value="all">全部种类</option>
                          {MATERIAL_TYPE_VALUES.map((type) => (
                            <option key={type} value={type}>
                              {getMaterialTypeInfo(type).label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-ink-secondary text-xs">
                        属性
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={materialFilters.element}
                          onChange={(event) =>
                            setMaterialFilters((prev) => ({
                              ...prev,
                              element: event.target.value as
                                | ElementType
                                | 'all',
                            }))
                          }
                          disabled={isItemsLoading}
                        >
                          <option value="all">全部属性</option>
                          {ELEMENT_VALUES.map((element) => (
                            <option key={element} value={element}>
                              {element}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-ink-secondary text-xs">
                        排序
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={`${materialFilters.sortBy}:${materialFilters.sortOrder}`}
                          onChange={(event) => {
                            const [sortBy, sortOrder] =
                              event.target.value.split(':');
                            setMaterialFilters((prev) => ({
                              ...prev,
                              sortBy: sortBy as MaterialListFilters['sortBy'],
                              sortOrder:
                                sortOrder as MaterialListFilters['sortOrder'],
                            }));
                          }}
                          disabled={isItemsLoading}
                        >
                          <option value="createdAt:desc">最新获得</option>
                          <option value="createdAt:asc">最早获得</option>
                          <option value="rank:desc">品级从高到低</option>
                          <option value="rank:asc">品级从低到高</option>
                          <option value="quantity:desc">数量从多到少</option>
                          <option value="quantity:asc">数量从少到多</option>
                          <option value="name:asc">名称 A-Z</option>
                          <option value="name:desc">名称 Z-A</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <InkButton
                        variant="secondary"
                        onClick={() =>
                          setMaterialFilters(defaultMaterialFilters)
                        }
                        disabled={isItemsLoading}
                      >
                        重置筛选
                      </InkButton>
                    </div>
                  </>
                ) : activeType === 'artifact' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      <label className="text-ink-secondary text-xs">
                        品级
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={artifactFilters.quality}
                          onChange={(event) =>
                            setArtifactFilters((prev) => ({
                              ...prev,
                              quality: event.target.value as Quality | 'all',
                            }))
                          }
                          disabled={isItemsLoading}
                        >
                          <option value="all">全部可上架品级</option>
                          {AUCTION_ALLOWED_QUALITIES.map((rank) => (
                            <option key={rank} value={rank}>
                              {rank}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-ink-secondary text-xs">
                        排序
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={`${artifactFilters.sortBy}:${artifactFilters.sortOrder}`}
                          onChange={(event) => {
                            const [sortBy, sortOrder] =
                              event.target.value.split(':');
                            setArtifactFilters((prev) => ({
                              ...prev,
                              sortBy: sortBy as ArtifactListFilters['sortBy'],
                              sortOrder:
                                sortOrder as ArtifactListFilters['sortOrder'],
                            }));
                          }}
                          disabled={isItemsLoading}
                        >
                          <option value="quality:desc">品级从高到低</option>
                          <option value="quality:asc">品级从低到高</option>
                          <option value="name:asc">名称 A-Z</option>
                          <option value="name:desc">名称 Z-A</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <InkButton
                        variant="secondary"
                        onClick={() =>
                          setArtifactFilters(defaultArtifactFilters)
                        }
                        disabled={isItemsLoading}
                      >
                        重置筛选
                      </InkButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <label className="text-ink-secondary text-xs">
                        品级
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={consumableFilters.quality}
                          onChange={(event) =>
                            setConsumableFilters((prev) => ({
                              ...prev,
                              quality: event.target.value as Quality | 'all',
                            }))
                          }
                          disabled={isItemsLoading}
                        >
                          <option value="all">全部可上架品级</option>
                          {AUCTION_ALLOWED_QUALITIES.map((rank) => (
                            <option key={rank} value={rank}>
                              {rank}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-ink-secondary text-xs">
                        种类
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={consumableFilters.type}
                          onChange={(event) =>
                            setConsumableFilters((prev) => ({
                              ...prev,
                              type: event.target.value as
                                | ConsumableType
                                | 'all',
                            }))
                          }
                          disabled={isItemsLoading}
                        >
                          <option value="all">全部种类</option>
                          {CONSUMABLE_TYPE_VALUES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-ink-secondary text-xs">
                        排序
                        <select
                          className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                          value={`${consumableFilters.sortBy}:${consumableFilters.sortOrder}`}
                          onChange={(event) => {
                            const [sortBy, sortOrder] =
                              event.target.value.split(':');
                            setConsumableFilters((prev) => ({
                              ...prev,
                              sortBy: sortBy as ConsumableListFilters['sortBy'],
                              sortOrder:
                                sortOrder as ConsumableListFilters['sortOrder'],
                            }));
                          }}
                          disabled={isItemsLoading}
                        >
                          <option value="quality:desc">品级从高到低</option>
                          <option value="quality:asc">品级从低到高</option>
                          <option value="quantity:desc">数量从多到少</option>
                          <option value="quantity:asc">数量从少到多</option>
                          <option value="name:asc">名称 A-Z</option>
                          <option value="name:desc">名称 Z-A</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <InkButton
                        variant="secondary"
                        onClick={() =>
                          setConsumableFilters(defaultConsumableFilters)
                        }
                        disabled={isItemsLoading}
                      >
                        重置筛选
                      </InkButton>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            {!cultivator?.id ? (
              <InkNotice>请先登录后再上架物品</InkNotice>
            ) : isItemsLoading && currentItems.length === 0 ? (
              <div className="py-8 text-center">正在读取背包物品...</div>
            ) : listError ? (
              <InkNotice>{listError}</InkNotice>
            ) : currentItems.length > 0 ? (
              <InkList>
                {currentItems.map((item) => {
                  const displayProps = getItemDisplayProps(item);
                  return (
                    <EffectCard
                      key={item.id}
                      layout="col"
                      {...displayProps}
                      meta={
                        <div className="text-ink-secondary mt-1 text-xs">
                          数量: x{isStackableItem(item) ? item.quantity : 1}
                        </div>
                      }
                      actions={
                        <div className="flex w-full justify-end">
                          <InkButton
                            onClick={() => handleSelectItem(item)}
                            variant="primary"
                            className="min-w-16"
                          >
                            选择
                          </InkButton>
                        </div>
                      }
                    />
                  );
                })}
              </InkList>
            ) : (
              <InkNotice>
                {hasAnyLoadedItems
                  ? '暂无符合筛选条件的可寄售物品（仅限玄品及以上）。'
                  : activeType === 'material'
                    ? '储物袋中没有可寄售材料（仅限玄品及以上）。'
                    : activeType === 'artifact'
                      ? '储物袋中没有可寄售法宝（仅限玄品及以上）。'
                      : '储物袋中没有可寄售消耗品（仅限玄品及以上）。'}
              </InkNotice>
            )}
          </div>
          {currentPagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <InkButton
                variant="secondary"
                disabled={isItemsLoading || currentPagination.page <= 1}
                onClick={() =>
                  void fetchItemPage(activeType, currentPagination.page - 1)
                }
              >
                上一页
              </InkButton>
              <span className="text-ink-secondary text-sm">
                {currentPagination.page} / {currentPagination.totalPages}
              </span>
              <InkButton
                variant="secondary"
                disabled={
                  isItemsLoading ||
                  currentPagination.page >= currentPagination.totalPages
                }
                onClick={() =>
                  void fetchItemPage(activeType, currentPagination.page + 1)
                }
              >
                下一页
              </InkButton>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {selectedItem && (
            <div className="bg-ink/5 border-ink/20 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <span className="font-bold">{selectedItem.name}</span>
                {(() => {
                  const displayProps = getItemDisplayProps(selectedItem);
                  return displayProps.badgeExtra;
                })()}
              </div>
              <p className="text-ink-secondary mt-1 text-sm">
                {selectedItem.description}
              </p>
              {selectedItem.itemType !== 'artifact' && (
                <p className="text-ink-secondary mt-2 text-sm">
                  当前拥有: x
                  {isStackableItem(selectedItem) ? selectedItem.quantity : 1}
                </p>
              )}
            </div>
          )}

          {selectedItem?.itemType !== 'artifact' && (
            <div>
              <label className="mb-2 block text-sm font-medium">上架数量</label>
              <InkInput
                value={quantity}
                onChange={(v) => setQuantity(v)}
                placeholder={`请输入数量（最多 ${
                  selectedItem && isStackableItem(selectedItem)
                    ? selectedItem.quantity
                    : 0
                }）`}
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">
              设置价格（灵石）
            </label>
            <InkInput
              value={price}
              onChange={(v) => setPrice(v)}
              placeholder="请输入价格"
            />
            {price && !isNaN(parseInt(price)) && parseInt(price) >= 1 && (
              <p className="text-ink-secondary mt-2 text-sm">
                预计收入: {Math.floor(parseInt(price) * 0.9)} 灵石 (10%手续费)
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="text-ink-secondary text-xs">
            <p>· 仅玄品及以上物品可寄售</p>
            <p>· 寄售后物品将从储物袋中扣除</p>
            <p>· 寄售时限为 48 小时</p>
            <p>· 交易成功后扣除 10% 手续费</p>
            <p>· 未售出的物品将通过邮件返还</p>
          </div>
        </div>
      )}
    </InkModal>
  );
}
