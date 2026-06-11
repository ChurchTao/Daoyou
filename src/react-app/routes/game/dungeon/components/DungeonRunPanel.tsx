import { GameSceneTabs } from '@app/components/game-shell';
import { ResourceCostCard } from '@app/components/dungeon/ResourceCostCard';
import {
  PillKeywordLine,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import { ArtifactListCard } from '@app/components/feature/products';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkNotice } from '@app/components/ui';
import { InkButton } from '@app/components/ui/InkButton';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { isQiRestoreTalismanScenario } from '@shared/config/qiSystem';
import { isConditionStatusActive } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { isPillConsumable, isTalismanConsumable } from '@shared/lib/consumables';
import type { DungeonState } from '@shared/lib/dungeon/types';
import type { Artifact, Consumable, Cultivator } from '@shared/types/cultivator';
import { getResourceTypeLabel } from '@shared/lib/gameConceptDisplay';
import { useCallback, useRef, useState } from 'react';

interface DungeonRunPanelProps {
  state: DungeonState;
  cultivator: Cultivator | null;
  displayResources?: CultivatorDisplaySnapshot['resources'];
  onQuit: () => Promise<boolean>;
}

type DrawerMainTab = 'status' | 'inventory';
type DrawerInventoryTab = 'artifacts' | 'consumables';
type DrawerInventoryPage = {
  items: Artifact[] | Consumable[];
  page: number;
  totalPages: number;
  isLoaded: boolean;
};

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
  const { equipped } = useCultivator();
  const { pushToast } = useInkUI();
  const { mutate } = usePlayerStateActions();
  const [expanded, setExpanded] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<DrawerMainTab>('status');
  const [activeInventoryTab, setActiveInventoryTab] =
    useState<DrawerInventoryTab>('artifacts');
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [artifactPage, setArtifactPage] = useState<DrawerInventoryPage>({
    items: [],
    page: 1,
    totalPages: 1,
    isLoaded: false,
  });
  const [pillPage, setPillPage] = useState<DrawerInventoryPage>({
    items: [],
    page: 1,
    totalPages: 1,
    isLoaded: false,
  });
  const requestSeqRef = useRef(0);
  const hp = formatResource(displayResources?.hp);
  const mp = formatResource(displayResources?.mp);
  const activeStatuses = (cultivator?.condition?.statuses ?? []).filter(
    (status) => isConditionStatusActive(status),
  );
  const statusNames = activeStatuses
    .slice(0, 3)
    .map((status) => getConditionStatusTemplate(status.key)?.name ?? status.key);
  const rewardNames = (state.accumulatedRewards ?? [])
    .map((reward) => reward.name || '神秘机缘')
    .slice(-4);
  const artifacts = artifactPage.items as Artifact[];
  const directUseConsumables = (pillPage.items as Consumable[]).filter(
    isDirectUseConsumable,
  );

  const fetchDrawerInventoryPage = useCallback(
    async (tab: DrawerInventoryTab, page = 1) => {
      const requestId = ++requestSeqRef.current;
      setIsInventoryLoading(true);
      try {
        const type = tab === 'artifacts' ? 'artifacts' : 'consumables';
        const params = new URLSearchParams({
          type,
          page: String(Math.max(1, page)),
          pageSize: String(DRAWER_INVENTORY_PAGE_SIZE),
        });
        const response = await fetch(`/api/cultivator/inventory?${params}`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '简易储物袋检索失败');
        }
        if (requestId !== requestSeqRef.current) return;

        const pagination = result.data?.pagination ?? {};
        const nextPage = Math.max(1, Number(pagination.page ?? page));
        const totalPages = Math.max(1, Number(pagination.totalPages ?? 1));
        if (tab === 'artifacts') {
          setArtifactPage({
            items: (result.data?.items ?? []) as Artifact[],
            page: nextPage,
            totalPages,
            isLoaded: true,
          });
        } else {
          setPillPage({
            items: (result.data?.items ?? []) as Consumable[],
            page: nextPage,
            totalPages,
            isLoaded: true,
          });
        }
      } catch (error) {
        pushToast({
          message:
            error instanceof Error
              ? `简易储物袋检索失败：${error.message}`
              : '简易储物袋检索失败。',
          tone: 'danger',
        });
      } finally {
        setIsInventoryLoading(false);
      }
    },
    [pushToast],
  );

  const ensureDrawerInventoryPageLoaded = useCallback(
    (tab: DrawerInventoryTab) => {
      const pageState = tab === 'artifacts' ? artifactPage : pillPage;
      if (!pageState.isLoaded) {
        void fetchDrawerInventoryPage(tab);
      }
    },
    [artifactPage, fetchDrawerInventoryPage, pillPage],
  );

  const handleToggleExpanded = useCallback(() => {
    setExpanded((value) => {
      const nextExpanded = !value;
      if (nextExpanded) {
        setActiveMainTab('status');
      }
      return nextExpanded;
    });
  }, []);

  const handleMainTabChange = useCallback(
    (value: string) => {
      const nextTab = value as DrawerMainTab;
      setActiveMainTab(nextTab);
      if (nextTab === 'inventory') {
        ensureDrawerInventoryPageLoaded(activeInventoryTab);
      }
    },
    [activeInventoryTab, ensureDrawerInventoryPageLoaded],
  );

  const handleInventoryTabChange = useCallback(
    (value: string) => {
      const nextTab = value as DrawerInventoryTab;
      setActiveInventoryTab(nextTab);
      ensureDrawerInventoryPageLoaded(nextTab);
    },
    [ensureDrawerInventoryPageLoaded],
  );

  const handleEquipToggle = useCallback(
    async (item: Artifact) => {
      if (!item.id) {
        pushToast({ message: '此法宝暂无有效 ID，无法操作。', tone: 'warning' });
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
        await fetchDrawerInventoryPage('artifacts', artifactPage.page);
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
    [artifactPage.page, fetchDrawerInventoryPage, mutate, pushToast],
  );

  const handleConsumeConsumable = useCallback(
    async (item: Consumable) => {
      if (!item.id) {
        pushToast({ message: '此消耗品暂无有效 ID，无法使用。', tone: 'warning' });
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
        await fetchDrawerInventoryPage('consumables', pillPage.page);
      } catch (error) {
        pushToast({
          message:
            error instanceof Error ? `使用失败：${error.message}` : '使用失败。',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [
      fetchDrawerInventoryPage,
      mutate,
      pillPage.page,
      pushToast,
    ],
  );

  return (
    <section className="pointer-events-none fixed inset-x-0 bottom-0 z-50 bg-bgpaper mb-0">
      <div className="border-ink/10 pointer-events-auto relative w-full border-t border-dashed bg-bgpaper shadow pb-[calc(env(safe-area-inset-bottom)+0.7rem)] md:pb-[calc(env(safe-area-inset-bottom)+0.9rem)]">
        <button
          type="button"
          onClick={handleToggleExpanded}
          className="grid w-full grid-cols-2 items-center gap-3 px-3 py-3 text-left md:grid-cols-[1fr_1fr_auto] md:px-5"
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <ResourceLine label={getResourceTypeLabel('hp')} resource={hp} tone="hp" />
          </div>
          <div className="min-w-0">
            <ResourceLine label={getResourceTypeLabel('mp')} resource={mp} tone="mp" />
          </div>
          <div className="col-span-2 flex items-center justify-between gap-3 text-xs md:col-span-1 md:min-w-60">
            <span className="text-ink-secondary">
              {state.currentRound}/{state.maxRounds}轮 · 危险 {state.dangerScore}
            </span>
            <span className="text-crimson">
              异常 {activeStatuses.length}
              <span className="text-ink-secondary ml-2">
                {expanded ? '收起' : '展开'}
              </span>
            </span>
          </div>
        </button>

        {expanded ? (
          <div className="border-ink/10 battle-scroll max-h-[70svh] overflow-y-auto border-t border-dashed px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-5 md:pt-4">
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
                  <InkButton onClick={onQuit} variant="ghost">
                    放弃探索
                  </InkButton>
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
                <div className="flex items-center justify-end gap-3">
                  {isInventoryLoading ? (
                    <span className="text-ink-secondary text-xs">检索中…</span>
                  ) : null}
                </div>
                <GameSceneTabs
                  activeValue={activeInventoryTab}
                  onChange={handleInventoryTabChange}
                  items={[
                    { label: getResourceTypeLabel('artifact'), value: 'artifacts' },
                    { label: getResourceTypeLabel('consumable'), value: 'consumables' },
                  ]}
                />
                {activeInventoryTab === 'artifacts' ? (
                  <div className="space-y-2">
                    {!artifactPage.isLoaded && isInventoryLoading ? (
                      <InkNotice className="my-2">正在检索法宝。</InkNotice>
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
                                disabled={!item.id || pendingId === item.id}
                                onClick={() => handleEquipToggle(item)}
                              >
                                {pendingId === item.id
                                  ? '操作中…'
                                  : equippedNow
                                    ? '卸下'
                                    : '装备'}
                              </InkButton>
                            }
                          />
                        );
                      })
                    )}
                    {artifactPage.totalPages > 1 ? (
                      <div className="flex items-center justify-center gap-3 pt-1 text-sm">
                        <InkButton
                          disabled={artifactPage.page <= 1 || isInventoryLoading}
                          onClick={() =>
                            fetchDrawerInventoryPage(
                              'artifacts',
                              artifactPage.page - 1,
                            )
                          }
                        >
                          上一页
                        </InkButton>
                        <span className="text-ink-secondary">
                          {artifactPage.page}/{artifactPage.totalPages}
                        </span>
                        <InkButton
                          disabled={
                            artifactPage.page >= artifactPage.totalPages ||
                            isInventoryLoading
                          }
                          onClick={() =>
                            fetchDrawerInventoryPage(
                              'artifacts',
                              artifactPage.page + 1,
                            )
                          }
                        >
                          下一页
                        </InkButton>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!pillPage.isLoaded && isInventoryLoading ? (
                      <InkNotice className="my-2">正在检索消耗品。</InkNotice>
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
                              disabled={!item.id || pendingId === item.id}
                              onClick={() => handleConsumeConsumable(item)}
                            >
                              {pendingId === item.id ? '使用中…' : '使用'}
                            </InkButton>
                          </div>
                        );
                      })
                    )}
                    {pillPage.totalPages > 1 ? (
                      <div className="flex items-center justify-center gap-3 pt-1 text-sm">
                        <InkButton
                          disabled={pillPage.page <= 1 || isInventoryLoading}
                          onClick={() =>
                            fetchDrawerInventoryPage(
                              'consumables',
                              pillPage.page - 1,
                            )
                          }
                        >
                          上一页
                        </InkButton>
                        <span className="text-ink-secondary">
                          {pillPage.page}/{pillPage.totalPages}
                        </span>
                        <InkButton
                          disabled={
                            pillPage.page >= pillPage.totalPages ||
                            isInventoryLoading
                          }
                          onClick={() =>
                            fetchDrawerInventoryPage(
                              'consumables',
                              pillPage.page + 1,
                            )
                          }
                        >
                          下一页
                        </InkButton>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
