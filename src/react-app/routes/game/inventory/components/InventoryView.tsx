import {
  GameLoadingState,
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
  GameSceneTabs,
} from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDialog } from '@app/components/ui/InkDialog';
import { InkIdentifyCelebration } from '@app/components/ui/InkIdentifyCelebration';

import { VaultWithdrawal } from '@app/components/feature/forging/VaultWithdrawal';
import { ItemDetailModal } from '@app/components/feature/items';
import { getResourceTypeLabel } from '@shared/lib/gameConceptDisplay';
import {
  useInventoryViewModel,
  type InventoryTab,
} from '../hooks/useInventoryViewModel';
import { ArtifactsTab } from './ArtifactsTab';
import { ConsumablesTab } from './ConsumablesTab';
import { MaterialsTab } from './MaterialsTab';

function getInventoryTabLabel(tab: InventoryTab): string {
  if (tab === 'artifacts') return getResourceTypeLabel('artifact');
  if (tab === 'materials') return getResourceTypeLabel('material');
  return getResourceTypeLabel('consumable');
}

/**
 * 储物袋主视图组件
 */
export function InventoryView() {
  const {
    cultivatorId,
    realm,
    condition,
    spiritStones,
    inventory,
    equipped,
    isLoading,
    isTabLoading,
    isTabRefreshing,
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
    handleConsume,
    handleIdentifyMaterial,
    openDiscardConfirm,
  } = useInventoryViewModel();

  const activeResourceReady =
    activeTab === 'artifacts'
      ? Boolean(equipped)
      : activeTab === 'consumables'
        ? Boolean(realm && condition)
        : true;

  // 加载状态
  if (isLoading && (!cultivatorId || !activeResourceReady)) {
    return <GameSceneLoading message="储物袋开启中……" />;
  }
  if (!cultivatorId || !activeResourceReady) {
    return (
      <GameSceneNote>当前分栏所需资源读取失败，请稍后重试。</GameSceneNote>
    );
  }

  const aside = (
    <>
      <GameSceneAsideSection title="行囊摘要">
        <div className="space-y-2 text-sm leading-7">
          <p>灵石：{spiritStones ?? '读取中…'}</p>
          <p>
            当前分页：{pagination.page} / {pagination.totalPages}
          </p>
          <p>
            当前分栏：
            {getInventoryTabLabel(activeTab)}
          </p>
        </div>
      </GameSceneAsideSection>

      {activeTab === 'materials' ? (
        <GameSceneAsideSection title="材料筛选">
          <div className="space-y-2 text-sm leading-7">
            <p>品阶：{materialFilters.rank || '全部'}</p>
            <p>类别：{materialFilters.type || '全部'}</p>
            <p>五行：{materialFilters.element || '全部'}</p>
            <p>
              排序：{materialFilters.sortBy} / {materialFilters.sortOrder}
            </p>
          </div>
        </GameSceneAsideSection>
      ) : null}
    </>
  );

  return (
    <GameSceneFrame
      title="【洞府宝库】"
      description="法宝、材料与消耗品都在此汇总。先点清手头资源，再决定是佩装、炼造，还是送去坊市流转。"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
      aside={aside}
    >
      <div className="space-y-4">
        {activeTab !== 'artifacts' ? <VaultWithdrawal /> : null}
        <GameSceneTabs
          activeValue={activeTab}
          onChange={(val) => setActiveTab(val as InventoryTab)}
          items={[
            { label: getResourceTypeLabel('artifact'), value: 'artifacts' },
            { label: getResourceTypeLabel('material'), value: 'materials' },
            { label: getResourceTypeLabel('consumable'), value: 'consumables' },
          ]}
        />

        {isTabRefreshing ? (
          <GameLoadingState message="正在刷新当前分栏……" variant="inline" />
        ) : null}

        {activeTab === 'artifacts' && equipped && (
          <ArtifactsTab
            artifacts={inventory.artifacts}
            isLoading={isTabLoading && inventory.artifacts.length === 0}
            onShowDetails={(item) => openItemDetail({ kind: 'artifact', item })}
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
            realm={realm}
            condition={condition}
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
          <div className="flex items-center justify-center gap-4">
            <InkButton
              disabled={pagination.page <= 1 || isTabLoading || isTabRefreshing}
              onClick={goPrevPage}
            >
              上一页
            </InkButton>
            <span className="text-ink-secondary text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <InkButton
              disabled={
                pagination.page >= pagination.totalPages ||
                isTabLoading ||
                isTabRefreshing
              }
              onClick={goNextPage}
            >
              下一页
            </InkButton>
          </div>
        ) : null}
      </div>

      {/* 物品详情弹窗 */}
      <ItemDetailModal
        isOpen={isModalOpen}
        onClose={closeItemDetail}
        item={selectedItem}
        viewerRealm={realm}
        viewerCondition={condition}
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
