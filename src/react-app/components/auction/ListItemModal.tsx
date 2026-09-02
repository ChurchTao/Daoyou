import {
  ConsumableListCard,
  getConsumableListSummary,
} from '@app/components/feature/consumables';
import { ArtifactListCard } from '@app/components/feature/products';
import { InkModal } from '@app/components/layout/InkModal';
import {
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkNotice,
  InkSelect,
  InkTabs,
  inkFieldVariants,
} from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import {
  useArtifactInventoryResource,
  useConsumableInventoryResource,
  useMaterialInventoryResource,
} from '@app/lib/resources/inventory';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  AUCTION_MAX_PURCHASE_QUANTITY,
  AUCTION_MIN_QUALITY,
  calculateAuctionSettlement,
  getAuctionUnitPriceCap,
  isAuctionListableMaterial,
  isAuctionListableQuality as isAuctionListableQualityValue,
} from '@shared/config/auctionConfig';
import {
  TEMP_DISABLED_MESSAGES,
  temporaryRestrictions,
} from '@shared/config/temporaryRestrictions';
import { cn } from '@shared/lib/cn';
import { isTradableConsumable } from '@shared/lib/consumables';
import {
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
  getResourceTypeLabel,
} from '@shared/lib/gameConceptDisplay';
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
} from '@shared/types/constants';
import type {
  Artifact,
  Consumable,
  Cultivator,
  Material,
} from '@shared/types/cultivator';
import { useEffect, useMemo, useState } from 'react';

interface ListItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  cultivator: Pick<Cultivator, 'id' | 'realm' | 'condition'> | null;
}

type ItemType = 'material' | 'artifact' | 'consumable';
type SelectableItem = (Material | Artifact | Consumable) & {
  itemType: ItemType;
};

type ListingVisibility = 'public' | 'private';

interface FriendSummary {
  id: string;
  name: string;
  title: string | null;
  realm: string;
  realmStage: string;
  status: string;
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

const compactSelectClassName = cn(inkFieldVariants({ size: 'sm' }), 'mt-1');

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

/** 获取物品品质对应的价格上限，神品返回全局上限 */
function getMaxPriceForItem(item: SelectableItem): number {
  return getAuctionUnitPriceCap(getItemQuality(item));
}

function getAuctionUnsupportedReason(item: SelectableItem): string | null {
  if (
    item.itemType === 'consumable' &&
    !isTradableConsumable(item as Consumable)
  ) {
    return '当前仅支持丹药或灵果寄售';
  }

  return null;
}

function isAuctionListableItem(item: SelectableItem): boolean {
  if (getAuctionUnsupportedReason(item)) {
    return false;
  }

  if (item.itemType === 'material') {
    return isAuctionListableMaterial(item as Material);
  }

  const quality = getItemQuality(item);
  return isAuctionListableQualityValue(quality);
}

export function ListItemModal({
  onClose,
  onSuccess,
  cultivator,
}: ListItemModalProps) {
  const { mutate } = useResourceMutation();
  const [step, setStep] = useState<'select' | 'price'>('select');
  const [activeType, setActiveType] = useState<ItemType>('material');
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [visibility, setVisibility] = useState<ListingVisibility>('public');
  const [targetCultivatorId, setTargetCultivatorId] = useState('');
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [materialFilters, setMaterialFilters] = useState<MaterialListFilters>(
    defaultMaterialFilters,
  );
  const [artifactFilters, setArtifactFilters] = useState<ArtifactListFilters>(
    defaultArtifactFilters,
  );
  const [consumableFilters, setConsumableFilters] =
    useState<ConsumableListFilters>(defaultConsumableFilters);
  const materialInventory = useMaterialInventoryResource({
    pageSize: PAGE_SIZE,
    enabled: Boolean(cultivator?.id) && activeType === 'material',
    materialRanks:
      materialFilters.rank === 'all'
        ? AUCTION_ALLOWED_QUALITIES
        : [materialFilters.rank],
    materialTypes:
      materialFilters.type === 'all' ? undefined : [materialFilters.type],
    materialElements:
      materialFilters.element === 'all' ? undefined : [materialFilters.element],
    materialSortBy: materialFilters.sortBy,
    materialSortOrder: materialFilters.sortOrder,
  });
  const artifactInventory = useArtifactInventoryResource({
    pageSize: PAGE_SIZE,
    enabled: Boolean(cultivator?.id) && activeType === 'artifact',
  });
  const consumableInventory = useConsumableInventoryResource({
    pageSize: PAGE_SIZE,
    enabled: Boolean(cultivator?.id) && activeType === 'consumable',
    consumableKind: 'tradable',
  });
  const activeInventory =
    activeType === 'material'
      ? materialInventory
      : activeType === 'artifact'
        ? artifactInventory
        : consumableInventory;
  const selectedQuantity =
    selectedItem && isStackableItem(selectedItem)
      ? Math.max(1, Number.parseInt(quantity) || 1)
      : 1;
  const settlementPreview =
    selectedItem && Number.parseInt(price) >= 1
      ? calculateAuctionSettlement(Number.parseInt(price), selectedQuantity)
      : null;
  const isItemsLoading = activeInventory.loading;
  const itemsByType = useMemo<Record<ItemType, SelectableItem[]>>(() => {
    const materialById = new Map<string, SelectableItem>();
    for (const item of materialInventory.items ?? []) {
      if (!item.id) continue;
      materialById.set(item.id, { ...item, itemType: 'material' as const });
    }
    return {
      material: Array.from(materialById.values()),
      artifact: (artifactInventory.items ?? []).map((item) => ({
        ...item,
        itemType: 'artifact' as const,
      })),
      consumable: (consumableInventory.items ?? []).map((item) => ({
        ...item,
        itemType: 'consumable' as const,
      })),
    };
  }, [
    artifactInventory.items,
    consumableInventory.items,
    materialInventory.items,
  ]);

  useEffect(() => {
    if (!cultivator?.id || step !== 'price') {
      return;
    }

    let cancelled = false;
    const loadFriends = async () => {
      try {
        setFriendsLoading(true);
        const res = await fetch('/api/friends');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data.error || '获取好友名录失败');
        }
        const nextFriends = (data.friends || []) as FriendSummary[];
        setFriends(nextFriends);
        setTargetCultivatorId((current) => current || nextFriends[0]?.id || '');
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : '获取好友名录失败');
        }
      } finally {
        if (!cancelled) {
          setFriendsLoading(false);
        }
      }
    };

    void loadFriends();

    return () => {
      cancelled = true;
    };
  }, [cultivator?.id, step]);

  const handleSelectItem = (item: SelectableItem) => {
    if (
      temporaryRestrictions.disableConsumableAuctionListing &&
      item.itemType === 'consumable'
    ) {
      setListError(TEMP_DISABLED_MESSAGES.consumableAuctionListing);
      return;
    }
    const unsupportedReason = getAuctionUnsupportedReason(item);
    if (unsupportedReason) {
      setListError(unsupportedReason);
      return;
    }

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
    setVisibility('public');
    setTargetCultivatorId('');
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
    if (
      temporaryRestrictions.disableConsumableAuctionListing &&
      selectedItem.itemType === 'consumable'
    ) {
      setError(TEMP_DISABLED_MESSAGES.consumableAuctionListing);
      return;
    }
    const unsupportedReason = getAuctionUnsupportedReason(selectedItem);
    if (unsupportedReason) {
      setError(unsupportedReason);
      return;
    }

    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum < 1) {
      setError('价格必须至少为 1 灵石');
      return;
    }
    const maxPrice = getMaxPriceForItem(selectedItem);
    if (priceNum > maxPrice) {
      const quality = getItemQuality(selectedItem);
      setError(`${quality}物品单价不得超过 ${maxPrice.toLocaleString()} 灵石`);
      return;
    }

    const isStackable = isStackableItem(selectedItem);
    const quantityNum = isStackable ? parseInt(quantity) : 1;
    if (
      isStackable &&
      (isNaN(quantityNum) ||
        quantityNum < 1 ||
        quantityNum >
          Math.min(selectedItem.quantity, AUCTION_MAX_PURCHASE_QUANTITY))
    ) {
      setError(
        `数量范围为 1 ~ ${Math.min(
          selectedItem.quantity,
          AUCTION_MAX_PURCHASE_QUANTITY,
        )}`,
      );
      return;
    }
    if (visibility === 'private' && !targetCultivatorId) {
      setError('专属交易必须指定好友');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await mutate(
        fetch('/api/auction/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemType: selectedItem.itemType,
            itemId: selectedItem.id,
            price: priceNum,
            quantity: quantityNum,
            visibility,
            targetCultivatorId:
              visibility === 'private' ? targetCultivatorId : undefined,
          }),
        }),
      );
      onSuccess();
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
        return {
          ...baseInfo,
          quality: consumable.quality,
          description: getConsumableListSummary(consumable, {
            realm: cultivator?.realm,
            condition: cultivator?.condition,
          }),
          badgeExtra: null,
        };
      }
    }
  };

  const renderSelectedItemSummary = () => {
    if (!selectedItem) return null;

    if (selectedItem.itemType === 'consumable') {
      return (
        <div className="bg-ink/5 border-ink/20 border border-dashed p-4">
          <ConsumableListCard
            consumable={selectedItem as Consumable}
            realm={cultivator?.realm}
            condition={cultivator?.condition}
            actions={null}
            contextMeta={
              <p className="text-ink-secondary text-sm">
                当前拥有: x
                {isStackableItem(selectedItem) ? selectedItem.quantity : 1}
              </p>
            }
          />
        </div>
      );
    }

    if (selectedItem.itemType === 'artifact') {
      return (
        <div className="bg-ink/5 border-ink/20 border border-dashed p-4">
          <ArtifactListCard
            artifact={selectedItem as Artifact}
            actions={null}
          />
        </div>
      );
    }

    const displayProps = getItemDisplayProps(selectedItem);

    return (
      <div className="bg-ink/5 border-ink/20 border border-dashed p-4">
        <div className="flex items-center gap-2">
          <span className="font-bold">{selectedItem.name}</span>
          {displayProps.badgeExtra}
        </div>
        <p className="text-ink-secondary mt-1 text-sm">
          {displayProps.description}
        </p>
        <p className="text-ink-secondary mt-2 text-sm">
          当前拥有: x{isStackableItem(selectedItem) ? selectedItem.quantity : 1}
        </p>
      </div>
    );
  };

  const currentPagination = activeInventory.pagination ?? {
    page: activeInventory.page,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
  const inventoryError = activeInventory.error ?? listError;
  const hasAnyLoadedItems = itemsByType[activeType].length > 0;
  const hasAnyAuctionItems = itemsByType[activeType].some(
    isAuctionListableItem,
  );

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
        let result: number;

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

  const tabs = [
    { label: getResourceTypeLabel('material'), value: 'material' },
    { label: getResourceTypeLabel('artifact'), value: 'artifact' },
    { label: '丹药/灵果', value: 'consumable' },
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
          {temporaryRestrictions.disableConsumableAuctionListing && (
            <div className="mt-3">
              <InkNotice>
                {TEMP_DISABLED_MESSAGES.consumableAuctionListing}
              </InkNotice>
            </div>
          )}

          <div className="bg-ink/5 mt-4 px-2 py-1">
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
                          className={compactSelectClassName}
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
                          className={compactSelectClassName}
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
                          className={compactSelectClassName}
                          value={materialFilters.element}
                          onChange={(event) =>
                            setMaterialFilters((prev) => ({
                              ...prev,
                              element: event.target.value as
                                ElementType | 'all',
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
                          className={compactSelectClassName}
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
                          className={compactSelectClassName}
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
                          className={compactSelectClassName}
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
                          className={compactSelectClassName}
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
                          className={compactSelectClassName}
                          value={consumableFilters.type}
                          onChange={(event) =>
                            setConsumableFilters((prev) => ({
                              ...prev,
                              type: event.target.value as
                                ConsumableType | 'all',
                            }))
                          }
                          disabled={isItemsLoading}
                        >
                          <option value="all">全部种类</option>
                          {CONSUMABLE_TYPE_VALUES.filter(
                            (type) => type !== '符箓',
                          ).map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-ink-secondary text-xs">
                        排序
                        <select
                          className={compactSelectClassName}
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
            ) : inventoryError ? (
              <InkNotice>{inventoryError}</InkNotice>
            ) : currentItems.length > 0 ? (
              <InkList>
                {currentItems.map((item) => {
                  const displayProps = getItemDisplayProps(item);
                  if (item.itemType === 'consumable') {
                    return (
                      <ConsumableListCard
                        key={item.id}
                        consumable={item as Consumable}
                        realm={cultivator?.realm}
                        condition={cultivator?.condition}
                        contextMeta={
                          <div className="text-ink-secondary text-xs">
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
                  }

                  if (item.itemType === 'artifact') {
                    return (
                      <ArtifactListCard
                        key={item.id}
                        artifact={item as Artifact}
                        contextMeta={
                          <div className="text-ink-secondary mt-1 space-y-1 text-xs">
                            <div>
                              数量: x{isStackableItem(item) ? item.quantity : 1}
                            </div>
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
                  }

                  return (
                    <ItemCard
                      key={item.id}
                      layout="col"
                      {...displayProps}
                      meta={
                        <div className="text-ink-secondary mt-1 space-y-1 text-xs">
                          <div>
                            数量: x{isStackableItem(item) ? item.quantity : 1}
                          </div>
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
                {hasAnyLoadedItems && hasAnyAuctionItems
                  ? activeType === 'consumable'
                    ? '暂无符合筛选条件的可寄售丹药（仅限玄品及以上）。'
                    : '暂无符合筛选条件的可寄售物品（仅限玄品及以上）。'
                  : activeType === 'material'
                    ? '储物袋中没有可寄售材料（仅限玄品及以上）。'
                    : activeType === 'artifact'
                      ? '储物袋中没有可寄售法宝（仅限玄品及以上）。'
                      : '储物袋中没有可寄售丹药（仅限玄品及以上）。'}
              </InkNotice>
            )}
          </div>
          {currentPagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <InkButton
                variant="secondary"
                disabled={isItemsLoading || currentPagination.page <= 1}
                onClick={activeInventory.goPrevPage}
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
                onClick={activeInventory.goNextPage}
              >
                下一页
              </InkButton>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {renderSelectedItemSummary()}

          {selectedItem?.itemType !== 'artifact' && (
            <div>
              <label className="mb-2 block text-sm font-medium">上架数量</label>
              <div className="flex gap-2">
                <InkInput
                  type="number"
                  min={1}
                  max={
                    selectedItem && isStackableItem(selectedItem)
                      ? Math.min(
                          selectedItem.quantity,
                          AUCTION_MAX_PURCHASE_QUANTITY,
                        )
                      : 1
                  }
                  value={quantity}
                  onChange={(v) => setQuantity(v)}
                  placeholder={`请输入数量（最多 ${
                    selectedItem && isStackableItem(selectedItem)
                      ? Math.min(
                          selectedItem.quantity,
                          AUCTION_MAX_PURCHASE_QUANTITY,
                        )
                      : 0
                  }）`}
                />
                <InkButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (selectedItem && isStackableItem(selectedItem)) {
                      setQuantity(
                        String(
                          Math.min(
                            selectedItem.quantity,
                            AUCTION_MAX_PURCHASE_QUANTITY,
                          ),
                        ),
                      );
                    }
                  }}
                >
                  全部
                </InkButton>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">
              设置单件价格（灵石）
            </label>
            <InkInput
              value={price}
              onChange={(v) => setPrice(v)}
              placeholder="请输入每件价格"
            />
            {selectedItem &&
              (() => {
                const maxP = getMaxPriceForItem(selectedItem);
                const q = getItemQuality(selectedItem);
                return (
                  <p className="text-ink-secondary mt-1 text-xs">
                    {q}单件上限：{maxP.toLocaleString()} 灵石
                  </p>
                );
              })()}
            {settlementPreview ? (
              <div className="text-ink-secondary mt-2 space-y-1 text-sm">
                <p>
                  总价：{settlementPreview.unitPrice.toLocaleString()} ×{' '}
                  {settlementPreview.quantity} ={' '}
                  {settlementPreview.grossAmount.toLocaleString()} 灵石
                </p>
                <p>
                  阶梯税：{settlementPreview.feeAmount.toLocaleString()} 灵石
                  （当前边际税率 {settlementPreview.marginalRatePercent}%）
                </p>
                <p>
                  全部售出预计到手：
                  {settlementPreview.sellerAmount.toLocaleString()} 灵石
                </p>
              </div>
            ) : null}
          </div>

          <div
            className={`grid gap-3 ${visibility === 'private' ? 'md:grid-cols-2' : ''}`}
          >
            <InkSelect
              label="交易范围"
              value={visibility}
              onChange={(value) => {
                const nextVisibility = value as ListingVisibility;
                setVisibility(nextVisibility);
                if (nextVisibility === 'public') {
                  setTargetCultivatorId('');
                }
                setError('');
              }}
            >
              <option value="public">公开拍卖</option>
              <option value="private">专属交易</option>
            </InkSelect>
            {visibility === 'private' && (
              <InkSelect
                label="指定道友"
                value={targetCultivatorId}
                onChange={setTargetCultivatorId}
                disabled={friendsLoading}
                hint="专属交易上架会消耗拍卖行贵宾符，可在天骄宝阁购买"
              >
                <option value="">
                  {friendsLoading ? '读取好友名录中...' : '选择好友'}
                </option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.name} · {friend.realm}
                    {friend.realmStage}
                  </option>
                ))}
              </InkSelect>
            )}
          </div>

          {error && <p className="text-crimson text-sm">{error}</p>}

          <div className="text-ink-secondary text-xs">
            <p>· 仅玄品及以上物品可寄售</p>
            <p>· 寄售后物品将从储物袋中扣除</p>
            <p>· 寄售时限为 48 小时</p>
            <p>· 成交后按单件价格适用 3%～15% 超额累进税率</p>
            <p>
              ·
              专属交易只向指定好友展示，并额外消耗拍卖行贵宾符，可在天骄宝阁购买
            </p>
            <p>· 未售出的物品将通过邮件返还</p>
          </div>
        </div>
      )}
    </InkModal>
  );
}
