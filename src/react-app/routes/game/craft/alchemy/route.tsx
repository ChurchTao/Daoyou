import {
  SelectedMaterialsWithDose,
} from '@app/components/feature/creation';
import { InkPageShell, InkSection } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkCard,
  InkIdentifyCelebration,
  InkInput,
  InkNotice,
  InkTabs,
  ItemShowcaseModal,
} from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { MaterialSelector } from '@app/routes/game/components/MaterialSelector';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import { isPillConsumable } from '@shared/lib/consumables';
import { cn } from '@shared/lib/cn';
import {
  getMaterialAlchemyTagLabel,
} from '@shared/lib/materialAlchemy';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import type { MaterialType } from '@shared/types/constants';
import type { Consumable, Material } from '@shared/types/cultivator';
import type {
  AlchemyFormula,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyMode,
  ConditionOperation,
  PillFamily,
} from '@shared/types/consumable';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';

const ALLOWED_MATERIAL_TYPES = [
  'herb',
  'ore',
  'monster',
  'tcdb',
  'aux',
] as const;
const CRAFT_TYPE = 'alchemy' as const;
const MAX_MATERIALS = CREATION_INPUT_CONSTRAINTS.maxMaterialKinds;
const MIN_DOSE = CREATION_INPUT_CONSTRAINTS.minQuantityPerMaterial;
const MAX_DOSE = CREATION_INPUT_CONSTRAINTS.maxQuantityPerMaterial;

type PreviewValidation = {
  valid: boolean;
  blockingReason?: string;
  warnings: string[];
};

type AlchemyPreviewResponse = {
  success: boolean;
  data?: {
    cost: {
      spiritStones: number;
    };
    canAfford: boolean;
    validation: PreviewValidation;
  };
  error?: string;
};

type FormulaProgress = {
  previousLevel: number;
  level: number;
  exp: number;
  gainedExp: number;
  leveledUp: boolean;
};

type AlchemyCraftResponse = {
  success: boolean;
  data?: {
    consumable: Consumable;
    formulaDiscovery?: AlchemyFormulaDiscoveryCandidate;
    formulaProgress?: FormulaProgress;
  };
  error?: string;
};

type FormulaListResponse = {
  success: boolean;
  data?: {
    formulas: AlchemyFormula[];
  };
  error?: string;
};

type DiscoveryConfirmResponse = {
  success: boolean;
  data?: {
    saved: boolean;
    formula?: AlchemyFormula;
  };
  error?: string;
};

function getPillFamilyLabel(family: PillFamily): string {
  switch (family) {
    case 'healing':
      return '疗伤';
    case 'mana':
      return '回元';
    case 'detox':
      return '解毒';
    case 'breakthrough':
      return '破境';
    case 'tempering':
      return '炼体';
    case 'marrow_wash':
      return '洗髓';
    case 'hybrid':
      return '复合';
  }
}

function describeOperation(operation: ConditionOperation): string {
  switch (operation.type) {
    case 'restore_resource':
      return `${operation.resource === 'hp' ? '恢复气血' : '恢复真元'} ${
        operation.mode === 'percent'
          ? `${Math.round(operation.value * 100)}%`
          : `+${operation.value}`
      }`;
    case 'change_gauge':
      return `丹毒变化 ${operation.delta > 0 ? '+' : ''}${operation.delta}`;
    case 'remove_status':
      return `移除状态 ${operation.status}`;
    case 'add_status':
      return `新增状态 ${operation.status}${
        typeof operation.usesRemaining === 'number'
          ? `（可用 ${operation.usesRemaining} 次）`
          : ''
      }`;
    case 'advance_track':
      return `推进 ${getTrackConfig(operation.track).name} +${operation.value}`;
  }
}

function formatFormulaTags(formula: AlchemyFormula): string {
  return formula.pattern.requiredTags
    .map(getMaterialAlchemyTagLabel)
    .join('、');
}

function AlchemyResultModal({
  consumable,
  formulaDiscovery,
  formulaProgress,
  isHandlingDiscovery,
  isOpen,
  onAcceptDiscovery,
  onClose,
  onRejectDiscovery,
}: {
  consumable: Consumable | null;
  formulaDiscovery: AlchemyFormulaDiscoveryCandidate | null;
  formulaProgress: FormulaProgress | null;
  isHandlingDiscovery: boolean;
  isOpen: boolean;
  onAcceptDiscovery: () => void;
  onClose: () => void;
  onRejectDiscovery: () => void;
}) {
  if (!consumable || !isPillConsumable(consumable)) {
    return null;
  }

  const meta = consumable.spec.alchemyMeta;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      icon="🧪"
      name={consumable.name}
      badges={[
        consumable.quality ? (
          <InkBadge key="quality" tier={consumable.quality}>
            {consumable.quality}
          </InkBadge>
        ) : undefined,
        <InkBadge key="family" tone="default">
          {getPillFamilyLabel(consumable.spec.family)}
        </InkBadge>,
        meta.source === 'formula' ? (
          <InkBadge key="source" tone="accent">
            丹方炼制
          </InkBadge>
        ) : undefined,
      ].filter(Boolean)}
      summary={
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-ink-secondary">稳度</div>
          <div className="text-right font-semibold">{meta.stability}</div>
          <div className="text-ink-secondary">丹毒</div>
          <div className="text-right font-semibold">{meta.toxicityRating}</div>
          <div className="text-ink-secondary">主元素</div>
          <div className="text-right font-semibold">
            {meta.dominantElement || '未显'}
          </div>
        </div>
      }
      metaSection={
        <div className="space-y-2">
          <div className="border-ink/10 rounded-md border p-3">
            <div className="text-ink-secondary mb-2 text-xs">炼制材料</div>
            <div className="text-sm">
              {meta.sourceMaterials.join('、')}
            </div>
          </div>
          <div className="border-ink/10 rounded-md border p-3">
            <div className="text-ink-secondary mb-2 text-xs">药性结果</div>
            <div className="space-y-1 text-sm">
              {consumable.spec.operations.map((operation, index) => (
                <div key={`${operation.type}-${index}`}>
                  {describeOperation(operation)}
                </div>
              ))}
            </div>
          </div>
          {formulaProgress && (
            <div className="border-ink/10 rounded-md border p-3">
              <div className="text-ink-secondary mb-2 text-xs">丹方熟练</div>
              <div className="space-y-1 text-sm">
                <div>本次熟练 +{formulaProgress.gainedExp}</div>
                <div>
                  当前等级 Lv.{formulaProgress.level}，进度 {formulaProgress.exp}
                </div>
                {formulaProgress.leveledUp && (
                  <div className="text-emerald-700">
                    丹方熟练提升：Lv.{formulaProgress.previousLevel} → Lv.{formulaProgress.level}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
      description={consumable.description}
      descriptionTitle="丹成评述"
      footer={
        formulaDiscovery ? (
          <div className="space-y-2 pt-2">
            <InkNotice tone="info">
              你已摸到一缕成方脉络：{formulaDiscovery.name}。{formulaDiscovery.patternSummary}
            </InkNotice>
            <InkActionGroup align="right">
              <InkButton
                onClick={onRejectDiscovery}
                disabled={isHandlingDiscovery}
              >
                暂不保存
              </InkButton>
              <InkButton
                variant="primary"
                onClick={onAcceptDiscovery}
                disabled={isHandlingDiscovery}
              >
                {isHandlingDiscovery ? '留方中……' : '保存丹方'}
              </InkButton>
            </InkActionGroup>
          </div>
        ) : undefined
      }
    />
  );
}

export default function AlchemyPage() {
  const {
    cultivator,
    note,
    isLoading,
    refreshCultivator,
  } = useCultivator();
  const [activeMode, setActiveMode] = useState<AlchemyMode>('improvised');
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [doseMap, setDoseMap] = useState<Record<string, number>>({});
  const [userPrompt, setUserPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdConsumable, setCreatedConsumable] = useState<Consumable | null>(null);
  const [formulaDiscovery, setFormulaDiscovery] =
    useState<AlchemyFormulaDiscoveryCandidate | null>(null);
  const [formulaProgress, setFormulaProgress] = useState<FormulaProgress | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isHandlingDiscovery, setIsHandlingDiscovery] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedSpiritStones, setEstimatedSpiritStones] = useState<number | null>(null);
  const [validation, setValidation] = useState<PreviewValidation | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [formulas, setFormulas] = useState<AlchemyFormula[]>([]);
  const [isLoadingFormulas, setIsLoadingFormulas] = useState(false);
  const [formulasError, setFormulasError] = useState<string | null>(null);
  const { pushToast } = useInkUI();
  const { pathname } = useLocation();

  const selectedFormula = useMemo(
    () => formulas.find((formula) => formula.id === selectedFormulaId) ?? null,
    [formulas, selectedFormulaId],
  );

  const loadFormulas = async (options?: {
    selectFormulaId?: string | null;
  }) => {
    setIsLoadingFormulas(true);

    try {
      const response = await fetch('/api/alchemy/formulas');
      const result: FormulaListResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '丹方列表读取失败');
      }

      setFormulas(result.data.formulas);
      setFormulasError(null);

      const preferredId = options?.selectFormulaId ?? selectedFormulaId;
      const nextSelected = result.data.formulas.find(
        (formula) => formula.id === preferredId,
      )
        ? preferredId
        : result.data.formulas[0]?.id ?? null;
      setSelectedFormulaId(nextSelected);
    } catch (error) {
      setFormulasError(
        error instanceof Error ? error.message : '丹方列表读取失败，请稍后再试。',
      );
    } finally {
      setIsLoadingFormulas(false);
    }
  };

  useEffect(() => {
    if (!cultivator) return;
    void loadFormulas();
  }, [cultivator?.id]);

  useEffect(() => {
    setStatus('');
    setCreatedConsumable(null);
    setFormulaDiscovery(null);
    setFormulaProgress(null);
    setIsResultModalOpen(false);
    setSelectedMaterialIds([]);
    setSelectedMaterialMap({});
    setDoseMap({});
    setUserPrompt('');
    setValidation(null);
    setPreviewError(null);
    setEstimatedSpiritStones(null);
    setCanAfford(true);
  }, [activeMode]);

  useEffect(() => {
    if (selectedMaterialIds.length === 0) {
      setEstimatedSpiritStones(null);
      setValidation(null);
      setCanAfford(true);
      setPreviewError(null);
      return;
    }
    if (activeMode === 'formula' && !selectedFormulaId) {
      setEstimatedSpiritStones(null);
      setValidation(null);
      setCanAfford(true);
      setPreviewError(null);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      try {
        const params = new URLSearchParams({
          craftType: CRAFT_TYPE,
          alchemyMode: activeMode,
          materialIds: selectedMaterialIds.join(','),
        });
        if (activeMode === 'formula' && selectedFormulaId) {
          params.set('formulaId', selectedFormulaId);
        }

        const response = await fetch(`/api/craft?${params.toString()}`);
        const result: AlchemyPreviewResponse = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || '炼丹预估失败');
        }

        setEstimatedSpiritStones(result.data.cost.spiritStones);
        setValidation(result.data.validation);
        setCanAfford(result.data.canAfford);
        setPreviewError(null);
      } catch (error) {
        if (cancelled) return;
        setEstimatedSpiritStones(null);
        setValidation(null);
        setCanAfford(true);
        setPreviewError(
          error instanceof Error ? error.message : '炼丹预估失败，请稍后再试。',
        );
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [activeMode, selectedFormulaId, selectedMaterialIds]);

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
          message: `丹炉承载有限，最多投入 ${MAX_MATERIALS} 种灵材`,
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
    setCreatedConsumable(null);
    setFormulaDiscovery(null);
    setFormulaProgress(null);
    setIsResultModalOpen(false);
    setSelectedMaterialIds([]);
    setSelectedMaterialMap({});
    setDoseMap({});
    setUserPrompt('');
    setValidation(null);
    setPreviewError(null);
    setEstimatedSpiritStones(null);
    setCanAfford(true);
  };

  const submitPayload = useMemo(
    () => ({
      materialIds: selectedMaterialIds,
      craftType: CRAFT_TYPE,
      alchemyMode: activeMode,
      formulaId: activeMode === 'formula' ? selectedFormulaId : undefined,
      materialQuantities: Object.fromEntries(
        selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
      ),
      userPrompt: activeMode === 'improvised' ? userPrompt.trim() : undefined,
    }),
    [activeMode, doseMap, selectedFormulaId, selectedMaterialIds, userPrompt],
  );

  const displayValidation = selectedMaterialIds.length > 0 ? validation : null;
  const displayCanAfford = selectedMaterialIds.length > 0 ? canAfford : true;

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }
    if (activeMode === 'formula' && !selectedFormulaId) {
      pushToast({ message: '请先选定丹方。', tone: 'warning' });
      return;
    }
    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '丹炉已备，只欠灵材。', tone: 'warning' });
      return;
    }
    if (activeMode === 'improvised' && !userPrompt.trim()) {
      pushToast({ message: '请先注入丹意。', tone: 'warning' });
      return;
    }
    if (previewError || validation?.valid === false || !displayCanAfford) {
      pushToast({ message: '当前炉况未稳，暂不可开炉。', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    setStatus(
      activeMode === 'formula'
        ? '丹方引火，炉势循脉而行……'
        : '地火回环，药性相搏……',
    );
    setCreatedConsumable(null);
    setFormulaDiscovery(null);
    setFormulaProgress(null);
    setIsResultModalOpen(false);

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });
      const result: AlchemyCraftResponse = await response.json();

      if (!response.ok || !result.success || !result.data?.consumable) {
        throw new Error(result.error || '炼丹失败');
      }

      const nextConsumable = result.data.consumable;
      const successMessage = `【${nextConsumable.name}】丹成！`;
      setCreatedConsumable(nextConsumable);
      setFormulaDiscovery(result.data.formulaDiscovery ?? null);
      setFormulaProgress(result.data.formulaProgress ?? null);
      setIsResultModalOpen(true);
      setCelebrationTick((prev) => prev + 1);
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setSelectedMaterialIds([]);
      setSelectedMaterialMap({});
      setDoseMap({});
      if (activeMode === 'improvised') {
        setUserPrompt('');
      }
      setValidation(null);
      setPreviewError(null);
      setEstimatedSpiritStones(null);
      setMaterialsRefreshKey((prev) => prev + 1);
      await refreshCultivator();
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `炸炉了：${error.message}`
          : '炼丹失败，请稍后再试。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscoveryDecision = async (accept: boolean) => {
    if (!formulaDiscovery) {
      return;
    }

    setIsHandlingDiscovery(true);
    try {
      const response = await fetch('/api/alchemy/formulas/discovery/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: formulaDiscovery.token,
          accept,
        }),
      });
      const result: DiscoveryConfirmResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '丹方确认失败');
      }

      if (accept && result.data.saved && result.data.formula) {
        await loadFormulas({
          selectFormulaId: result.data.formula.id,
        });
        pushToast({
          message: `已悟得【${result.data.formula.name}】`,
          tone: 'success',
        });
      } else if (!accept) {
        pushToast({
          message: '丹意散去，未留成方。',
          tone: 'default',
        });
      }

      setFormulaDiscovery(null);
    } catch (error) {
      pushToast({
        message:
          error instanceof Error
            ? error.message
            : '丹方确认失败，请稍后再试。',
        tone: 'danger',
      });
    } finally {
      setIsHandlingDiscovery(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">丹火温养中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【炼丹房】"
      subtitle="丹意引炉，药性成形"
      backHref="/game/craft"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/craft">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            {activeMode === 'formula' && selectedFormula
              ? `已选丹方：${selectedFormula.name}`
              : selectedMaterialIds.length > 0
                ? `已投入 ${selectedMaterialIds.length} 种灵材`
                : activeMode === 'formula'
                  ? '请先选定丹方，再投入灵材'
                  : '请投入灵材并注入丹意'}
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="炉法切换">
        <InkTabs
          items={[
            { label: '即兴炼丹', value: 'improvised' },
            { label: '丹方炼制', value: 'formula' },
          ]}
          activeValue={activeMode}
          onChange={(value) => setActiveMode(value as AlchemyMode)}
        />
      </InkSection>

      {activeMode === 'formula' && (
        <InkSection title="丹方总览">
          {formulasError && <InkNotice tone="warning">{formulasError}</InkNotice>}
          {isLoadingFormulas && <InkNotice>正在整理你的丹方笔录……</InkNotice>}
          {!isLoadingFormulas && formulas.length === 0 && (
            <InkNotice tone="info">
              你尚未悟得丹方。先在“即兴炼丹”中炼出稳固成丹，再尝试留方。
            </InkNotice>
          )}
          {formulas.length > 0 && (
            <div className="space-y-2">
              {formulas.map((formula) => {
                const isActive = formula.id === selectedFormulaId;
                return (
                  <button
                    key={formula.id}
                    type="button"
                    onClick={() => setSelectedFormulaId(formula.id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                      isActive
                        ? 'border-crimson bg-crimson/5'
                        : 'border-ink/10 hover:border-ink/30',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{formula.name}</span>
                      <InkBadge tone="default">
                        {getPillFamilyLabel(formula.family)}
                      </InkBadge>
                      <InkBadge tone="accent">
                        {`Lv.${formula.mastery.level}`}
                      </InkBadge>
                    </div>
                    <div className="text-ink-secondary mt-2 space-y-1 text-sm">
                      <div>核心药性：{formatFormulaTags(formula)}</div>
                      <div>
                        炉位 {formula.pattern.slotCount} 种
                        {formula.pattern.minQuality
                          ? `，最低 ${formula.pattern.minQuality}`
                          : ''}
                        {formula.pattern.dominantElement
                          ? `，主元素 ${formula.pattern.dominantElement}`
                          : ''}
                      </div>
                      {formula.pattern.optionalTags?.length ? (
                        <div>
                          辅性药性：
                          {formula.pattern.optionalTags
                            .map(getMaterialAlchemyTagLabel)
                            .join('、')}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </InkSection>
      )}

      <InkSection title={activeMode === 'formula' ? '炉材甄选' : '甄选灵材'}>
        <MaterialSelector
          cultivatorId={cultivator?.id}
          selectedMaterialIds={selectedMaterialIds}
          onToggleMaterial={toggleMaterial}
          selectedMaterialMap={selectedMaterialMap}
          isSubmitting={isSubmitting}
          pageSize={20}
          includeMaterialTypes={[...ALLOWED_MATERIAL_TYPES] as MaterialType[]}
          refreshKey={materialsRefreshKey}
          loadingText="正在检索储物袋中的灵材，请稍候……"
          emptyNoticeText="暂无可用于炼丹的材料。"
          totalText={(total) => `共 ${total} 份可用于炼丹的材料`}
        />
        <p className="text-ink-secondary mt-1 text-right text-xs">
          {selectedMaterialIds.length}/{MAX_MATERIALS}
        </p>
      </InkSection>

      <InkSection title="调度投入份数">
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

      {activeMode === 'improvised' ? (
        <InkSection title="注入丹意">
          <InkInput
            label="丹药意图（必填）"
            placeholder="比如：想炼一枚兼顾疗伤与回元、但药性不要太躁烈的丹"
            value={userPrompt}
            onChange={setUserPrompt}
            multiline
            rows={3}
            hint="AI 只会解析你的丹意方向，具体数值仍由材料药性和规则系统决定。"
            disabled={isSubmitting}
          />
        </InkSection>
      ) : (
        <InkSection title="丹方摘要">
          {selectedFormula ? (
            <InkCard variant="elevated" padding="lg">
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">
                    {selectedFormula.name}
                  </span>
                  <InkBadge tone="default">
                    {getPillFamilyLabel(selectedFormula.family)}
                  </InkBadge>
                  <InkBadge tone="accent">
                    {`熟练 Lv.${selectedFormula.mastery.level}`}
                  </InkBadge>
                </div>
                <div>核心药性：{formatFormulaTags(selectedFormula)}</div>
                <div>
                  炉位 {selectedFormula.pattern.slotCount} 种，当前熟练进度{' '}
                  {selectedFormula.mastery.exp}
                </div>
                {selectedFormula.pattern.optionalTags?.length ? (
                  <div>
                    辅性药性：
                    {selectedFormula.pattern.optionalTags
                      .map(getMaterialAlchemyTagLabel)
                      .join('、')}
                  </div>
                ) : null}
              </div>
            </InkCard>
          ) : (
            <InkNotice tone="info">先从上方选定一份丹方，再安排炉材。</InkNotice>
          )}
        </InkSection>
      )}

      <InkSection title="预计消耗">
        {estimatedSpiritStones !== null ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">
              灵石：
              <span className="font-bold text-amber-600">
                {estimatedSpiritStones}
              </span>{' '}
              枚
            </span>
            <span
              className={`text-xs ${displayCanAfford ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {displayCanAfford ? '✓ 资源充足' : '✗ 灵石不足'}
            </span>
          </div>
        ) : (
          <InkNotice>
            {activeMode === 'formula'
              ? '请先选定丹方并投入材料。'
              : '请先选择材料以查看本炉消耗。'}
          </InkNotice>
        )}

        {previewError && <InkNotice tone="warning">{previewError}</InkNotice>}
        {displayValidation?.blockingReason && (
          <InkNotice tone="warning">{displayValidation.blockingReason}</InkNotice>
        )}
        {displayValidation?.warnings.map((warning) => (
          <InkNotice key={warning} tone="info">
            {warning}
          </InkNotice>
        ))}
      </InkSection>

      <InkSection title={activeMode === 'formula' ? '按方起炉' : '开炉炼丹'}>
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
              (activeMode === 'improvised' && !userPrompt.trim()) ||
              (activeMode === 'formula' && !selectedFormulaId) ||
              !!previewError ||
              estimatedSpiritStones === null ||
              !displayCanAfford ||
              displayValidation?.valid === false
            }
          >
            {isSubmitting
              ? '丹火炼中……'
              : activeMode === 'formula'
                ? '依方成丹'
                : '开炉炼丹'}
          </InkButton>
        </InkActionGroup>
      </InkSection>

      {status && !isResultModalOpen && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      <AlchemyResultModal
        consumable={createdConsumable}
        formulaDiscovery={formulaDiscovery}
        formulaProgress={formulaProgress}
        isHandlingDiscovery={isHandlingDiscovery}
        isOpen={isResultModalOpen}
        onAcceptDiscovery={() => void handleDiscoveryDecision(true)}
        onClose={() => setIsResultModalOpen(false)}
        onRejectDiscovery={() => void handleDiscoveryDecision(false)}
      />

      {celebrationTick > 0 && (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      )}
    </InkPageShell>
  );
}
