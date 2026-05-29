import {
  PillDetailGroups,
  getPillFamilyLabel,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import {
  MaterialSelector,
  SelectedMaterialsWithDose,
} from '@app/components/feature/creation';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
  GameSceneSection,
  GameSceneTabs,
} from '@app/components/game-shell';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkCard,
  InkDialog,
  InkIdentifyCelebration,
  InkInput,
  InkNotice,
  ItemShowcaseModal,
  type InkDialogState,
} from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import { cn } from '@shared/lib/cn';
import { isPillConsumable } from '@shared/lib/consumables';
import { getMaterialAlchemyTagLabel } from '@shared/lib/materialAlchemy';
import type { MaterialType, RealmType } from '@shared/types/constants';
import type {
  AlchemyFormula,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyMode,
} from '@shared/types/consumable';
import type { Consumable, Material } from '@shared/types/cultivator';
import { useEffect, useMemo, useState } from 'react';

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

type PreviewState = {
  key: string | null;
  estimatedSpiritStones: number | null;
  validation: PreviewValidation | null;
  canAfford: boolean;
  previewError: string | null;
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

type FormulaDeleteResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

const DEFAULT_PREVIEW_STATE: PreviewState = {
  key: null,
  estimatedSpiritStones: null,
  validation: null,
  canAfford: true,
  previewError: null,
};

function resolvePreferredFormulaId(
  formulas: AlchemyFormula[],
  preferredId: string | null,
): string | null {
  return formulas.find((formula) => formula.id === preferredId)
    ? preferredId
    : (formulas[0]?.id ?? null);
}

export function getNextSelectedFormulaIdAfterDelete(
  formulas: AlchemyFormula[],
  deletedFormulaId: string,
  currentSelectedFormulaId: string | null,
): string | null {
  const remainingFormulas = formulas.filter(
    (formula) => formula.id !== deletedFormulaId,
  );
  const preferredId =
    currentSelectedFormulaId === deletedFormulaId
      ? null
      : currentSelectedFormulaId;

  return resolvePreferredFormulaId(remainingFormulas, preferredId);
}

function formatFormulaTags(formula: AlchemyFormula): string {
  return formula.pattern.requiredTags
    .map(getMaterialAlchemyTagLabel)
    .join('、');
}

export function AlchemyGuideModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title="炉理指引"
      className="max-w-lg"
    >
      <div className="space-y-4 text-sm leading-7">
        <section>
          <div className="text-battle-muted mb-2 text-[0.75rem] tracking-[0.2em]">
            药路趋向
          </div>
          <div className="space-y-1 text-ink-secondary">
            <p>草木多引生机，则丹势常偏疗伤与回元；火雷燥烈，则更易逼出破境之锋。</p>
            <p>矿骨重躯壳，常把药力牵向炼体与洗髓；若炉中养气之材得势，亦可缓缓积修。</p>
            <p>心识澄明之物不必暴烈，若能收束杂念，往往更容易引出启悟之丹。</p>
          </div>
        </section>

        <section>
          <div className="text-battle-muted mb-2 text-[0.75rem] tracking-[0.2em]">
            材性偏向
          </div>
          <div className="space-y-1 text-ink-secondary">
            <p>金水草木易养元，若药性不散，常能将炉火化作绵长修为。</p>
            <p>水冰矿辅多启悟，风寒清材若配得当，往往比烈火之物更能开阔心境。</p>
            <p>若一炉兼纳多条药路，丹意虽广，最终多半只会留下最强的一脉。</p>
          </div>
        </section>

        <section>
          <div className="text-battle-muted mb-2 text-[0.75rem] tracking-[0.2em]">
            炉火提醒
          </div>
          <div className="space-y-1 text-ink-secondary">
            <p>药性越杂，炉势越浮。稳度若失，成丹虽未必废，却常会折损药力。</p>
            <p>修为丹可细水长流，但道基自有承载之限，不宜把它当作无穷无尽的捷径。</p>
            <p>感悟丹不记此限，却也未必次次见效如新，仍需看你此刻心神是否澄明。</p>
          </div>
        </section>
      </div>
    </InkModal>
  );
}

export function FormulaNarrativeBlock({
  formula,
  showMasteryExp = false,
}: {
  formula: AlchemyFormula;
  showMasteryExp?: boolean;
}) {
  return (
    <div className="text-ink-secondary mt-2 space-y-1 text-sm">
      <div>{formula.description}</div>
      <div>核心药性：{formatFormulaTags(formula)}</div>
      <div>
        炉位 {formula.pattern.slotCount} 种
        {formula.pattern.minQuality ? `，最低 ${formula.pattern.minQuality}` : ''}
        {formula.pattern.dominantElement
          ? `，主元素 ${formula.pattern.dominantElement}`
          : ''}
        {showMasteryExp ? `，当前熟练进度 ${formula.mastery.exp}` : ''}
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
  );
}

export function AlchemyFormulaSummaryCard({
  formula,
  isDeleting,
  onDelete,
}: {
  formula: AlchemyFormula;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <InkCard variant="elevated" padding="lg">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">{formula.name}</span>
          <InkBadge tone="default">
            {getPillFamilyLabel(formula.family)}
          </InkBadge>
          <InkBadge tone="accent">
            {`熟练 Lv.${formula.mastery.level}`}
          </InkBadge>
        </div>
        <FormulaNarrativeBlock formula={formula} showMasteryExp />
        <InkActionGroup align="right">
          <InkButton
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-crimson hover:text-crimson/80"
          >
            {isDeleting ? '删除中……' : '删除丹方'}
          </InkButton>
        </InkActionGroup>
      </div>
    </InkCard>
  );
}

export function AlchemyResultModal({
  consumable,
  formulaProgress,
  isOpen,
  onClose,
  viewerRealm,
}: {
  consumable: Consumable | null;
  formulaProgress: FormulaProgress | null;
  isOpen: boolean;
  onClose: () => void;
  viewerRealm?: RealmType;
}) {
  if (!consumable || !isPillConsumable(consumable)) {
    return null;
  }

  const model = toPillDisplayModel(consumable, { realm: viewerRealm });
  const meta = consumable.spec.alchemyMeta;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      icon="🌕"
      name={consumable.name}
      badges={[
        consumable.quality ? (
          <InkBadge key="quality" tier={consumable.quality}>
            {consumable.type}
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
      metaSection={
        <div className="space-y-2">
          <div className="border-border/50 flex justify-between border-b pb-2">
            <span className="opacity-70">出炉份数</span>
            <span className="font-bold">{consumable.quantity}</span>
          </div>
          <PillDetailGroups groups={model.detailGroups} />
          {formulaProgress && (
            <div className="border-ink/10 border border-dashed p-3">
              <div className="text-ink-secondary mb-2 text-xs">丹方熟练</div>
              <div className="space-y-1 text-sm">
                <div>本次熟练 +{formulaProgress.gainedExp}</div>
                <div>
                  当前等级 Lv.{formulaProgress.level}，进度{' '}
                  {formulaProgress.exp}
                </div>
                {formulaProgress.leveledUp && (
                  <div className="text-emerald-700">
                    丹方熟练提升：Lv.{formulaProgress.previousLevel} → Lv.
                    {formulaProgress.level}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
      description={consumable.description}
      descriptionTitle="丹成评述"
    />
  );
}

export function AlchemyFormulaDiscoveryModal({
  formulaDiscovery,
  isHandlingDiscovery,
  isOpen,
  onAcceptDiscovery,
  onRejectDiscovery,
}: {
  formulaDiscovery: AlchemyFormulaDiscoveryCandidate | null;
  isHandlingDiscovery: boolean;
  isOpen: boolean;
  onAcceptDiscovery: () => void;
  onRejectDiscovery: () => void;
}) {
  if (!formulaDiscovery) {
    return null;
  }

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={() => undefined}
      icon="📜"
      name={formulaDiscovery.name}
      badges={[
        <InkBadge key="discovery" tone="accent">
          新悟丹方
        </InkBadge>,
        <InkBadge key="family" tone="default">
          {getPillFamilyLabel(formulaDiscovery.family)}
        </InkBadge>,
      ]}
      metaSection={
        <div className="space-y-2">
          <InkNotice tone="info">
            <div className="space-y-1">
              <div>{formulaDiscovery.discoveryRemark}</div>
              <div className="text-ink-secondary text-xs">
                {formulaDiscovery.patternSummary}
              </div>
            </div>
          </InkNotice>
        </div>
      }
      description={formulaDiscovery.description}
      descriptionTitle="留方记述"
      footer={
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
      }
    />
  );
}

export default function AlchemyPage() {
  const { cultivator, note, isLoading, refreshCultivator } = useCultivator();
  const cultivatorId = cultivator?.id ?? null;
  const [activeMode, setActiveMode] = useState<AlchemyMode>('improvised');
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(
    null,
  );
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [doseMap, setDoseMap] = useState<Record<string, number>>({});
  const [userPrompt, setUserPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdConsumable, setCreatedConsumable] = useState<Consumable | null>(
    null,
  );
  const [formulaDiscovery, setFormulaDiscovery] =
    useState<AlchemyFormulaDiscoveryCandidate | null>(null);
  const [formulaProgress, setFormulaProgress] =
    useState<FormulaProgress | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [isHandlingDiscovery, setIsHandlingDiscovery] = useState(false);
  const [isDeletingFormula, setIsDeletingFormula] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [previewState, setPreviewState] = useState<PreviewState>(
    DEFAULT_PREVIEW_STATE,
  );
  const [formulas, setFormulas] = useState<AlchemyFormula[]>([]);
  const [formulasError, setFormulasError] = useState<string | null>(null);
  const [loadedFormulaCultivatorId, setLoadedFormulaCultivatorId] = useState<
    string | null
  >(null);
  const { pushToast } = useInkUI();
  const isLoadingFormulas =
    Boolean(cultivatorId) && loadedFormulaCultivatorId !== cultivatorId;

  const selectedFormula = useMemo(
    () => formulas.find((formula) => formula.id === selectedFormulaId) ?? null,
    [formulas, selectedFormulaId],
  );

  const loadFormulas = async (options?: {
    selectFormulaId?: string | null;
  }) => {
    if (!cultivatorId) {
      return;
    }

    try {
      const response = await fetch('/api/alchemy/formulas');
      const result: FormulaListResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '丹方列表读取失败');
      }

      const nextFormulas = result.data.formulas;

      setFormulas(nextFormulas);
      setFormulasError(null);
      setSelectedFormulaId((currentSelected) => {
        const preferredId = options?.selectFormulaId ?? currentSelected;
        return resolvePreferredFormulaId(nextFormulas, preferredId);
      });
    } catch (error) {
      setFormulasError(
        error instanceof Error
          ? error.message
          : '丹方列表读取失败，请稍后再试。',
      );
    } finally {
      setLoadedFormulaCultivatorId(cultivatorId);
    }
  };

  useEffect(() => {
    if (!cultivatorId) {
      return;
    }

    let cancelled = false;

    const loadInitialFormulas = async () => {
      try {
        const response = await fetch('/api/alchemy/formulas');
        const result: FormulaListResponse = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || '丹方列表读取失败');
        }

        const nextFormulas = result.data.formulas;

        setFormulas(nextFormulas);
        setFormulasError(null);
        setSelectedFormulaId((currentSelected) =>
          resolvePreferredFormulaId(nextFormulas, currentSelected),
        );
      } catch (error) {
        if (cancelled) return;
        setFormulasError(
          error instanceof Error
            ? error.message
            : '丹方列表读取失败，请稍后再试。',
        );
      } finally {
        if (!cancelled) {
          setLoadedFormulaCultivatorId(cultivatorId);
        }
      }
    };

    void loadInitialFormulas();

    return () => {
      cancelled = true;
    };
  }, [cultivatorId]);

  const previewRequest = useMemo(() => {
    if (selectedMaterialIds.length === 0) {
      return null;
    }
    if (activeMode === 'formula' && !selectedFormulaId) {
      return null;
    }

    const params = new URLSearchParams({
      craftType: CRAFT_TYPE,
      alchemyMode: activeMode,
      materialIds: selectedMaterialIds.join(','),
    });
    if (activeMode === 'formula' && selectedFormulaId) {
      params.set('formulaId', selectedFormulaId);
    }

    return {
      key: `${activeMode}:${selectedFormulaId ?? ''}:${selectedMaterialIds.join(',')}`,
      url: `/api/craft?${params.toString()}`,
    };
  }, [activeMode, selectedFormulaId, selectedMaterialIds]);

  useEffect(() => {
    if (!previewRequest) {
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      try {
        const response = await fetch(previewRequest.url);
        const result: AlchemyPreviewResponse = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || '炼丹预估失败');
        }

        setPreviewState({
          key: previewRequest.key,
          estimatedSpiritStones: result.data.cost.spiritStones,
          validation: result.data.validation,
          canAfford: result.data.canAfford,
          previewError: null,
        });
      } catch (error) {
        if (cancelled) return;
        setPreviewState({
          key: previewRequest.key,
          estimatedSpiritStones: null,
          validation: null,
          canAfford: true,
          previewError:
            error instanceof Error
              ? error.message
              : '炼丹预估失败，请稍后再试。',
        });
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [previewRequest]);

  const resetWorkbench = () => {
    setStatus('');
    setCreatedConsumable(null);
    setFormulaDiscovery(null);
    setFormulaProgress(null);
    setIsResultModalOpen(false);
    setIsDiscoveryModalOpen(false);
    setSelectedMaterialIds([]);
    setSelectedMaterialMap({});
    setDoseMap({});
    setUserPrompt('');
    setPreviewState(DEFAULT_PREVIEW_STATE);
  };

  const handleModeChange = (value: string) => {
    const nextMode = value as AlchemyMode;
    if (nextMode === activeMode) {
      return;
    }

    setActiveMode(nextMode);
    resetWorkbench();
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
    resetWorkbench();
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

  const hasFreshPreview = previewState.key === previewRequest?.key;
  const estimatedSpiritStones = hasFreshPreview
    ? previewState.estimatedSpiritStones
    : null;
  const validation = hasFreshPreview ? previewState.validation : null;
  const canAfford = hasFreshPreview ? previewState.canAfford : true;
  const previewError = hasFreshPreview ? previewState.previewError : null;
  const displayValidation = validation;
  const displayCanAfford = canAfford;

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
    setIsDiscoveryModalOpen(false);

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
      const discoveredFormula = result.data.formulaDiscovery ?? null;
      const successMessage = `【${nextConsumable.name}】丹成！`;
      setCreatedConsumable(nextConsumable);
      setFormulaDiscovery(discoveredFormula);
      setFormulaProgress(result.data.formulaProgress ?? null);
      setIsResultModalOpen(true);
      setIsDiscoveryModalOpen(false);
      setCelebrationTick((prev) => prev + 1);
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setSelectedMaterialIds([]);
      setSelectedMaterialMap({});
      setDoseMap({});
      if (activeMode === 'improvised') {
        setUserPrompt('');
      }
      setPreviewState(DEFAULT_PREVIEW_STATE);
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
      setIsDiscoveryModalOpen(false);
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '丹方确认失败，请稍后再试。',
        tone: 'danger',
      });
    } finally {
      setIsHandlingDiscovery(false);
    }
  };

  const openDeleteFormulaConfirm = (formula: AlchemyFormula) => {
    setDialog({
      id: `delete-formula-${formula.id}`,
      title: '删除丹方',
      content: (
        <div className="space-y-2 py-2 text-center">
          <p>
            确定要删去{' '}
            <span className="text-ink-primary font-bold">{formula.name}</span>{' '}
            吗？
          </p>
          <p className="text-ink-secondary text-xs">
            删除后将无法恢复，但已炼成丹药的来源记述不会受影响。
          </p>
        </div>
      ),
      confirmLabel: '删除丹方',
      cancelLabel: '作罢',
      loading: isDeletingFormula,
      loadingLabel: '删除中……',
      onConfirm: async () => {
        if (isDeletingFormula) {
          return;
        }

        const nextSelectedFormulaId = getNextSelectedFormulaIdAfterDelete(
          formulas,
          formula.id,
          selectedFormulaId,
        );

        try {
          setIsDeletingFormula(true);
          setDialog((currentDialog) =>
            currentDialog
              ? {
                  ...currentDialog,
                  loading: true,
                }
              : currentDialog,
          );

          const response = await fetch(`/api/alchemy/formulas/${formula.id}`, {
            method: 'DELETE',
          });
          const result: FormulaDeleteResponse = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || '丹方删除失败');
          }

          setPreviewState(DEFAULT_PREVIEW_STATE);
          await loadFormulas({
            selectFormulaId: nextSelectedFormulaId,
          });
          pushToast({
            message: result.message || `已删除【${formula.name}】`,
            tone: 'success',
          });
        } catch (error) {
          pushToast({
            message:
              error instanceof Error ? error.message : '丹方删除失败，请稍后再试。',
            tone: 'danger',
          });
        } finally {
          setIsDeletingFormula(false);
          setDialog((currentDialog) =>
            currentDialog
              ? {
                  ...currentDialog,
                  loading: false,
                }
              : currentDialog,
          );
        }
      },
    });
  };

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">丹火温养中……</p>
      </div>
    );
  }

  const headerStatus =
    activeMode === 'formula' && selectedFormula
      ? `已选丹方：${selectedFormula.name}`
      : selectedMaterialIds.length > 0
        ? `已投入 ${selectedMaterialIds.length} 种灵材`
        : activeMode === 'formula'
          ? '请先选定丹方，再投入灵材。'
          : '请投入灵材并注入丹意。';

  return (
    <GameSceneFrame
      title="【炼丹房】"
      description="丹意引炉，药性成形。左侧专心排布材料与炉法，右侧始终盯着丹方、灵石消耗与当前炉况。"
      headerMeta={
        <div className="space-y-3">
          {note ? (
            <GameSceneNote>
              <p className="text-sm leading-7">{note}</p>
            </GameSceneNote>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-battle-muted min-w-0 flex-1 leading-6">
              {headerStatus}
            </p>
            <InkButton
              variant="outline"
              onClick={() => setIsGuideModalOpen(true)}
              className="shrink-0"
            >
              炉理指引
            </InkButton>
          </div>
        </div>
      }
      aside={
        <>
          <GameSceneAsideSection title="炉况摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>
                当前炉法：{activeMode === 'formula' ? '丹方炼制' : '即兴炼丹'}
              </p>
              <p>
                已投入灵材：{selectedMaterialIds.length}/{MAX_MATERIALS}
              </p>
              <p>灵石余额：{cultivator?.spirit_stones ?? 0}</p>
              {estimatedSpiritStones !== null ? (
                <p>预计耗费：{estimatedSpiritStones} 灵石</p>
              ) : null}
            </div>
          </GameSceneAsideSection>

          <GameSceneAsideSection
            title="丹方与提示"
            className="text-sm leading-7"
          >
            {activeMode === 'formula' && selectedFormula ? (
              <div className="space-y-2">
                <p>已选丹方：{selectedFormula.name}</p>
                <p>丹方族类：{getPillFamilyLabel(selectedFormula.family)}</p>
                <p>熟练等级：Lv.{selectedFormula.mastery.level}</p>
              </div>
            ) : activeMode === 'formula' ? (
              <p>请先选定丹方，再投入灵材。</p>
            ) : (
              <p>请投入灵材并注入丹意，系统会按材料药性与意图共振出丹。</p>
            )}
            {previewError ? (
              <p className="text-crimson mt-2">{previewError}</p>
            ) : null}
            {displayValidation?.blockingReason ? (
              <p className="text-crimson mt-2">
                {displayValidation.blockingReason}
              </p>
            ) : null}
          </GameSceneAsideSection>
        </>
      }
    >
      <GameSceneTabs
        items={[
          { label: '即兴炼丹', value: 'improvised' },
          { label: '丹方炼制', value: 'formula' },
        ]}
        activeValue={activeMode}
        onChange={handleModeChange}
      />

      {activeMode === 'formula' && (
        <GameSceneSection title="丹方总览">
          {formulasError && (
            <InkNotice tone="warning">{formulasError}</InkNotice>
          )}
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
                      'w-full border px-3 py-3 text-left transition-colors',
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
                    <FormulaNarrativeBlock formula={formula} />
                  </button>
                );
              })}
            </div>
          )}
        </GameSceneSection>
      )}

      <GameSceneSection
        title={activeMode === 'formula' ? '炉材甄选' : '甄选灵材'}
      >
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
      </GameSceneSection>

      <GameSceneSection title="调度投入份数">
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

      {activeMode === 'improvised' ? (
        <GameSceneSection title="注入丹意">
          <InkInput
            label="丹药意图（必填）"
            placeholder="比如：想炼一枚兼顾疗伤与回元、但药性不要太躁烈的丹"
            value={userPrompt}
            onChange={setUserPrompt}
            multiline
            rows={3}
            disabled={isSubmitting}
          />
        </GameSceneSection>
      ) : (
        <GameSceneSection title="丹方摘要">
          {selectedFormula ? (
            <AlchemyFormulaSummaryCard
              formula={selectedFormula}
              isDeleting={isDeletingFormula}
              onDelete={() => openDeleteFormulaConfirm(selectedFormula)}
            />
          ) : (
            <InkNotice tone="info">
              先从上方选定一份丹方，再安排炉材。
            </InkNotice>
          )}
        </GameSceneSection>
      )}

      <GameSceneSection title="预计消耗">
        {estimatedSpiritStones !== null ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between border border-dashed p-3">
            <span className="text-sm">
              灵石：
              <span className="text-wood font-bold">
                {estimatedSpiritStones}
              </span>{' '}
              枚
            </span>
            <span
              className={`text-xs ${displayCanAfford ? 'text-teal' : 'text-crimson'}`}
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
          <InkNotice tone="warning">
            {displayValidation.blockingReason}
          </InkNotice>
        )}
        {displayValidation?.warnings.map((warning) => (
          <InkNotice key={warning} tone="info">
            {warning}
          </InkNotice>
        ))}
      </GameSceneSection>

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

      {status && !isResultModalOpen && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      <AlchemyResultModal
        consumable={createdConsumable}
        formulaProgress={formulaProgress}
        isOpen={isResultModalOpen}
        onClose={() => {
          setIsResultModalOpen(false);
          if (formulaDiscovery) {
            setIsDiscoveryModalOpen(true);
          }
        }}
        viewerRealm={cultivator?.realm}
      />

      <AlchemyFormulaDiscoveryModal
        formulaDiscovery={formulaDiscovery}
        isHandlingDiscovery={isHandlingDiscovery}
        isOpen={isDiscoveryModalOpen}
        onAcceptDiscovery={() => void handleDiscoveryDecision(true)}
        onRejectDiscovery={() => void handleDiscoveryDecision(false)}
      />

      <AlchemyGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      <InkDialog
        dialog={dialog}
        onClose={() => {
          if (!isDeletingFormula) {
            setDialog(null);
          }
        }}
      />

      {celebrationTick > 0 && (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      )}
    </GameSceneFrame>
  );
}
