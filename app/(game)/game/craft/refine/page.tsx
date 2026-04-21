'use client';

import { MaterialSelector } from '@/app/(game)/game/components/MaterialSelector';
import {
  CreationIntentPanel,
  SelectedMaterialsWithDose,
} from '@/components/feature/creation';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkActionGroup, InkButton, InkNotice } from '@/components/ui';
import { CREATION_INPUT_CONSTRAINTS } from '@/engine/creation-v2/config/CreationBalance';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { EquipmentSlot } from '@/types/constants';
import type { Material } from '@/types/cultivator';
import { usePathname } from 'next/navigation';
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

export default function RefinePage() {
  const { cultivator, note, isLoading } = useCultivator();
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [doseMap, setDoseMap] = useState<Record<string, number>>({});
  const [userPrompt, setUserPrompt] = useState('');
  const [requestedSlot, setRequestedSlot] = useState<EquipmentSlot | ''>('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  useEffect(() => {
    if (selectedMaterialIds.length > 0) {
      void fetchCostEstimate('refine', selectedMaterialIds);
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
          message: `炼器炉量力有限，最多投入 ${MAX_MATERIALS} 种灵材`,
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
    setSelectedMaterialIds([]);
    setSelectedMaterialMap({});
    setDoseMap({});
    setUserPrompt('');
    setRequestedSlot('');
  };

  const submitPayload = useMemo(
    () => ({
      materialIds: selectedMaterialIds,
      craftType: 'refine' as const,
      materialQuantities: Object.fromEntries(
        selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
      ),
      userPrompt: userPrompt.trim() || undefined,
      requestedSlot: requestedSlot || undefined,
    }),
    [selectedMaterialIds, doseMap, userPrompt, requestedSlot],
  );

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '巧妇难为无米之炊，请投入灵材。', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    setStatus('炉火纯青，真火锤锻……');

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '炼制失败');
      }

      const successMessage = `【${result.data.name}】出世！`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setSelectedMaterialIds([]);
      setSelectedMaterialMap({});
      setDoseMap({});
      setMaterialsRefreshKey((prev) => prev + 1);
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `炸炉了：${error.message}`
          : '炼制失败，请稍后再试。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">地火引动中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【炼器室】"
      subtitle="千锤百炼，法宝天成"
      backHref="/game/craft"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/craft">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            {selectedMaterialIds.length > 0
              ? `已投入 ${selectedMaterialIds.length} 种灵材`
              : '请投入灵材开始炼制'}
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="1. 甄选灵材">
        <MaterialSelector
          cultivatorId={cultivator?.id}
          selectedMaterialIds={selectedMaterialIds}
          onToggleMaterial={toggleMaterial}
          selectedMaterialMap={selectedMaterialMap}
          isSubmitting={isSubmitting}
          pageSize={20}
          excludeMaterialTypes={[
            'herb',
            'gongfa_manual',
            'skill_manual',
            'manual',
          ]}
          refreshKey={materialsRefreshKey}
          loadingText="正在检索储物袋中的灵材，请稍候……"
          emptyNoticeText="暂无可用于炼器的灵材。"
          totalText={(total) => `共 ${total} 条灵材记录`}
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

      <InkSection title="3. 造物意念">
        <CreationIntentPanel
          productType="artifact"
          userPrompt={userPrompt}
          onUserPromptChange={setUserPrompt}
          requestedSlot={requestedSlot}
          onRequestedSlotChange={setRequestedSlot}
          disabled={isSubmitting}
        />
      </InkSection>

      <InkSection title="预计消耗">
        {estimatedCost ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">
              灵石：
              <span className="font-bold text-amber-600">
                {estimatedCost.spiritStones}
              </span>{' '}
              枚
            </span>
            <span
              className={`text-xs ${canAfford ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {canAfford ? '✓ 资源充足' : '✗ 灵石不足'}
            </span>
          </div>
        ) : (
          <InkNotice>请先选择材料以查看消耗</InkNotice>
        )}
      </InkSection>

      <InkSection title="4. 开炉炼制">
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
            {isSubmitting ? '真火炼中……' : '开炉炼器'}
          </InkButton>
        </InkActionGroup>
      </InkSection>

      {status && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}
    </InkPageShell>
  );
}
