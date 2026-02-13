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
import { useCallback, useEffect, useRef, useState } from 'react';

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

const PAGE_SIZE = 20;
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

function isStackableItem(
  item: SelectableItem,
): item is (Material | Consumable) & { itemType: 'material' | 'consumable' } {
  return item.itemType !== 'artifact';
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
  const [itemsByType, setItemsByType] = useState<Record<ItemType, SelectableItem[]>>(
    {
      material: [],
      artifact: [],
      consumable: [],
    },
  );
  const [paginationByType, setPaginationByType] = useState<
    Record<ItemType, InventoryPagination>
  >({
    material: defaultPagination,
    artifact: defaultPagination,
    consumable: defaultPagination,
  });
  const [loadedByType, setLoadedByType] = useState<Record<ItemType, boolean>>({
    material: false,
    artifact: false,
    consumable: false,
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
        const res = await fetch(
          `/api/cultivator/inventory?type=${apiType}&page=${Math.max(1, page)}&pageSize=${PAGE_SIZE}`,
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
          [itemType]:
            result.data?.pagination || { ...defaultPagination, pageSize: PAGE_SIZE },
        }));
        setLoadedByType((prev) => ({
          ...prev,
          [itemType]: true,
        }));
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        setListError(e instanceof Error ? e.message : '读取背包失败');
      } finally {
        if (requestId !== requestIdRef.current) return;
        setIsItemsLoading(false);
      }
    },
    [cultivator?.id],
  );

  useEffect(() => {
    if (!cultivator?.id || loadedByType[activeType]) return;
    void fetchItemPage(activeType, 1);
  }, [activeType, cultivator?.id, fetchItemPage, loadedByType]);

  const handleSelectItem = (item: SelectableItem) => {
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

  const getCurrentItems = () => {
    return itemsByType[activeType];
  };

  const currentPagination = paginationByType[activeType];

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
            }}
          />
          <div className="mt-4">
            {!cultivator?.id ? (
              <InkNotice>请先登录后再上架物品</InkNotice>
            ) : isItemsLoading && getCurrentItems().length === 0 ? (
              <div className="py-8 text-center">正在读取背包物品...</div>
            ) : listError ? (
              <InkNotice>{listError}</InkNotice>
            ) : getCurrentItems().length > 0 ? (
              <InkList>
                {getCurrentItems().map((item) => {
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
                {activeType === 'material' && '储物袋中没有材料'}
                {activeType === 'artifact' && '储物袋中没有法宝'}
                {activeType === 'consumable' && '储物袋中没有消耗品'}
              </InkNotice>
            )}
          </div>
          {currentPagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <InkButton
                variant="secondary"
                disabled={isItemsLoading || currentPagination.page <= 1}
                onClick={() => void fetchItemPage(activeType, currentPagination.page - 1)}
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
                onClick={() => void fetchItemPage(activeType, currentPagination.page + 1)}
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
