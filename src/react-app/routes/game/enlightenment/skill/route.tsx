import {
  CreationIntentPanel,
  CreationProductResultModal,
  MaterialSelectionModal,
  SelectedMaterialsWithDose,
  type CreationProductResultRecord,
} from '@app/components/feature/creation';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
  GameSceneSection,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkButton,
  InkChoiceButton,
  InkIdentifyCelebration,
  InkNotice,
} from '@app/components/ui';
import {
  getQiErrorMessage,
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
import { invalidateQiState } from '@app/components/feature/cultivator/useQiState';
import { QI_ACTION_COSTS } from '@shared/config/qiSystem';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import { getAllowedMaterialTypesForCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import type { Material } from '@shared/types/cultivator';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';


const CRAFT_TYPE = 'create_skill' as const;
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

type TargetPolicySelection = {
  team: 'enemy' | 'ally' | 'self' | 'any';
  scope: 'single' | 'aoe' | 'random';
  maxTargets?: number;
} | null;

const TARGET_TEAM_OPTIONS: { value: 'enemy' | 'ally' | 'self' | 'any'; label: string }[] = [
  { value: 'enemy', label: '敌方' },
  { value: 'self', label: '自身' },
  { value: 'ally', label: '友方' },
];

const TARGET_SCOPE_OPTIONS: { value: 'single' | 'aoe' | 'random'; label: string }[] = [
  { value: 'single', label: '单体' },
  { value: 'aoe', label: '范围（AOE）' },
  { value: 'random', label: '随机' },
];

export default function SkillCreationPage() {
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
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [pendingReplaceHref, setPendingReplaceHref] = useState<string | null>(null);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [validation, setValidation] = useState<PreviewValidation | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const [targetPolicy, setTargetPolicy] = useState<TargetPolicySelection>(null);
  const { pushToast, openDialog } = useInkUI();
  const { openQiActionConfirm } = useQiActionConfirm();

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
                系统感应到道友先前推演了一门神通，但尚未将其纳入道基。是否立即前往处理？
              </p>
            ),
            confirmLabel: '继续推演',
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
    setTargetPolicy(null);
    setIsMaterialModalOpen(false);
  };

  const submitPayload = useMemo(
    () => ({
      materialIds: selectedMaterialIds,
      craftType: CRAFT_TYPE,
      materialQuantities: Object.fromEntries(
        selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
      ),
      userPrompt: userPrompt.trim() || undefined,
      requestedTargetPolicy: targetPolicy ?? undefined,
    }),
    [selectedMaterialIds, doseMap, userPrompt, targetPolicy],
  );

  const displayEstimatedCost =
    selectedMaterialIds.length > 0 ? estimatedCost : null;
  const displayValidation = selectedMaterialIds.length > 0 ? validation : null;
  const displayCanAfford = selectedMaterialIds.length > 0 ? canAfford : true;
  const qiCost = QI_ACTION_COSTS.creation_skill;

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '请选择要用于推演的材料。', tone: 'warning' });
      return;
    }

    if (!targetPolicy) {
      pushToast({ message: '请选择目标策略以确定神通施法方向。', tone: 'warning' });
      return;
    }

    if (pendingReplaceHref) {
      pushToast({ message: '已有待纳入道基的新神通，请先前往处理。', tone: 'warning' });
      return;
    }

    openQiActionConfirm({
      actionName: '推演神通',
      qiCost,
      confirmLabel: '开始推演',
      onConfirm: async () => {
        setSubmitting(true);
        setStatus('感悟天地，推演法则……');
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
            throw new Error(getQiErrorMessage(result, '推演失败'));
          }

          const skill = result.data as CreationProductResultRecord;
          const successMessage = `神通【${skill.name}】推演成功！`;

          setCreatedResult(skill);
          setIsResultModalOpen(true);
          setCelebrationTick((prev) => prev + 1);
          setStatus(successMessage);
          pushToast({ message: successMessage, tone: 'success' });
          setSelectedMaterialIds([]);
          setSelectedMaterialMap({});
          setDoseMap({});
          setIsMaterialModalOpen(false);
          invalidateQiState(cultivator.id);
          setMaterialsRefreshKey((prev) => prev + 1);

          if (skill.needs_replace) {
            setPendingReplaceHref(`/game/enlightenment/replace?type=${CRAFT_TYPE}`);
            return;
          }

          setPendingReplaceHref(null);
          await refreshCultivator();
        } catch (error) {
          const failMessage =
            error instanceof Error
              ? `走火入魔：${error.message}`
              : '推演失败，灵感中断。';
          setStatus(failMessage);
          pushToast({ message: failMessage, tone: 'danger' });
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">入定冥想中……</p>
      </div>
    );
  }

  const targetPolicySummary = targetPolicy
    ? [
        TARGET_TEAM_OPTIONS.find((option) => option.value === targetPolicy.team)?.label,
        targetPolicy.team === 'self'
          ? null
          : TARGET_SCOPE_OPTIONS.find((option) => option.value === targetPolicy.scope)
              ?.label,
      ]
        .filter(Boolean)
        .join(' · ')
    : '未指定';

  return (
    <GameSceneFrame
      variant="workflow"
      title="【神通推演】"
      description="神通推演属于典型工作流页，保留原有推演逻辑，把材料、目标策略与道心消耗统一收束到同一壳内。"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
      aside={
        <>
          <GameSceneAsideSection title="推演摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>已选材料：{selectedMaterialIds.length} / {MAX_MATERIALS}</p>
              <p>目标策略：{targetPolicySummary}</p>
              <p>预计感悟：{displayEstimatedCost?.comprehension ?? 0}</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="推演提醒"
            className="text-sm leading-7"
            help={{
              title: '神通推演提醒',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>目标策略是必填项，决定神通的施法方向与覆盖范围。</p>
                  <p>若已有待纳入的新神通，请先处理旧术取舍。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
      <GameSceneSection title="目标策略">
        <p className="text-ink-secondary mb-3 text-xs">
          指定神通的施法目标倾向。
          <span className="text-crimson ml-1">（必选）</span>
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-ink-secondary mb-1.5 text-xs">目标阵营</p>
            <div className="flex flex-wrap gap-2">
              {TARGET_TEAM_OPTIONS.map((opt) => (
                <InkChoiceButton
                  key={opt.value}
                  disabled={isSubmitting}
                  onClick={() =>
                    setTargetPolicy((prev) => ({
                      team: opt.value,
                      scope: opt.value === 'self' ? 'single' : (prev?.scope ?? 'single'),
                    }))
                  }
                  selected={targetPolicy?.team === opt.value}
                >
                  {opt.label}
                </InkChoiceButton>
              ))}
            </div>
          </div>
          {targetPolicy && targetPolicy.team !== 'self' && (
            <div>
              <p className="text-ink-secondary mb-1.5 text-xs">目标范围</p>
              <div className="flex flex-wrap gap-2">
                {TARGET_SCOPE_OPTIONS.map((opt) => (
                  <InkChoiceButton
                    key={opt.value}
                    disabled={isSubmitting}
                    onClick={() =>
                      setTargetPolicy((prev) =>
                        prev ? { ...prev, scope: opt.value } : null,
                      )
                    }
                    selected={targetPolicy.scope === opt.value}
                  >
                    {opt.label}
                  </InkChoiceButton>
                ))}
              </div>
            </div>
          )}
          {targetPolicy && (
            <p className="text-ink-secondary text-xs">
              已指定：
              <span className="text-wood">
                {TARGET_TEAM_OPTIONS.find((o) => o.value === targetPolicy.team)?.label}
                {targetPolicy.team !== 'self' && (
                  <>
                    ·
                    {TARGET_SCOPE_OPTIONS.find((o) => o.value === targetPolicy.scope)?.label}
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      </GameSceneSection>

      <GameSceneSection title="推演意念">
        <CreationIntentPanel
          productType="skill"
          userPrompt={userPrompt}
          onUserPromptChange={setUserPrompt}
          disabled={isSubmitting}
        />
      </GameSceneSection>

      <GameSceneSection title="推演材料">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm leading-7">
            已选 {selectedMaterialIds.length} / {MAX_MATERIALS} 种材料
          </p>
          <InkButton
            variant="outline"
            onClick={() => setIsMaterialModalOpen(true)}
            disabled={isSubmitting}
          >
            打开材料
          </InkButton>
        </div>
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
      </GameSceneSection>

      <GameSceneSection title="预计消耗">
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
      </GameSceneSection>

      <GameSceneSection title="开始推演">
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
              !targetPolicy ||
              !!pendingReplaceHref ||
              !displayCanAfford ||
              displayValidation?.valid === false
            }
          >
            {isSubmitting ? '推演中……' : '开始推演'}
          </InkButton>
        </InkActionGroup>
      </GameSceneSection>

      {status && !createdResult && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      {pendingReplaceHref && (
        <div className="mt-4 space-y-3">
          <InkNotice tone="warning">
            已有一门待纳入道基的新神通，请先处理取舍，再继续推演。
          </InkNotice>
          <InkActionGroup align="right">
            <InkButton href={pendingReplaceHref} variant="secondary">
              前往处理
            </InkButton>
          </InkActionGroup>
        </div>
      )}

      <MaterialSelectionModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        title="甄选推演材料"
        maxMaterials={MAX_MATERIALS}
        cultivatorId={cultivator?.id}
        selectedMaterialIds={selectedMaterialIds}
        onToggleMaterial={toggleMaterial}
        selectedMaterialMap={selectedMaterialMap}
        isSubmitting={isSubmitting}
        pageSize={20}
        includeMaterialTypes={ALLOWED_MATERIAL_TYPES}
        refreshKey={materialsRefreshKey}
        loadingText="正在检索可用于推演的材料，请稍候……"
        emptyNoticeText="暂无可用于推演神通的材料。"
        totalText={(total) => `共 ${total} 份可用于推演的材料`}
      />

      <CreationProductResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        product={createdResult}
        footer={
          createdResult?.needs_replace && pendingReplaceHref ? (
            <div className="space-y-3 pt-2">
              <InkNotice tone="warning">
                神通栏已满，请先择一门旧术让位，方可将新神通纳入道基。
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
    </GameSceneFrame>
  );
}
