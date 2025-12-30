'use client';

import { useCultivator } from '@/app/(main)/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import type { InkDialogState } from '@/components/ui';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import { useState, useCallback } from 'react';

export type InventoryTab = 'artifacts' | 'materials' | 'consumables';
export type InventoryItem = Artifact | Consumable | Material;

export interface UseInventoryViewModelReturn {
  // 数据
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  inventory: ReturnType<typeof useCultivator>['inventory'];
  equipped: ReturnType<typeof useCultivator>['equipped'];
  isLoading: boolean;
  note: string | undefined;

  // Tab 状态
  activeTab: InventoryTab;
  setActiveTab: (tab: InventoryTab) => void;

  // Modal 状态
  selectedItem: InventoryItem | null;
  isModalOpen: boolean;
  openItemDetail: (item: InventoryItem) => void;
  closeItemDetail: () => void;

  // Dialog 状态
  dialog: InkDialogState | null;
  closeDialog: () => void;

  // 操作状态
  pendingId: string | null;

  // 业务操作
  handleEquipToggle: (item: Artifact) => Promise<void>;
  handleConsume: (item: Consumable) => Promise<void>;
  openDiscardConfirm: (
    item: InventoryItem,
    type: 'artifact' | 'consumable' | 'material'
  ) => void;
}

/**
 * 储物袋页面 ViewModel
 * 封装所有业务逻辑和状态管理
 */
export function useInventoryViewModel(): UseInventoryViewModelReturn {
  const {
    cultivator,
    inventory,
    equipped,
    isLoading,
    refresh,
    refreshInventory,
    note,
  } = useCultivator();

  const { pushToast } = useInkUI();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<InventoryTab>('artifacts');

  // Modal 状态
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dialog 状态
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 操作状态
  const [pendingId, setPendingId] = useState<string | null>(null);

  // 打开物品详情
  const openItemDetail = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  }, []);

  // 关闭物品详情
  const closeItemDetail = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // 关闭对话框
  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  // 丢弃操作
  const handleDiscard = useCallback(
    async (
      item: InventoryItem,
      type: 'artifact' | 'consumable' | 'material'
    ) => {
      if (!cultivator) return;

      try {
        setDialog((prev) => ({
          ...prev!,
          loading: true,
        }));

        const response = await fetch(
          `/api/cultivators/${cultivator.id}/inventory/discard`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: item.id, itemType: type }),
          }
        );

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '丢弃失败');
        }

        pushToast({ message: '物品已丢弃', tone: 'success' });
        await refreshInventory();
      } catch (error) {
        pushToast({
          message:
            error instanceof Error ? `操作失败：${error.message}` : '操作失败',
          tone: 'danger',
        });
      } finally {
        setDialog((prev) => ({
          ...prev!,
          loading: false,
        }));
      }
    },
    [cultivator, pushToast, refreshInventory]
  );

  // 打开丢弃确认
  const openDiscardConfirm = useCallback(
    (item: InventoryItem, type: 'artifact' | 'consumable' | 'material') => {
      setDialog({
        id: 'discard-confirm',
        title: '丢弃确认',
        content: (
          <p className="text-center py-4">
            确定要丢弃 <span className="font-bold">{item.name}</span> 吗？
            <br />
            <span className="text-xs text-ink-secondary">
              丢弃后将无法找回。
            </span>
          </p>
        ),
        confirmLabel: '确认丢弃',
        loadingLabel: '丢弃中...',
        onConfirm: async () => await handleDiscard(item, type),
      });
    },
    [handleDiscard]
  );

  // 装备/卸下法宝
  const handleEquipToggle = useCallback(
    async (item: Artifact) => {
      if (!cultivator || !item.id) {
        pushToast({
          message: '此法宝暂无有效 ID，无法操作。',
          tone: 'warning',
        });
        return;
      }

      setPendingId(item.id);
      try {
        const response = await fetch(
          `/api/cultivators/${cultivator.id}/equip`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artifactId: item.id }),
          }
        );

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '装备操作失败');
        }

        pushToast({ message: '法宝灵性已调顺。', tone: 'success' });
        await refresh();
      } catch (error) {
        pushToast({
          message:
            error instanceof Error
              ? `此法有违天道：${error.message}`
              : '操作失败，请稍后重试。',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [cultivator, pushToast, refresh]
  );

  // 服用丹药
  const handleConsume = useCallback(
    async (item: Consumable) => {
      if (!cultivator || !item.id) {
        pushToast({
          message: '此丹药暂无有效 ID，无法服用。',
          tone: 'warning',
        });
        return;
      }

      setPendingId(item.id);
      try {
        const response = await fetch(
          `/api/cultivators/${cultivator.id}/consume`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumableId: item.id }),
          }
        );

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '服用失败');
        }

        pushToast({ message: result.data.message, tone: 'success' });
        await refresh();
      } catch (error) {
        pushToast({
          message:
            error instanceof Error
              ? `药力冲突：${error.message}`
              : '服用失败，请稍后重试。',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [cultivator, pushToast, refresh]
  );

  return {
    // 数据
    cultivator,
    inventory,
    equipped,
    isLoading,
    note,

    // Tab 状态
    activeTab,
    setActiveTab,

    // Modal 状态
    selectedItem,
    isModalOpen,
    openItemDetail,
    closeItemDetail,

    // Dialog 状态
    dialog,
    closeDialog,

    // 操作状态
    pendingId,

    // 业务操作
    handleEquipToggle,
    handleConsume,
    openDiscardConfirm,
  };
}
