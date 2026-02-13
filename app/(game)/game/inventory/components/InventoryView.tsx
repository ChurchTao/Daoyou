'use client';

import { InkPageShell } from '@/components/layout';
import { InkActionGroup } from '@/components/ui/InkActionGroup';
import { InkButton } from '@/components/ui/InkButton';
import { InkDialog } from '@/components/ui/InkDialog';
import { InkTabs } from '@/components/ui/InkTabs';
import { usePathname } from 'next/navigation';

import {
  useInventoryViewModel,
  type InventoryTab,
} from '../hooks/useInventoryViewModel';
import { ArtifactsTab } from './ArtifactsTab';
import { ConsumablesTab } from './ConsumablesTab';
import { ItemDetailModal } from './ItemDetailModal';
import { MaterialsTab } from './MaterialsTab';

/**
 * 储物袋主视图组件
 */
export function InventoryView() {
  const pathname = usePathname();
  const {
    cultivator,
    inventory,
    equipped,
    isLoading,
    isTabLoading,
    note,
    activeTab,
    setActiveTab,
    pagination,
    goPrevPage,
    goNextPage,
    selectedItem,
    isModalOpen,
    openItemDetail,
    closeItemDetail,
    dialog,
    closeDialog,
    pendingId,
    handleEquipToggle,
    handleConsume,
    openDiscardConfirm,
  } = useInventoryViewModel();

  // 加载状态
  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">储物袋开启中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【储物袋】"
      subtitle={cultivator ? `灵石余额：${cultivator.spirit_stones}` : ''}
      backHref="/game"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回主界</InkButton>
          <InkButton href="/game/market" variant="primary">
            前往坊市
          </InkButton>
          <InkButton href="/game/craft" variant="secondary">
            开炉炼造
          </InkButton>
        </InkActionGroup>
      }
    >
      {/* Tab 切换 */}
      <InkTabs
        className="mb-4"
        activeValue={activeTab}
        onChange={(val) => setActiveTab(val as InventoryTab)}
        items={[
          { label: '法宝', value: 'artifacts' },
          { label: '材料', value: 'materials' },
          { label: '消耗品', value: 'consumables' },
        ]}
      />

      {/* Tab 内容 */}
      {activeTab === 'artifacts' && (
        <ArtifactsTab
          artifacts={inventory.artifacts}
          isLoading={isTabLoading && inventory.artifacts.length === 0}
          equipped={equipped}
          pendingId={pendingId}
          onShowDetails={openItemDetail}
          onEquipToggle={handleEquipToggle}
          onDiscard={(item) => openDiscardConfirm(item, 'artifact')}
        />
      )}
      {activeTab === 'materials' && (
        <MaterialsTab
          materials={inventory.materials}
          isLoading={isTabLoading && inventory.materials.length === 0}
          onShowDetails={openItemDetail}
          onDiscard={(item) => openDiscardConfirm(item, 'material')}
        />
      )}
      {activeTab === 'consumables' && (
        <ConsumablesTab
          consumables={inventory.consumables}
          isLoading={isTabLoading && inventory.consumables.length === 0}
          pendingId={pendingId}
          onShowDetails={openItemDetail}
          onConsume={handleConsume}
          onDiscard={(item) => openDiscardConfirm(item, 'consumable')}
        />
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <InkButton
            disabled={pagination.page <= 1 || isTabLoading}
            onClick={goPrevPage}
          >
            上一页
          </InkButton>
          <span className="text-ink-secondary text-sm">
            {pagination.page} / {pagination.totalPages}
          </span>
          <InkButton
            disabled={pagination.page >= pagination.totalPages || isTabLoading}
            onClick={goNextPage}
          >
            下一页
          </InkButton>
        </div>
      )}

      {/* 物品详情弹窗 */}
      <ItemDetailModal
        isOpen={isModalOpen}
        onClose={closeItemDetail}
        item={selectedItem}
      />

      {/* 确认对话框 */}
      <InkDialog dialog={dialog} onClose={closeDialog} />
    </InkPageShell>
  );
}
