import { GameSceneFrame } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import { InkActionGroup } from '@app/components/ui/InkActionGroup';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDialog } from '@app/components/ui/InkDialog';
import { InkIdentifyCelebration } from '@app/components/ui/InkIdentifyCelebration';
import { InkTabs } from '@app/components/ui/InkTabs';

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
    materialFilters,
    setMaterialRankFilter,
    setMaterialTypeFilter,
    setMaterialElementFilter,
    setMaterialSort,
    resetMaterialFilters,
    selectedItem,
    isModalOpen,
    openItemDetail,
    closeItemDetail,
    dialog,
    closeDialog,
    pendingId,
    identifyCelebration,
    clearIdentifyCelebration,
    handleEquipToggle,
    handleConsume,
    handleIdentifyMaterial,
    openDiscardConfirm,
  } = useInventoryViewModel();

  // 加载状态
  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">储物袋开启中……</p>
      </div>
    );
  }

  const aside = (
    <>
      <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
        <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
          行囊摘要
        </div>
        <div className="space-y-2 text-sm leading-7">
          <p>灵石：{cultivator?.spirit_stones ?? 0}</p>
          <p>
            当前分页：{pagination.page} / {pagination.totalPages}
          </p>
          <p>
            当前分栏：
            {activeTab === 'artifacts'
              ? '法宝'
              : activeTab === 'materials'
                ? '材料'
                : '消耗品'}
          </p>
        </div>
      </section>

      {activeTab === 'materials' ? (
        <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
          <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
            材料筛选
          </div>
          <div className="space-y-2 text-sm leading-7">
            <p>品阶：{materialFilters.rank || '全部'}</p>
            <p>类别：{materialFilters.type || '全部'}</p>
            <p>五行：{materialFilters.element || '全部'}</p>
            <p>
              排序：{materialFilters.sortBy} / {materialFilters.sortOrder}
            </p>
          </div>
        </section>
      ) : null}
    </>
  );

  return (
    <GameSceneFrame
      eyebrow="行囊场景"
      title="【储物袋】"
      description="法宝、材料与消耗品都在此汇总。先点清手头资源，再决定是佩装、炼造，还是送去坊市流转。"
      headerMeta={
        note ? (
          <div className="battle-note">
            <p className="text-sm leading-7">{note}</p>
          </div>
        ) : undefined
      }
      aside={aside}
      actionBar={
        <InkActionGroup align="between">
          <InkButton href="/game">返回主界</InkButton>
          <InkButton href="/game/map?intent=market" variant="primary">
            前往坊市
          </InkButton>
          <InkButton href="/game/craft" variant="secondary">
            开炉炼造
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="行囊分栏">
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

        {activeTab === 'artifacts' && (
          <ArtifactsTab
            artifacts={inventory.artifacts}
            isLoading={isTabLoading && inventory.artifacts.length === 0}
            equipped={equipped}
            pendingId={pendingId}
            onShowDetails={(item) => openItemDetail({ kind: 'artifact', item })}
            onEquipToggle={handleEquipToggle}
            onDiscard={(item) => openDiscardConfirm(item, 'artifact')}
          />
        )}
        {activeTab === 'materials' && (
          <MaterialsTab
            materials={inventory.materials}
            isLoading={isTabLoading && inventory.materials.length === 0}
            filters={materialFilters}
            onRankFilterChange={setMaterialRankFilter}
            onTypeFilterChange={setMaterialTypeFilter}
            onElementFilterChange={setMaterialElementFilter}
            onSortChange={setMaterialSort}
            onResetFilters={resetMaterialFilters}
            onShowDetails={(item) => openItemDetail({ kind: 'material', item })}
            pendingId={pendingId}
            onIdentify={handleIdentifyMaterial}
            onDiscard={(item) => openDiscardConfirm(item, 'material')}
          />
        )}
        {activeTab === 'consumables' && (
          <ConsumablesTab
            consumables={inventory.consumables}
            isLoading={isTabLoading && inventory.consumables.length === 0}
            pendingId={pendingId}
            onShowDetails={(item) =>
              openItemDetail({ kind: 'consumable', item })
            }
            onConsume={handleConsume}
            onDiscard={(item) => openDiscardConfirm(item, 'consumable')}
          />
        )}

        {pagination.totalPages > 1 ? (
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
              disabled={
                pagination.page >= pagination.totalPages || isTabLoading
              }
              onClick={goNextPage}
            >
              下一页
            </InkButton>
          </div>
        ) : null}
      </InkSection>

      {/* 物品详情弹窗 */}
      <ItemDetailModal
        isOpen={isModalOpen}
        onClose={closeItemDetail}
        item={selectedItem}
      />

      {/* 鉴定庆祝特效 */}
      {identifyCelebration && (
        <InkIdentifyCelebration
          {...identifyCelebration}
          onComplete={clearIdentifyCelebration}
        />
      )}

      {/* 确认对话框 */}
      <InkDialog dialog={dialog} onClose={closeDialog} />
    </GameSceneFrame>
  );
}
