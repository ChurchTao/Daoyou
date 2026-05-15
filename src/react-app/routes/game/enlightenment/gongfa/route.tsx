import { MaterialSelector } from '@app/routes/game/components/MaterialSelector';
import {
  CreationIntentPanel, CreationProductResultModal, SelectedMaterialsWithDose, type CreationProductResultRecord, } from '@app/components/feature/creation';
import { InkPageShell, InkSection } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup, InkButton, InkIdentifyCelebration, InkNotice, } from '@app/components/ui';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import { getAllowedMaterialTypesForCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import type { Material } from '@shared/types/cultivator';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';


const CRAFT_TYPE = 'create_gongfa' as const;
const ALLOWED_MATERIAL_TYPES = [...getAllowedMaterialTypesForCraftType(CRAFT_TYPE)];
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
    validation: PreviewValidation | null;
  };
};

type PreviewValidation = {
  valid: boolean;
  blockingReason?: string;
  warnings: string[];
  missingMatchingManual: boolean;
};

export default function GongfaCreationPage() {
  const navigate = useNavigate();
  const { cultivator, refreshCultivator, note, isLoading } = useCultivator();
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [doseMap, setDoseMap] = useState<Record<string, number>>({});
  const [userPrompt, setUserPrompt] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] =
    useState<CreationProductResultRecord | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [pendingReplaceHref, setPendingReplaceHref] = useState<string | null>(null);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [validation, setValidation] = useState<PreviewValidation | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast, openDialog } = useInkUI();
  const { pathname } = useLocation();

  useEffect(() => {
    const checkPending = async () => {
      if (!cultivator) return;
      const replaceHref = `/game/enlightenment/replace?type=${CRAFT_TYPE}`;
      try {
        const res = await fetch(`/api/craft/pending?type=${CRAFT_TYPE}`);
        const data = await res.json();
        if (data.success && data.hasPending) {
          setPendingReplaceHref(replaceHref);
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
              navigate(replaceHref);
            },
          });
        } else {
          setPendingReplaceHref(null);
        }
      } catch (e) {
        console.error('检查待定失败:', e);
      }
    };
    void checkPending();
  }, [cultivator, navigate, openDialog]);

  useEffect(() => {
    if (selectedMaterialIds.length === 0) {
      return;
    }

    let cancelled = false;

    const loadCostEstimate = async () => {
      try {
        const response = await fetch(
          `/api/craft?craftType=${CRAFT_TYPE}&materialIds=${selectedMaterialIds.join(',')}`,
        );
        const result: CostResponse = await response.json();
        if (!cancelled && result.success && result.data) {
          setEstimatedCost(result.data.cost);
          setCanAfford(result.data.canAfford);
          setValidation(result.data.validation);
        }
      } catch (error) {
        if (!cancelled) {
          setValidation(null);
          console.error('Failed to fetch cost estimate:', error);
        }
      }
    };

    void loadCostEstimate();

    return () => {
      cancelled = true;
    };
  }, [selectedMaterialIds]);

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
          message: `悟道精力有限，最多参悟 ${MAX_MATERIALS} 种材料`,
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
    setIsResultModalOpen(false);
    setSelectedMaterialIds([]);
    setSelectedMaterialMap({});
    setDoseMap({});
    setUserPrompt('');
    setValidation(null);
  };

  const submitPayload = useMemo(
    () => ({
      materialIds: selectedMaterialIds,
      craftType: CRAFT_TYPE,
      materialQuantities: Object.fromEntries(
        selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
      ),
      userPrompt: userPrompt.trim() || undefined,
    }),
    [selectedMaterialIds, doseMap, userPrompt],
  );

  const displayEstimatedCost =
    selectedMaterialIds.length > 0 ? estimatedCost : null;
  const displayValidation = selectedMaterialIds.length > 0 ? validation : null;
  const displayCanAfford = selectedMaterialIds.length > 0 ? canAfford : true;

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '请选择要用于参悟的材料。', tone: 'warning' });
      return;
    }

    if (pendingReplaceHref) {
      pushToast({ message: '已有待纳入道基的新功法，请先前往处理。', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    setStatus('感悟天地，参悟大道……');
    setCreatedResult(null);
    setIsResultModalOpen(false);

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

      const gongfa = result.data as CreationProductResultRecord;
      const successMessage = `功法【${gongfa.name}】参悟成功！`;

      setCreatedResult(gongfa);
      setIsResultModalOpen(true);
      setCelebrationTick((prev) => prev + 1);
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setSelectedMaterialIds([]);
      setSelectedMaterialMap({});
      setDoseMap({});
      setMaterialsRefreshKey((prev) => prev + 1);

      if (gongfa.needs_replace) {
        setPendingReplaceHref(`/game/enlightenment/replace?type=${CRAFT_TYPE}`);
        return;
      }

      setPendingReplaceHref(null);
      await refreshCultivator();
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
              ? `已选 ${selectedMaterialIds.length} 种材料`
              : '请选择材料开始参悟'}
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="1. 甄选材料">
        <MaterialSelector
          cultivatorId={cultivator?.id}
          selectedMaterialIds={selectedMaterialIds}
          onToggleMaterial={toggleMaterial}
          selectedMaterialMap={selectedMaterialMap}
          isSubmitting={isSubmitting}
          pageSize={20}
          includeMaterialTypes={ALLOWED_MATERIAL_TYPES}
          refreshKey={materialsRefreshKey}
          loadingText="正在检索可用于参悟的材料，请稍候……"
          emptyNoticeText="暂无可用于参悟功法的材料。"
          totalText={(total) => `共 ${total} 份可用于参悟的材料`}
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
        {displayEstimatedCost ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between border border-dashed p-3">
            <span className="text-sm">
              道心感悟：
              <span className="text-tier-di font-bold">
                {displayEstimatedCost.comprehension}
              </span>{' '}
              点
            </span>
            <span
              className={`text-xs ${displayCanAfford ? 'text-teal' : 'text-crimson'}`}
            >
              {displayCanAfford ? '✓ 感悟充足' : '✗ 感悟不足'}
            </span>
          </div>
        ) : (
          <InkNotice>请先选择材料以查看消耗</InkNotice>
        )}

        {displayValidation?.blockingReason && (
          <InkNotice tone="warning">{displayValidation.blockingReason}</InkNotice>
        )}
        {displayValidation &&
          displayValidation.valid &&
          displayValidation.warnings.length > 0 && (
          <InkNotice tone="info">{displayValidation.warnings[0]}</InkNotice>
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
              isSubmitting ||
              selectedMaterialIds.length === 0 ||
              !!pendingReplaceHref ||
              !displayCanAfford ||
              displayValidation?.valid === false
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

      {pendingReplaceHref && (
        <div className="mt-4 space-y-3">
          <InkNotice tone="warning">
            已有一门待纳入道基的新功法，请先处理取舍，再继续参悟。
          </InkNotice>
          <InkActionGroup align="right">
            <InkButton href={pendingReplaceHref} variant="secondary">
              前往处理
            </InkButton>
          </InkActionGroup>
        </div>
      )}

      <CreationProductResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        product={createdResult}
        footer={
          createdResult?.needs_replace && pendingReplaceHref ? (
            <div className="space-y-3 pt-2">
              <InkNotice tone="warning">
                功法栏已满，请先择一门旧法让位，方可将新功法纳入道基。
              </InkNotice>
              <InkActionGroup align="right">
                <InkButton href={pendingReplaceHref} variant="primary">
                  前往处理
                </InkButton>
              </InkActionGroup>
            </div>
          ) : undefined
        }
      />

      {celebrationTick > 0 && (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      )}
    </InkPageShell>
  );
}
