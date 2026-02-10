'use client';

import { InkModal } from '@/components/layout/InkModal';
import {
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
  InkTabs,
} from '@/components/ui';
import type { Artifact, Consumable, Cultivator, Material } from '@/types/cultivator';
import {
  getConsumableRankInfo,
  getMaterialTypeInfo,
  getQualityInfo,
} from '@/types/dictionaries';
import { useState } from 'react';

interface ListItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  cultivator: Cultivator | null;
}

type ItemType = 'material' | 'artifact' | 'consumable';
type SelectableItem = (Material | Artifact | Consumable) & { itemType: ItemType };

export function ListItemModal({ onClose, onSuccess, cultivator }: ListItemModalProps) {
  const [step, setStep] = useState<'select' | 'price'>('select');
  const [activeType, setActiveType] = useState<ItemType>('material');
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 模拟背包物品数据（实际应从 cultivator 获取）
  const materials: SelectableItem[] = (cultivator?.materials || []).map(m => ({ ...m, itemType: 'material' as ItemType }));
  const artifacts: SelectableItem[] = (cultivator?.artifacts || []).map(a => ({ ...a, itemType: 'artifact' as ItemType }));
  const consumables: SelectableItem[] = (cultivator?.consumables || []).map(c => ({ ...c, itemType: 'consumable' as ItemType }));

  const handleSelectItem = (item: SelectableItem) => {
    setSelectedItem(item);
    setStep('price');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedItem(null);
    setPrice('');
    setError('');
  };

  const handleSubmitPrice = async () => {
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum < 1) {
      setError('价格必须至少为 1 灵石');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: selectedItem!.itemType,
          itemId: selectedItem!.id,
          price: priceNum,
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

  const getItemDisplay = (item: SelectableItem) => {
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
          badge: <InkBadge tier={material.rank}>{typeInfo.label}</InkBadge>,
          meta: `${typeInfo.icon} · ${material.element || '无属性'}`,
        };
      }
      case 'artifact': {
        const artifact = item as Artifact;
        const qualityInfo = getQualityInfo(artifact.quality);
        return {
          ...baseInfo,
          badge: <InkBadge tier={artifact.quality}>{qualityInfo.label}</InkBadge>,
          meta: `⚔️ · ${artifact.element} · ${artifact.slot}`,
        };
      }
      case 'consumable': {
        const consumable = item as Consumable;
        const qualityInfo = getQualityInfo(consumable.quality);
        const rankInfo = getConsumableRankInfo(consumable.quality);
        return {
          ...baseInfo,
          badge: <InkBadge tier={consumable.quality}>{rankInfo.label}</InkBadge>,
          meta: `💊 · ${consumable.type}`,
        };
      }
    }
  };

  const getTypeLabel = (type: ItemType) => {
    switch (type) {
      case 'material':
        return '材料';
      case 'artifact':
        return '法宝';
      case 'consumable':
        return '消耗品';
    }
  };

  const getCurrentItems = () => {
    switch (activeType) {
      case 'material':
        return materials;
      case 'artifact':
        return artifacts;
      case 'consumable':
        return consumables;
    }
  };

  const tabs = [
    { label: `材料 (${materials.length})`, value: 'material' },
    { label: `法宝 (${artifacts.length})`, value: 'artifact' },
    { label: `消耗品 (${consumables.length})`, value: 'consumable' },
  ];

  return (
    <InkModal
      isOpen={true}
      onClose={onClose}
      title={step === 'select' ? '选择要寄售的物品' : '设置价格'}
      footer={
        <div className="flex gap-2 mt-4">
          {step === 'price' && (
            <InkButton onClick={handleBack} variant="secondary" className="flex-1">
              返回
            </InkButton>
          )}
          <InkButton onClick={onClose} variant="ghost" className="flex-1">
            取消
          </InkButton>
          {step === 'price' && (
            <InkButton
              onClick={handleSubmitPrice}
              disabled={isSubmitting || !price}
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
            onChange={(v) => setActiveType(v as ItemType)}
          />
          <div className="mt-4">
            {getCurrentItems().length > 0 ? (
              <InkList>
                {getCurrentItems().map((item) => {
                  const display = getItemDisplay(item);
                  return (
                    <InkListItem
                      key={item.id}
                      title={
                        <>
                          {display.name}
                          <div className="ml-auto">{display.badge}</div>
                        </>
                      }
                      meta={display.meta}
                      description={display.description}
                      actions={
                        <InkButton
                          onClick={() => handleSelectItem(item)}
                          variant="primary"
                          className="min-w-16"
                        >
                          选择
                        </InkButton>
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
        </>
      ) : (
        <div className="space-y-4">
          {selectedItem && (
            <div className="p-4 bg-ink/5 rounded-lg border border-ink/20">
              <div className="flex items-center gap-2">
                <span className="font-bold">{selectedItem.name}</span>
                {(() => {
                  const display = getItemDisplay(selectedItem);
                  return display.badge;
                })()}
              </div>
              <p className="text-sm text-ink-secondary mt-1">
                {selectedItem.description}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              设置价格（灵石）
            </label>
            <InkInput
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="请输入价格"
              autoFocus
            />
            {price && !isNaN(parseInt(price)) && parseInt(price) >= 1 && (
              <p className="text-sm text-ink-secondary mt-2">
                预计收入: {Math.floor(parseInt(price) * 0.9)} 灵石 (10%手续费)
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="text-xs text-ink-secondary">
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
