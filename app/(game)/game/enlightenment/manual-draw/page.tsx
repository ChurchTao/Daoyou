'use client';

import { InkPageShell } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkCard,
  InkNotice,
  InkTabs,
  InkTag,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { QUALITY_ORDER, type Quality } from '@/types/constants';
import type { Material } from '@/types/cultivator';
import { getElementInfo, getMaterialTypeInfo } from '@/types/dictionaries';
import {
  buildManualDrawHref,
  MANUAL_DRAW_CONFIG,
  normalizeManualDrawKind,
  type ManualDrawKind,
  type ManualDrawResultDTO,
  type ManualDrawStatusDTO,
} from '@/types/manualDraw';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type StatusResponse = {
  success: boolean;
  data?: ManualDrawStatusDTO;
  error?: string;
};

type DrawResponse = {
  success: boolean;
  data?: ManualDrawResultDTO;
  error?: string;
};

const QUALITY_STYLE_MAP: Record<
  Quality,
  {
    cardClass: string;
    chipClass: string;
    title: string;
  }
> = {
  凡品: {
    cardClass: 'border-slate-500/20 bg-slate-500/5',
    chipClass: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
    title: '寻常所得',
  },
  灵品: {
    cardClass:
      'border-emerald-500/25 bg-emerald-500/6',
    chipClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
    title: '气机清明',
  },
  玄品: {
    cardClass:
      'border-sky-500/25 bg-sky-500/6',
    chipClass: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
    title: '灵卷浮现',
  },
  真品: {
    cardClass:
      'border-indigo-500/25 bg-indigo-500/6',
    chipClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700',
    title: '真卷现形',
  },
  地品: {
    cardClass:
      'border-amber-500/30 bg-amber-500/8',
    chipClass: 'border-amber-500/30 bg-amber-500/12 text-amber-700',
    title: '厚运入手',
  },
  天品: {
    cardClass:
      'border-orange-500/30 bg-orange-500/8',
    chipClass: 'border-orange-500/30 bg-orange-500/12 text-orange-700',
    title: '上品出世',
  },
  仙品: {
    cardClass:
      'border-rose-500/30 bg-rose-500/8',
    chipClass: 'border-rose-500/30 bg-rose-500/12 text-rose-700',
    title: '仙卷临尘',
  },
  神品: {
    cardClass:
      'border-red-600/30 bg-red-500/8',
    chipClass: 'border-red-600/30 bg-red-500/12 text-red-700',
    title: '神卷显圣',
  },
};

function MaterialMeta({ material }: { material: Material }) {
  const typeInfo = getMaterialTypeInfo(material.type);
  const elementInfo = material.element
    ? getElementInfo(material.element)
    : null;

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <InkTag tone="neutral">
        {typeInfo.icon} {typeInfo.label}
      </InkTag>
      {elementInfo && (
        <InkTag tone="neutral">
          {elementInfo.icon} {elementInfo.label}
        </InkTag>
      )}
      <InkTag tone="neutral">已放入材料背包</InkTag>
    </div>
  );
}

function sortRewardsByQuality(rewards: Material[]): Material[] {
  return [...rewards].sort((left, right) => {
    const qualityGap = QUALITY_ORDER[right.rank] - QUALITY_ORDER[left.rank];
    if (qualityGap !== 0) {
      return qualityGap;
    }
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function buildQualitySummary(rewards: Material[]) {
  const summary = new Map<Quality, number>();
  for (const reward of rewards) {
    summary.set(reward.rank, (summary.get(reward.rank) ?? 0) + 1);
  }

  return [...summary.entries()].sort(
    (left, right) => QUALITY_ORDER[right[0]] - QUALITY_ORDER[left[0]],
  );
}

function buildRemainingGroups(rewards: Material[]) {
  const groups = new Map<Quality, Material[]>();
  for (const reward of rewards) {
    const current = groups.get(reward.rank) ?? [];
    current.push(reward);
    groups.set(reward.rank, current);
  }

  return [...groups.entries()].sort(
    (left, right) => QUALITY_ORDER[right[0]] - QUALITY_ORDER[left[0]],
  );
}

function getResultHeadline(result: ManualDrawResultDTO): string {
  const highest = sortRewardsByQuality(result.rewards)[0];
  if (!highest) {
    return '气机未明';
  }

  const qualityRank = QUALITY_ORDER[highest.rank];
  if (qualityRank >= QUALITY_ORDER['神品']) return '神卷现世';
  if (qualityRank >= QUALITY_ORDER['仙品']) return '仙卷入手';
  if (qualityRank >= QUALITY_ORDER['天品']) return '上品大吉';
  return result.drawCount === 5 ? '五卷同开' : '得卷一部';
}

function ResultHeroCard({
  material,
  label,
}: {
  material: Material;
  label: string;
}) {
  const style = QUALITY_STYLE_MAP[material.rank];
  const typeInfo = getMaterialTypeInfo(material.type);

  return (
    <div
      className={`rounded-2xl border p-5 transition-transform duration-300 hover:-translate-y-0.5 ${style.cardClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.2em] uppercase">
            {label}
          </p>
          <h3 className="text-ink-primary mt-2 text-2xl font-semibold">
            {material.name}
          </h3>
        </div>
        <div className="text-4xl">{typeInfo.icon}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <InkBadge tier={material.rank} />
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${style.chipClass}`}
        >
          {style.title}
        </span>
      </div>

      <div className="mt-4">
        <MaterialMeta material={material} />
      </div>

      {material.description && (
        <p className="text-ink-secondary mt-4 text-sm leading-6">
          {material.description}
        </p>
      )}
    </div>
  );
}

function ResultMiniCard({ material }: { material: Material }) {
  const typeInfo = getMaterialTypeInfo(material.type);
  const style = QUALITY_STYLE_MAP[material.rank];

  return (
    <div
      className={`rounded-xl border p-3 transition-transform duration-300 hover:-translate-y-0.5 ${style.cardClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ink-primary truncate text-sm font-medium">
            {material.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <InkBadge tier={material.rank} compact />
          </div>
        </div>
        <span className="text-2xl">{typeInfo.icon}</span>
      </div>
      {material.description && (
        <p className="text-ink-secondary mt-3 line-clamp-3 text-xs leading-5">
          {material.description}
        </p>
      )}
    </div>
  );
}

export default function ManualDrawPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cultivator, note, isLoading, refreshInventory } = useCultivator();
  const { pushToast } = useInkUI();
  const [activeTab, setActiveTab] = useState<ManualDrawKind>(
    normalizeManualDrawKind(searchParams.get('tab')),
  );
  const [status, setStatus] = useState<ManualDrawStatusDTO>({
    talismanCounts: { gongfa: 0, skill: 0 },
  });
  const [latestResults, setLatestResults] = useState<
    Record<ManualDrawKind, ManualDrawResultDTO | null>
  >({
    gongfa: null,
    skill: null,
  });
  const [pendingDrawCount, setPendingDrawCount] = useState<1 | 5 | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  const queryTab = searchParams.get('tab');

  useEffect(() => {
    setActiveTab(normalizeManualDrawKind(queryTab));
  }, [queryTab]);

  const loadStatus = useCallback(
    async (showErrorToast = true) => {
      if (!cultivator) {
        setIsBooting(false);
        return;
      }

      setIsBooting(true);
      try {
        const response = await fetch('/api/manual-draw/status');
        const result = (await response.json()) as StatusResponse;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || '获取抽取状态失败');
        }

        setStatus(result.data);
      } catch (error) {
        if (showErrorToast) {
          pushToast({
            message:
              error instanceof Error ? error.message : '获取抽取状态失败',
            tone: 'danger',
          });
        }
      } finally {
        setIsBooting(false);
      }
    },
    [cultivator, pushToast],
  );

  useEffect(() => {
    void loadStatus(false);
  }, [loadStatus]);

  const currentConfig = MANUAL_DRAW_CONFIG[activeTab];
  const currentCount = status.talismanCounts[activeTab];
  const latestResult = latestResults[activeTab];
  const sortedRewards = useMemo(
    () => (latestResult ? sortRewardsByQuality(latestResult.rewards) : []),
    [latestResult],
  );
  const featuredReward = sortedRewards[0] ?? null;
  const remainingRewards = sortedRewards.slice(1);
  const qualitySummary = useMemo(
    () => buildQualitySummary(sortedRewards),
    [sortedRewards],
  );
  const remainingGroups = useMemo(
    () => buildRemainingGroups(remainingRewards),
    [remainingRewards],
  );

  const tabs = useMemo(
    () =>
      (
        Object.entries(MANUAL_DRAW_CONFIG) as Array<
          [ManualDrawKind, (typeof MANUAL_DRAW_CONFIG)[ManualDrawKind]]
        >
      ).map(([kind, config]) => ({
        value: kind,
        label: `${config.icon} ${config.tabLabel}`,
      })),
    [],
  );

  const handleTabChange = (value: string) => {
    const nextTab = normalizeManualDrawKind(value);
    setActiveTab(nextTab);
    router.replace(buildManualDrawHref(nextTab), { scroll: false });
  };

  const handleDraw = async (count: 1 | 5) => {
    setPendingDrawCount(count);
    try {
      const response = await fetch('/api/manual-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: activeTab, count }),
      });
      const result = (await response.json()) as DrawResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '秘籍抽取失败');
      }

      setLatestResults((prev) => ({
        ...prev,
        [activeTab]: result.data!,
      }));
      setStatus({ talismanCounts: result.data.talismanCounts });
      await refreshInventory(['materials', 'consumables']);
      pushToast({
        message:
          count === 5
            ? `${currentConfig.title} 5 连抽完成，奖励已放入背包。`
            : `${currentConfig.title}已抽出，并放入背包。`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '秘籍抽取失败',
        tone: 'danger',
      });
    } finally {
      setPendingDrawCount(null);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">正在推演卷中气机……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell
        title="【问法寻卷】"
        subtitle="需先踏入仙途，方可求取经卷"
        backHref="/game"
        currentPath={pathname}
      >
        <InkNotice>当前没有活跃角色，暂时无法求卷。</InkNotice>
      </InkPageShell>
    );
  }

  return (
    <InkPageShell
      title="【问法寻卷】"
      subtitle="请符求卷，得功法与神通秘籍"
      backHref="/game"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/inventory">查看储物袋</InkButton>
          <InkButton href="/game" variant="secondary">
            返回主界
          </InkButton>
        </InkActionGroup>
      }
    >
      <div className="space-y-6">
        <InkTabs
          items={tabs}
          activeValue={activeTab}
          onChange={handleTabChange}
        />

        {isBooting ? (
          <InkNotice>正在读取符箓数量……</InkNotice>
        ) : (
          <InkCard className="overflow-hidden p-0">
            <div className="bg-[linear-gradient(135deg,rgba(120,53,15,0.06),rgba(120,53,15,0.01))] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{currentConfig.icon}</span>
                    <div>
                      <p className="text-ink-primary text-xl font-semibold">
                        {currentConfig.tabLabel}
                      </p>
                      <p className="text-ink-secondary text-sm">
                        每次消耗 1 张 {currentConfig.talismanName}
                      </p>
                    </div>
                  </div>
                  <p className="text-ink-secondary max-w-2xl text-sm leading-6">
                    {currentConfig.intro}
                    抽到后会直接放入材料背包，可在藏经阁用于
                    {activeTab === 'gongfa' ? '参悟功法' : '推演神通'}。
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-center">
                  <p className="text-ink-secondary text-xs">剩余符箓</p>
                  <p className="text-ink-primary mt-1 text-2xl font-semibold">
                    {currentCount}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                <p className="text-ink-secondary text-xs">规则说明</p>
                <p className="text-ink-primary mt-1 text-sm leading-6">
                  {currentConfig.usageHint}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <InkButton
                  disabled={pendingDrawCount !== null || currentCount < 1}
                  onClick={() => void handleDraw(1)}
                >
                  {pendingDrawCount === 1 ? '抽取中…' : '抽 1 次'}
                </InkButton>
                <InkButton
                  variant="secondary"
                  disabled={pendingDrawCount !== null || currentCount < 5}
                  onClick={() => void handleDraw(5)}
                >
                  {pendingDrawCount === 5 ? '抽取中…' : '5 连抽'}
                </InkButton>
              </div>

              {currentCount < 1 && (
                <div className="mt-4">
                  <InkNotice>
                    {currentConfig.talismanName}不足，暂时无法抽取。
                  </InkNotice>
                </div>
              )}
            </div>
          </InkCard>
        )}

        <InkCard className="p-5">
          {!latestResult || !featuredReward ? (
            <InkNotice>
              还没有新的{currentConfig.tabLabel}
              结果。开始抽取后，最新结果会展示在这里。
            </InkNotice>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-ink-secondary text-xs">最近一次</p>
                  <h2 className="text-ink-primary mt-1 text-xl font-semibold">
                    {latestResult.drawCount === 5 ? '五连结果' : '单抽结果'}
                  </h2>
                </div>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1 text-sm font-medium text-amber-700">
                  {getResultHeadline(latestResult)}
                </span>
              </div>

              {qualitySummary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {qualitySummary.map(([quality, count]) => (
                    <span
                      key={quality}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${QUALITY_STYLE_MAP[quality].chipClass}`}
                    >
                      {quality} x {count}
                    </span>
                  ))}
                </div>
              )}

              <ResultHeroCard
                material={featuredReward}
                label={latestResult.drawCount === 5 ? '本次头彩' : '本次所得'}
              />

              {remainingGroups.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-ink-primary text-base font-medium">
                      其余 {remainingRewards.length} 本
                    </p>
                    <p className="text-ink-secondary text-sm">
                      已全部放入材料背包
                    </p>
                  </div>

                  {remainingGroups.map(([quality, materials]) => (
                    <div key={quality} className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <InkBadge tier={quality} />
                        <span className="text-ink-secondary text-sm">
                          {materials.length} 本
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {materials.map((material, index) => (
                          <ResultMiniCard
                            key={`${quality}-${material.name}-${index}`}
                            material={material}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </InkCard>
      </div>
    </InkPageShell>
  );
}
