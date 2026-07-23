import {
  CreationIntentPanel,
  CreationProductResultModal,
  MaterialSelectionModal,
  SelectedMaterialsWithDose,
  type CreationProductResultRecord,
} from '@app/components/feature/creation';
import { useQiActionConfirm } from '@app/components/feature/cultivator/useQiActionConfirm';
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
  InkIdentifyCelebration,
  InkNotice,
} from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { QI_ACTION_COSTS } from '@shared/config/qiSystem';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import { getAllowedMaterialTypesForCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import type { EquipmentSlot } from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

const CRAFT_TYPE = 'refine' as const;
const ALLOWED_MATERIAL_TYPES = [
  ...getAllowedMaterialTypesForCraftType(CRAFT_TYPE),
];
const MAX_MATERIALS = CREATION_INPUT_CONSTRAINTS.maxMaterialKinds;
const MIN_DOSE = CREATION_INPUT_CONSTRAINTS.minQuantityPerMaterial;
const MAX_DOSE = CREATION_INPUT_CONSTRAINTS.maxQuantityPerMaterial;
const SPIRIT_STONES_LABEL = getGameConceptLabel('spirit_stones');

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

export type RefineSceneProps = {
  sectContext?: {
    facilityLevel: number;
    discountPercent: number;
    facilityLabel: string;
    scene: import('@shared/engine/sect').SectScenePresentation;
  };
};

export function RefineScene({ sectContext }: RefineSceneProps) {
  const { cultivator, note, isLoading } = usePlayerStateView();
  const { mutate } = usePlayerStateActions();
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [doseMap, setDoseMap] = useState<Record<string, number>>({});
  const [userPrompt, setUserPrompt] = useState('');
  const [requestedSlot, setRequestedSlot] = useState<EquipmentSlot | ''>('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] =
    useState<CreationProductResultRecord | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [validation, setValidation] = useState<PreviewValidation | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast } = useInkUI();
  const { openQiActionConfirm } = useQiActionConfirm();
  const navigate = useNavigate();

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
    setCreatedResult(null);
    setIsResultModalOpen(false);
    setSelectedMaterialIds([]);
    setSelectedMaterialMap({});
    setDoseMap({});
    setUserPrompt('');
    setRequestedSlot('');
    setValidation(null);
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
      requestedSlot: requestedSlot || undefined,
    }),
    [selectedMaterialIds, doseMap, userPrompt, requestedSlot],
  );

  const displayEstimatedCost =
    selectedMaterialIds.length > 0 ? estimatedCost : null;
  const displayValidation = selectedMaterialIds.length > 0 ? validation : null;
  const displayCanAfford = selectedMaterialIds.length > 0 ? canAfford : true;
  const qiCost = QI_ACTION_COSTS.creation_artifact;

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '巧妇难为无米之炊，请投入灵材。', tone: 'warning' });
      return;
    }

    if (!requestedSlot) {
      pushToast({ message: '请选择目标槽位以确定法宝类型。', tone: 'warning' });
      return;
    }

    openQiActionConfirm({
      actionName: '开炉炼器',
      qiCost,
      confirmLabel: '开炉炼器',
      onConfirm: async () => {
        setSubmitting(true);
        setStatus('炉火纯青，真火锤锻……');
        setCreatedResult(null);
        setIsResultModalOpen(false);

        try {
          const artifact = await mutate<CreationProductResultRecord>(
            fetch('/api/craft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(submitPayload),
            }),
          );
          const successMessage = `【${artifact.name}】出世！`;
          setCreatedResult(artifact);
          setIsResultModalOpen(true);
          setCelebrationTick((prev) => prev + 1);
          setStatus(successMessage);
          pushToast({ message: successMessage, tone: 'success' });
          setSelectedMaterialIds([]);
          setSelectedMaterialMap({});
          setDoseMap({});
          setIsMaterialModalOpen(false);
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
      },
    });
  };

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">地火引动中……</p>
      </div>
    );
  }

  return (
    <GameSceneFrame
      variant="workflow"
      title={sectContext ? `【${sectContext.scene.title}】` : '【炼器室】'}
      description={
        sectContext
          ? sectContext.scene.description
          : '千锤百炼，法宝天成。保留原有炼器业务流，只把当前投入、资源判断与去向压缩进统一工作流壳。'
      }
      identityOverride={
        sectContext
          ? {
              label: sectContext.scene.title,
              summary: sectContext.scene.description,
            }
          : undefined
      }
      headerMeta={
        sectContext || note ? (
          <div className="space-y-3">
            {sectContext ? (
              <InkButton
                onClick={() => navigate('/game/sect')}
                variant="secondary"
              >
                返回宗门总视图
              </InkButton>
            ) : null}
            {note ? (
              <GameSceneNote>
                <p className="text-sm leading-7">{note}</p>
              </GameSceneNote>
            ) : null}
          </div>
        ) : undefined
      }
      aside={
        <>
          {sectContext ? (
            <GameSceneAsideSection title={sectContext.scene.title}>
              <div className="space-y-2 text-sm leading-7">
                <p>
                  {sectContext.facilityLabel}等级：{sectContext.facilityLevel}级
                </p>
                <p>当前灵石减免：{sectContext.discountPercent}%</p>
              </div>
            </GameSceneAsideSection>
          ) : null}
          <GameSceneAsideSection title="炼制摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>
                已投入灵材：{selectedMaterialIds.length} / {MAX_MATERIALS}
              </p>
              <p>目标槽位：{requestedSlot ? '已选定' : '尚未指定'}</p>
              <p>预计灵石：{displayEstimatedCost?.spiritStones ?? 0}</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="成器提醒"
            className="text-sm leading-7"
            help={{
              title: '炼器成器提醒',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>槽位决定器型，灵材决定骨相，意念决定成品气质。</p>
                  <p>若资源不足或规则冲突，先在主区修正后再起炉。</p>
                </div>
              ),
            }}
          />
        </>
      }
      contentClassName={
        sectContext
          ? 'bg-[radial-gradient(circle_at_82%_8%,rgba(130,54,27,0.14),transparent_26%),linear-gradient(135deg,rgba(52,59,60,0.08),transparent_44%)] px-3 py-4 sm:px-5'
          : undefined
      }
    >
      <GameSceneSection title="器型与意念">
        <CreationIntentPanel
          productType="artifact"
          userPrompt={userPrompt}
          onUserPromptChange={setUserPrompt}
          requestedSlot={requestedSlot}
          onRequestedSlotChange={setRequestedSlot}
          disabled={isSubmitting}
        />
      </GameSceneSection>

      <GameSceneSection title="灵材投入">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm leading-7">
            已投入 {selectedMaterialIds.length} / {MAX_MATERIALS} 种灵材
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
              {SPIRIT_STONES_LABEL}：
              <span className="text-wood font-bold">
                {displayEstimatedCost.spiritStones}
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
          <InkNotice>请先选择材料以查看消耗</InkNotice>
        )}

        {displayValidation?.blockingReason && (
          <InkNotice tone="warning">
            {displayValidation.blockingReason}
          </InkNotice>
        )}
      </GameSceneSection>

      <GameSceneSection title="开炉炼制">
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
              !requestedSlot ||
              !displayCanAfford ||
              displayValidation?.valid === false
            }
          >
            {isSubmitting ? '真火炼中……' : '开炉炼器'}
          </InkButton>
        </InkActionGroup>
      </GameSceneSection>

      {status && !createdResult && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      <MaterialSelectionModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        title="甄选炼器灵材"
        maxMaterials={MAX_MATERIALS}
        cultivatorId={cultivator?.id}
        selectedMaterialIds={selectedMaterialIds}
        onToggleMaterial={toggleMaterial}
        selectedMaterialMap={selectedMaterialMap}
        isSubmitting={isSubmitting}
        pageSize={20}
        includeMaterialTypes={ALLOWED_MATERIAL_TYPES}
        refreshKey={materialsRefreshKey}
        loadingText="正在检索储物袋中的灵材，请稍候……"
        emptyNoticeText="暂无可用于炼器的材料。"
        totalText={(total) => `共 ${total} 份可用于炼器的材料`}
      />

      <CreationProductResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        product={createdResult}
      />

      {celebrationTick > 0 && (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      )}
    </GameSceneFrame>
  );
}

export default RefineScene;
