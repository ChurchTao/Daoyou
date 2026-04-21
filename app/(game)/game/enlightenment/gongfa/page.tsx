'use client';

import { MaterialSelector } from '@/app/(game)/game/components/MaterialSelector';
import {
  CreationIntentPanel,
  SelectedMaterialsWithDose,
} from '@/components/feature/creation';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkNotice,
} from '@/components/ui';
import { CREATION_INPUT_CONSTRAINTS } from '@/engine/creation-v2/config/CreationBalance';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Material } from '@/types/cultivator';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const MAX_MATERIALS = CREATION_INPUT_CONSTRAINTS.maxMaterialKinds;
const MIN_DOSE = CREATION_INPUT_CONSTRAINTS.minQuantityPerMaterial;
const MAX_DOSE = CREATION_INPUT_CONSTRAINTS.maxQuantityPerMaterial;

type CostEstimate = {
  spiritStones?: number;
  comprehension?: number;
};

type CostResponse = {
  success: boolean;
  data?: {
    cost: CostEstimate;
    canAfford: boolean;
  };
};

type AffixSummary = {
  id: string;
  name: string;
  category: string;
  isPerfect: boolean;
  rollEfficiency: number;
};

type V2CreationResult = {
  id: string;
  name: string;
  quality: string | null;
  element: string | null;
  score: number;
  affixes: AffixSummary[];
  needs_replace?: boolean;
};

export default function GongfaCreationPage() {
  const router = useRouter();
  const { cultivator, refreshCultivator, note, isLoading } = useCultivator();
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [doseMap, setDoseMap] = useState<Record<string, number>>({});
  const [userPrompt, setUserPrompt] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<V2CreationResult | null>(
    null,
  );
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast, openDialog } = useInkUI();
  const pathname = usePathname();

  useEffect(() => {
    const checkPending = async () => {
      if (!cultivator) return;
      try {
        const res = await fetch('/api/craft/pending?type=create_gongfa');
        const data = await res.json();
        if (data.success && data.hasPending) {
          openDialog({
            title: '感应天机',
            content: (
              <p className="py-2">
                系统感应到道友先前参悟了一门功法，但尚未将其纳入道基。是否立即前往处理？
              </p>
            ),
            confirmLabel: '继续参悟',
            cancelLabel: '暂不处理',
            onConfirm: () => {
              router.push('/game/enlightenment/replace?type=create_gongfa');
            },
          });
        }
      } catch (e) {
        console.error('检查待定失败:', e);
      }
    };
    void checkPending();
  }, [cultivator, openDialog, router]);

  useEffect(() => {
    if (selectedMaterialIds.length > 0) {
      void fetchCostEstimate('create_gongfa', selectedMaterialIds);
    } else {
      setEstimatedCost(null);
      setCanAfford(true);
    }
  }, [selectedMaterialIds]);

  const fetchCostEstimate = async (
    craftType: string,
    materialIds: string[],
  ) => {
    try {
      const response = await fetch(
        `/api/craft?craftType=${craftType}&materialIds=${materialIds.join(',')}`,
      );
      const result: CostResponse = await response.json();
      if (result.success && result.data) {
        setEstimatedCost(result.data.cost);
        setCanAfford(result.data.canAfford);
      }
    } catch (error) {
      console.error('Failed to fetch cost estimate:', error);
    }
  };

  const toggleMaterial = (id: string, material?: Material) => {
    setSelectedMaterialIds((prev) => {
      if (prev.includes(id)) {
        setSelectedMaterialMap((map) => {
          const next = { ...map };
          delete next[id];
          return next;
        });
        setDoseMap((map) => {
          const next = { ...map };
          delete next[id];
          return next;
        });
        return prev.filter((mid) => mid !== id);
      }
      if (prev.length >= MAX_MATERIALS) {
        pushToast({
          message: `悟道精力有限，最多参悟 ${MAX_MATERIALS} 种典籍`,
          tone: 'warning',
        });
        return prev;
      }
      if (material) {
        setSelectedMaterialMap((map) => ({ ...map, [id]: material }));
        setDoseMap((map) => ({ ...map, [id]: MIN_DOSE }));
      }
      return [...prev, id];
    });
  };

  const handleDoseChange = (id: string, dose: number) => {
    const material = selectedMaterialMap[id];
    if (!material) return;
    const stock = material.quantity ?? 0;
    const clamped = Math.min(
      Math.min(MAX_DOSE, Math.max(stock, MIN_DOSE)),
      Math.max(MIN_DOSE, Math.floor(dose)),
    );
    setDoseMap((prev) => ({ ...prev, [id]: clamped }));
  };

  const resetAll = () => {
    setStatus('');
    setCreatedResult(null);
    setSelectedMaterialIds([]);
    setSelectedMaterialMap({});
    setDoseMap({});
    setUserPrompt('');
  };

  const submitPayload = useMemo(
    () => ({
      materialIds: selectedMaterialIds,
      craftType: 'create_gongfa' as const,
      materialQuantities: Object.fromEntries(
        selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
      ),
      userPrompt: userPrompt.trim() || undefined,
    }),
    [selectedMaterialIds, doseMap, userPrompt],
  );

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '请选择要参悟的功法典籍。', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    setStatus('感悟天地，参悟大道……');
    setCreatedResult(null);

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '参悟失败');
      }

      const gongfa = result.data as V2CreationResult;

      if (gongfa.needs_replace) {
        pushToast({
          message: '功法已达上限，请选择一个进行替换',
          tone: 'default',
        });
        router.push('/game/enlightenment/replace?type=create_gongfa');
        return;
      }

      setCreatedResult(gongfa);
      const successMessage = `功法【${gongfa.name}】参悟成功！`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setSelectedMaterialIds([]);
      setSelectedMaterialMap({});
      setDoseMap({});
      await refreshCultivator();
      setMaterialsRefreshKey((prev) => prev + 1);
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `走火入魔：${error.message}`
          : '参悟失败，灵感中断。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">布置静室中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【功法参悟】"
      subtitle="万法归宗，神念通玄"
      backHref="/game/enlightenment"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/enlightenment">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            {selectedMaterialIds.length > 0
              ? `已选 ${selectedMaterialIds.length} 种典籍`
              : '请选择典籍开始参悟'}
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="1. 甄选典籍">
        <MaterialSelector
          cultivatorId={cultivator?.id}
          selectedMaterialIds={selectedMaterialIds}
          onToggleMaterial={toggleMaterial}
          selectedMaterialMap={selectedMaterialMap}
          isSubmitting={isSubmitting}
          pageSize={20}
          includeMaterialTypes={['gongfa_manual', 'manual']}
          refreshKey={materialsRefreshKey}
          loadingText="正在检索可参悟典籍，请稍候……"
          emptyNoticeText="暂无可用于参悟功法的典籍。"
          totalText={(total) => `共 ${total} 部可参悟典籍`}
        />
        <p className="text-ink-secondary mt-1 text-right text-xs">
          {selectedMaterialIds.length}/{MAX_MATERIALS}
        </p>
      </InkSection>

      <InkSection title="2. 调度投入份数">
        <SelectedMaterialsWithDose
          selectedIds={selectedMaterialIds}
          materialMap={selectedMaterialMap}
          doseMap={doseMap}
          minDose={MIN_DOSE}
          maxDose={MAX_DOSE}
          disabled={isSubmitting}
          onRemove={(id) => toggleMaterial(id)}
          onDoseChange={handleDoseChange}
        />
      </InkSection>

      <InkSection title="3. 参悟意念">
        <CreationIntentPanel
          productType="gongfa"
          userPrompt={userPrompt}
          onUserPromptChange={setUserPrompt}
          disabled={isSubmitting}
        />
      </InkSection>

      <InkSection title="预计消耗">
        {estimatedCost ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">
              道心感悟：
              <span className="font-bold text-purple-600">
                {estimatedCost.comprehension}
              </span>{' '}
              点
            </span>
            <span
              className={`text-xs ${canAfford ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {canAfford ? '✓ 感悟充足' : '✗ 感悟不足'}
            </span>
          </div>
        ) : (
          <InkNotice>请先选择典籍以查看消耗</InkNotice>
        )}
      </InkSection>

      <InkSection title="4. 开始参悟">
        <InkActionGroup align="right">
          <InkButton onClick={resetAll} disabled={isSubmitting}>
            重置
          </InkButton>
          <InkButton
            variant="primary"
            onClick={handleSubmit}
            disabled={
              isSubmitting || selectedMaterialIds.length === 0 || !canAfford
            }
          >
            {isSubmitting ? '参悟中……' : '开始参悟'}
          </InkButton>
        </InkActionGroup>
      </InkSection>

      {status && !createdResult && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      {createdResult && (
        <InkSection title={`【${createdResult.name}】已纳入道基`}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {createdResult.quality && (
                <InkBadge tier={createdResult.quality as never}>
                  {createdResult.quality}
                </InkBadge>
              )}
              {createdResult.element && (
                <InkBadge tone="default">{createdResult.element}</InkBadge>
              )}
              <InkBadge tone="default">{`评分 ${createdResult.score}`}</InkBadge>
            </div>
            {createdResult.affixes.length > 0 && (
              <ul className="text-ink-secondary space-y-1 text-sm">
                {createdResult.affixes.map((a) => (
                  <li key={a.id} className="flex items-center gap-1">
                    <span>{a.isPerfect ? '✦' : '◆'}</span>
                    <span>{a.name}</span>
                    {a.isPerfect && (
                      <span className="text-amber-500 text-xs">（完美）</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </InkSection>
      )}
    </InkPageShell>
  );
}
