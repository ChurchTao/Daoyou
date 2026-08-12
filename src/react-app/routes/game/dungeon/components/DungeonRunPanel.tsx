import { ResourceCostCard } from '@app/components/dungeon/ResourceCostCard';
import {
  PillKeywordLine,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import { ArtifactListCard } from '@app/components/feature/products';
import { GameLoadingState, GameSceneTabs } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkNotice } from '@app/components/ui';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import {
  useArtifactInventoryResource,
  useConsumableInventoryResource,
} from '@app/lib/resources/inventory';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerLoadout } from '@app/lib/resources/player';
import { isQiRestoreTalismanScenario } from '@shared/config/qiSystem';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { isConditionStatusActive } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import {
  isPillConsumable,
  isTalismanConsumable,
} from '@shared/lib/consumables';
import type { DungeonState } from '@shared/lib/dungeon/types';
import { getResourceTypeLabel } from '@shared/lib/gameConceptDisplay';
import type {
  Artifact,
  Consumable,
  Cultivator,
} from '@shared/types/cultivator';
import { useCallback, useState } from 'react';

interface DungeonRunPanelProps {
  state: DungeonState;
  cultivator: Pick<Cultivator, 'realm' | 'condition'> | null;
  displayResources?: CultivatorDisplaySnapshot['resources'];
  onQuit: () => Promise<boolean>;
}

type DrawerMainTab = 'status' | 'inventory';
type DrawerInventoryTab = 'artifacts' | 'consumables';
const DRAWER_INVENTORY_PAGE_SIZE = 6;

function isDirectUseConsumable(item: Consumable) {
  return (
    isPillConsumable(item) ||
    (isTalismanConsumable(item) &&
      isQiRestoreTalismanScenario(item.spec.scenario))
  );
}

function clampPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function formatResource(
  resource: CultivatorDisplaySnapshot['resources']['hp'] | undefined,
) {
  const current = Math.max(0, Math.floor(resource?.current ?? 0));
  const max = Math.max(1, Math.floor(resource?.max ?? 1));
  return {
    current,
    max,
    percent: clampPercent(resource?.percent),
  };
}

function ResourceLine({
  label,
  resource,
  tone,
}: {
  label: string;
  resource: ReturnType<typeof formatResource>;
  tone: 'hp' | 'mp';
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-ink-secondary">{label}</span>
        <span className="text-ink tabular-nums">
          {resource.current}/{resource.max}
        </span>
      </div>
      <div className="bg-ink/10 h-1.5 overflow-hidden">
        <div
          className={
            tone === 'hp'
              ? 'bg-crimson h-full transition-[width]'
              : 'bg-tier-xuan h-full transition-[width]'
          }
          style={{ width: `${resource.percent}%` }}
        />
      </div>
    </div>
  );
}

function isEquippedArtifact(
  item: Artifact,
  equipped: {
    weapon?: string | null;
    armor?: string | null;
    accessory?: string | null;
  },
) {
  return Boolean(
    item.id &&
    (equipped.weapon === item.id ||
      equipped.armor === item.id ||
      equipped.accessory === item.id),
  );
}

export function DungeonRunPanel({
  state,
  cultivator,
  displayResources,
  onQuit,
}: DungeonRunPanelProps) {
  const loadout = usePlayerLoadout();
  const equipped = loadout.data?.equipped;
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<DrawerMainTab>('status');
  const [activeInventoryTab, setActiveInventoryTab] =
    useState<DrawerInventoryTab>('artifacts');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const inventoryOpen = drawerOpen && activeMainTab === 'inventory';
  const artifactInventory = useArtifactInventoryResource({
    pageSize: DRAWER_INVENTORY_PAGE_SIZE,
    enabled: inventoryOpen && activeInventoryTab === 'artifacts',
  });
  const consumableInventory = useConsumableInventoryResource({
    pageSize: DRAWER_INVENTORY_PAGE_SIZE,
    enabled: inventoryOpen && activeInventoryTab === 'consumables',
  });
  const isInventoryLoading =
    activeInventoryTab === 'artifacts'
      ? artifactInventory.loading
      : consumableInventory.loading;
  const hp = formatResource(displayResources?.hp);
  const mp = formatResource(displayResources?.mp);
  const activeStatuses = (cultivator?.condition?.statuses ?? []).filter(
    (status) => isConditionStatusActive(status),
  );
  const statusNames = activeStatuses
    .slice(0, 3)
    .map(
      (status) => getConditionStatusTemplate(status.key)?.name ?? status.key,
    );
  const rewardNames = (state.accumulatedRewards ?? [])
    .map((reward) => reward.name || '神秘机缘')
    .slice(-4);
  const artifacts = artifactInventory.items ?? [];
  const directUseConsumables = (consumableInventory.items ?? []).filter(
    isDirectUseConsumable,
  );

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen((value) => {
      const nextExpanded = !value;
      if (nextExpanded) {
        setActiveMainTab('status');
      }
      return nextExpanded;
    });
  }, []);

  const handleMainTabChange = useCallback((value: string) => {
    setActiveMainTab(value as DrawerMainTab);
  }, []);

  const handleInventoryTabChange = useCallback((value: string) => {
    setActiveInventoryTab(value as DrawerInventoryTab);
  }, []);

  const handleEquipToggle = useCallback(
    async (item: Artifact) => {
      if (!item.id) {
        pushToast({
          message: '此法宝暂无有效 ID，无法操作。',
          tone: 'warning',
        });
        return;
      }

      setPendingId(item.id);
      try {
        await mutate(
          fetch('/api/cultivator/equip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artifactId: item.id }),
          }),
        );

        pushToast({ message: '法宝灵性已调顺。', tone: 'success' });
      } catch (error) {
        pushToast({
          message:
            error instanceof Error
              ? `法宝操作失败：${error.message}`
              : '法宝操作失败。',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [mutate, pushToast],
  );

  const handleConsumeConsumable = useCallback(
    async (item: Consumable) => {
      if (!item.id) {
        pushToast({
          message: '此消耗品暂无有效 ID，无法使用。',
          tone: 'warning',
        });
        return;
      }

      setPendingId(item.id);
      try {
        const result = await mutate<{
          message: string;
          consumable: Consumable;
        }>(
          fetch('/api/cultivator/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumableId: item.id }),
          }),
        );

        pushToast({
          message: result.message || `${item.name}已使用。`,
          tone: 'success',
        });
      } catch (error) {
        pushToast({
          message:
            error instanceof Error
              ? `使用失败：${error.message}`
              : '使用失败。',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [mutate, pushToast],
  );

  return (
    <>
      <section className="bg-bgpaper pointer-events-none fixed inset-x-0 bottom-0 z-40 mb-0">
        <div className="border-ink/10 bg-bgpaper pointer-events-auto relative w-full border-t border-dashed pb-[calc(env(safe-area-inset-bottom)+0.7rem)] shadow md:pb-[calc(env(safe-area-inset-bottom)+0.9rem)]">
          <button
            type="button"
            onClick={handleToggleDrawer}
            className="grid w-full grid-cols-2 items-center gap-3 py-3 pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] text-left md:grid-cols-[1fr_1fr_auto] md:pr-[max(env(safe-area-inset-right),1.25rem)] md:pl-[max(env(safe-area-inset-left),1.25rem)]"
            aria-expanded={drawerOpen}
          >
            <div className="min-w-0">
              <ResourceLine
                label={getResourceTypeLabel('hp')}
                resource={hp}
                tone="hp"
              />
            </div>
            <div className="min-w-0">
              <ResourceLine
                label={getResourceTypeLabel('mp')}
                resource={mp}
                tone="mp"
              />
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 text-xs md:col-span-1 md:min-w-60">
              <span className="text-ink-secondary">
                {state.currentRound}/{state.maxRounds}轮 · 危险{' '}
                {state.dangerScore}
              </span>
              <span className="text-crimson">
                异常 {activeStatuses.length}
                <span className="text-ink-secondary ml-2">展开</span>
              </span>
            </div>
          </button>
        </div>
      </section>

      <InkDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="副本行囊"
        description={`第 ${state.currentRound}/${state.maxRounds} 轮 · 当前危险 ${state.dangerScore}`}
        size="lg"
        footer={
          <div className="flex justify-end">
            <InkButton onClick={onQuit} variant="ghost">
              放弃探索
            </InkButton>
          </div>
        }
      >
        <GameSceneTabs
          activeValue={activeMainTab}
          onChange={handleMainTabChange}
          className="text-sm"
          items={[
            { label: '副本状态', value: 'status' },
            { label: '储物袋', value: 'inventory' },
          ]}
        />

        {activeMainTab === 'status' ? (
          <div className="grid gap-4 pt-3 md:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-3 text-sm leading-7">
              <div>
                <div className="text-ink-secondary text-xs">角色状态</div>
                <p>
                  {statusNames.length > 0
                    ? `异常：${statusNames.join('、')}${activeStatuses.length > statusNames.length ? '等' : ''}`
                    : '异常：无'}
                </p>
              </div>
              <div>
                <div className="text-ink-secondary text-xs">本轮收获</div>
                <p>
                  {rewardNames.length > 0
                    ? rewardNames.join('、')
                    : '暂无明确收获'}
                </p>
              </div>
            </div>
            <ResourceCostCard
              costs={
                state.costLedger?.flatMap((entry) => entry.costs) ??
                state.summary_of_sacrifice ??
                []
              }
              hpLossPercent={state.accumulatedHpLoss}
              mpLossPercent={state.accumulatedMpLoss}
              pendingCosts={
                state.pendingAction?.costs ?? state.costPreview ?? []
              }
              compact
            />
          </div>
        ) : (
          <div className="min-w-0 space-y-3 pt-3">
            <GameSceneTabs
              activeValue={activeInventoryTab}
              onChange={handleInventoryTabChange}
              items={[
                {
                  label: getResourceTypeLabel('artifact'),
                  value: 'artifacts',
                },
                {
                  label: getResourceTypeLabel('consumable'),
                  value: 'consumables',
                },
              ]}
            />
            {activeInventoryTab === 'artifacts' ? (
              <div className="space-y-2">
                {!equipped ? (
                  loadout.error ? (
                    <InkNotice className="my-2">{loadout.error}</InkNotice>
                  ) : (
                    <GameLoadingState
                      message="正在读取装备状态……"
                      variant="inline"
                    />
                  )
                ) : !artifactInventory.data && isInventoryLoading ? (
                  <GameLoadingState message="正在检索法宝……" variant="inline" />
                ) : artifacts.length === 0 ? (
                  <InkNotice className="my-2">暂无法宝。</InkNotice>
                ) : (
                  artifacts.map((item) => {
                    const equippedNow = isEquippedArtifact(item, equipped);
                    return (
                      <ArtifactListCard
                        key={item.id ?? item.name}
                        artifact={item}
                        equipped={equippedNow}
                        actions={
                          <InkButton
                            disabled={!item.id}
                            pending={pendingId === item.id}
                            pendingLabel="操作中……"
                            onClick={() => handleEquipToggle(item)}
                          >
                            {equippedNow ? '卸下' : '装备'}
                          </InkButton>
                        }
                      />
                    );
                  })
                )}
                {(artifactInventory.pagination?.totalPages ?? 1) > 1 ? (
                  <div className="flex items-center justify-center gap-3 pt-1 text-sm">
                    <InkButton
                      disabled={
                        artifactInventory.page <= 1 || isInventoryLoading
                      }
                      onClick={artifactInventory.goPrevPage}
                    >
                      上一页
                    </InkButton>
                    <span className="text-ink-secondary">
                      {artifactInventory.page}/
                      {artifactInventory.pagination?.totalPages ?? 1}
                    </span>
                    <InkButton
                      disabled={
                        artifactInventory.page >=
                          (artifactInventory.pagination?.totalPages ?? 1) ||
                        isInventoryLoading
                      }
                      onClick={artifactInventory.goNextPage}
                    >
                      下一页
                    </InkButton>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {!consumableInventory.data && isInventoryLoading ? (
                  <GameLoadingState
                    message="正在检索消耗品……"
                    variant="inline"
                  />
                ) : directUseConsumables.length === 0 ? (
                  <InkNotice className="my-2">
                    暂无可直接使用的丹药或聚灵符。
                  </InkNotice>
                ) : (
                  directUseConsumables.map((item) => {
                    const pillDisplay = isPillConsumable(item)
                      ? toPillDisplayModel(item, {
                          realm: cultivator?.realm,
                          condition: cultivator?.condition,
                        })
                      : null;
                    return (
                      <div
                        key={item.id ?? item.name}
                        className="border-ink/15 bg-paper-dark/40 flex items-start justify-between gap-3 border border-dashed p-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="text-ink font-semibold">
                            {item.name}
                            <span className="text-ink-secondary ml-2 text-xs font-normal">
                              x{item.quantity}
                            </span>
                          </div>
                          {pillDisplay ? (
                            <PillKeywordLine
                              labels={pillDisplay.keywordLabels}
                            />
                          ) : null}
                          <p className="text-ink-secondary line-clamp-2 text-xs leading-5">
                            {pillDisplay?.effectSummary ??
                              item.description ??
                              '使用后恢复天地灵气。'}
                          </p>
                        </div>
                        <InkButton
                          variant="primary"
                          disabled={!item.id}
                          pending={pendingId === item.id}
                          pendingLabel="使用中……"
                          onClick={() => handleConsumeConsumable(item)}
                        >
                          使用
                        </InkButton>
                      </div>
                    );
                  })
                )}
                {(consumableInventory.pagination?.totalPages ?? 1) > 1 ? (
                  <div className="flex items-center justify-center gap-3 pt-1 text-sm">
                    <InkButton
                      disabled={
                        consumableInventory.page <= 1 || isInventoryLoading
                      }
                      onClick={consumableInventory.goPrevPage}
                    >
                      上一页
                    </InkButton>
                    <span className="text-ink-secondary">
                      {consumableInventory.page}/
                      {consumableInventory.pagination?.totalPages ?? 1}
                    </span>
                    <InkButton
                      disabled={
                        consumableInventory.page >=
                          (consumableInventory.pagination?.totalPages ?? 1) ||
                        isInventoryLoading
                      }
                      onClick={consumableInventory.goNextPage}
                    >
                      下一页
                    </InkButton>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </InkDetailDrawer>
    </>
  );
}
