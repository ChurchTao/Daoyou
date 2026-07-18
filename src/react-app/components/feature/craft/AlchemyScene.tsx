import {
  PillAppearanceMark,
  PillDetailGroups,
  getPillFamilyLabel,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import {
  MaterialSelectionModal,
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
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
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
import {
  STARTER_ALCHEMY_PROMPT,
} from '@app/lib/alchemy/starterAlchemy';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { findNextTutorialTask } from '@app/lib/tasks/taskClient';
import { QI_ACTION_COSTS } from '@shared/config/qiSystem';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import { formatAlchemyPropertyVector } from '@shared/lib/alchemyProperties';
import { cn } from '@shared/lib/cn';
import { isPillConsumable } from '@shared/lib/consumables';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import type { MaterialType, RealmType } from '@shared/types/constants';
import type {
  AlchemyBatchPreview,
  AlchemyFormula,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyMode,
  FormulaAnalysisResult,
  FormulaMaterialJudgment,
  PillFamily,
} from '@shared/types/consumable';
import { PILL_FAMILY_VALUES } from '@shared/types/consumable';
import type { Consumable, Material } from '@shared/types/cultivator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

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
const SPIRIT_STONES_LABEL = getGameConceptLabel('spirit_stones');

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
    batchPreview?: AlchemyBatchPreview;
  };
  error?: string;
};

type PreviewState = {
  key: string | null;
  estimatedSpiritStones: number | null;
  validation: PreviewValidation | null;
  batchPreview: AlchemyBatchPreview | null;
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
    pagination: FormulaListPagination;
  };
  error?: string;
};

type FormulaListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
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

type FormulaAnalyzeResponse = {
  success: boolean;
  data?: FormulaAnalysisResult;
  error?: string;
  remainingSeconds?: number;
};

const DEFAULT_PREVIEW_STATE: PreviewState = {
  key: null,
  estimatedSpiritStones: null,
  validation: null,
  batchPreview: null,
  canAfford: true,
  previewError: null,
};

const DEFAULT_FORMULA_PAGINATION: FormulaListPagination = {
  page: 1,
  pageSize: 5,
  total: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

function formatFormulaTags(formula: AlchemyFormula): string {
  return formatAlchemyPropertyVector(formula.pattern.targetPropertyVector);
}

function getFormulaMasteryRequiredExp(formula: AlchemyFormula): number {
  return 5 * (formula.mastery.level + 1);
}

function getFormulaFitBandLabel(
  fitBand: FormulaAnalysisResult['fitBand'],
): string {
  switch (fitBand) {
    case 'aligned':
      return '契合';
    case 'degraded':
      return '勉强';
    case 'poor':
      return '偏路';
  }
}

function getFormulaFitBandTone(
  fitBand: FormulaAnalysisResult['fitBand'],
): 'accent' | 'warning' | 'danger' {
  switch (fitBand) {
    case 'aligned':
      return 'accent';
    case 'degraded':
      return 'warning';
    case 'poor':
      return 'danger';
  }
}

function getFormulaAnalysisNarrative(
  fitBand: FormulaAnalysisResult['fitBand'],
): string {
  switch (fitBand) {
    case 'aligned':
      return '炉中药脉已顺着丹方主路收束，此刻开炉，最易成丹。';
    case 'degraded':
      return '这一炉尚能循方而行，只是药力已有散逸，成丹后难免折损几分。';
    case 'poor':
      return '这一炉药路偏离丹方甚远，仍可强行收丹，但药效和品相都会明显受损。';
  }
}

function getFormulaFitBandEffectText(
  fitBand: FormulaAnalysisResult['fitBand'],
): string {
  switch (fitBand) {
    case 'aligned':
      return '药效与品相概率按丹方正常发挥，契合越高熟练增长越快。';
    case 'degraded':
      return '药效会有折损，品相更难上行，熟练增长较少。';
    case 'poor':
      return '药效削减明显，品相大多偏下，且基本不会增长熟练。';
  }
}

function getBatchTierLabel(
  tier: NonNullable<FormulaAnalysisResult['batchProfile']>['compoundTier'],
): string {
  switch (tier) {
    case 'single':
      return '单材';
    case 'balanced':
      return '均衡';
    case 'synergy':
      return '协同';
    case 'conflict':
      return '冲突';
  }
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
            即兴炼丹
          </div>
          <div className="text-ink-secondary space-y-1">
            <p>
              先挑灵材，再写丹意。你写的是想成什么丹，炉中灵材决定这股药力能往哪条路走：疗伤、回元、积修、启悟、破境、清心、护脉、延寿、炼体、洗髓，都会从这里分出路数。
            </p>
            <p>
              丹意写得越清楚，炉火越容易顺着你的意思走；灵材本性若不相合，也会把丹势带偏。想炼筑基丹，可投些温稳灵草或辅材，再写“冲关蓄势、辅助筑基、破境凝神”。
            </p>
            <p>
              想推动肉身炼体时，丹意要写清皮肤、筋骨、脏腑、气血或元神等方向。成丹名称仍随材料与炉意生成，不再固定叫某一种炼体丹。
            </p>
            <p>
              偶有一炉火候极顺、药路分明，出丹时便可能悟出丹方。留下丹方后，下次就能按方复炼。
            </p>
          </div>
        </section>

        <section>
          <div className="text-battle-muted mb-2 text-[0.75rem] tracking-[0.2em]">
            丹方炼制
          </div>
          <div className="text-ink-secondary space-y-1">
            <p>
              丹方记的是成丹路数，不是死记哪几味药。先选丹方，再把你手头相近的灵材投入炉中；若炉位、品阶或灵石不够，炉前会直接拦下。
            </p>
            <p>
              投料后先“推演药路”。这一步会看每味材料是能当主材、只能凑用，还是会拖偏丹方。
            </p>
            <p>
              药路若见“契合”，便可安心开炉；若只是“勉强”或“偏路”，也能强行成丹，只是药力、品相和熟练收益都会受影响。
            </p>
          </div>
        </section>

        <section>
          <div className="text-battle-muted mb-2 text-[0.75rem] tracking-[0.2em]">
            炉火提醒
          </div>
          <div className="text-ink-secondary space-y-1">
            <p>
              一炉里药味越多、方向越杂，火势越难稳。炉势不稳时即便成丹，疗伤、修为、感悟、炼体、延寿等药力也会打折。
            </p>
            <p>
              猛药常带丹毒，燥烈材料用得多，服后更要记得调息。解毒一类丹药能化浊，但这一炉的主要药力也会分去一部分。
            </p>
            <p>
              修为、启悟、破境、清心、护脉、延寿、炼体、洗髓都不是一口吞尽的便宜事。同一炉最好只求一条主路，丹意写得太散，反而什么都留不深。
            </p>
            <p>
              破境丹服下后，可能留下破境凝神、清心或护脉之效。破境前看的是你身上有没有这份准备，不问这枚丹是不是亲手炼成。
            </p>
            <p>
              肉身进阶另走炼体体系：看丹药是否为炼体类、药性是否对应目标五轨、丹药质量是否达标，不按丹药名称判断。
            </p>
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
      <div>药路取向：{formatFormulaTags(formula)}</div>
      <div>
        需 {formula.pattern.slotCount} 味灵材
        {formula.pattern.minQuality
          ? `，至少 ${formula.pattern.minQuality}`
          : ''}
        {showMasteryExp ? `，熟练进度 ${formula.mastery.exp}` : ''}
      </div>
    </div>
  );
}

export function AlchemyFormulaSummaryCard({
  formula,
}: {
  formula: AlchemyFormula;
}) {
  return (
    <InkCard variant="elevated" padding="lg">
      <div className="space-y-2 text-sm">
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
      </div>
    </InkCard>
  );
}

export function AlchemyFormulaAnalysisModal({
  analysis,
  cooldownRemainingSeconds,
  isOpen,
  isCrafting,
  onClose,
  onCraft,
}: {
  analysis: FormulaAnalysisResult | null;
  cooldownRemainingSeconds: number;
  isOpen: boolean;
  isCrafting: boolean;
  onClose: () => void;
  onCraft: () => void;
}) {
  if (!analysis) {
    return null;
  }

  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title="药路推演"
      className="max-w-2xl"
      footer={
        <InkActionGroup align="right">
          <InkButton onClick={onClose} disabled={isCrafting}>
            稍后开炉
          </InkButton>
          <InkButton variant="primary" onClick={onCraft} disabled={isCrafting}>
            {isCrafting ? '丹火炼中……' : '确认开炉'}
          </InkButton>
        </InkActionGroup>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <InkBadge tone={getFormulaFitBandTone(analysis.fitBand)}>
            {getFormulaFitBandLabel(analysis.fitBand)}
          </InkBadge>
          <span className="text-ink-secondary">
            合方程度 {Math.round(analysis.fitScore * 100)}%
          </span>
        </div>
        {analysis.batchProfile ? (
          <div className="border-ink/10 bg-ink/5 grid gap-3 border border-dashed p-3 sm:grid-cols-2">
            <div>
              <div className="text-ink-secondary text-xs">预计成丹</div>
              <div className="text-wood text-2xl font-bold leading-9">
                {analysis.batchProfile.yieldQuantity} 枚
              </div>
            </div>
            <div>
              <div className="text-ink-secondary text-xs">配伍</div>
              <div className="font-semibold leading-7">
                {getBatchTierLabel(analysis.batchProfile.compoundTier)}
              </div>
              <div className="text-ink-secondary text-xs leading-5">
                {analysis.batchProfile.roleSummary}
              </div>
            </div>
          </div>
        ) : null}
        <div className="text-ink-secondary space-y-1 leading-6">
          <p>{getFormulaAnalysisNarrative(analysis.fitBand)}</p>
          <p>{getFormulaFitBandEffectText(analysis.fitBand)}</p>
          {cooldownRemainingSeconds > 0 ? (
            <p>
              本次推演已留炉路，可直接开炉；{cooldownRemainingSeconds}{' '}
              秒后可重新推演药路。
            </p>
          ) : null}
        </div>
        {analysis.materialJudgments.length > 0 ? (
          <div className="space-y-2">
            {analysis.materialJudgments.map((judgment) => (
              <div
                key={judgment.materialId}
                className="border-ink/10 flex flex-wrap items-center gap-2 border px-3 py-2"
              >
                <InkBadge tone={getFormulaFitBandTone(
                  judgment.verdict === 'core'
                    ? 'aligned'
                    : judgment.verdict === 'usable'
                      ? 'degraded'
                      : 'poor',
                )}>
                  {judgment.verdict === 'core'
                    ? '主材'
                    : judgment.verdict === 'usable'
                      ? '可用'
                      : '偏路'}
                </InkBadge>
                <span className="font-medium">{judgment.materialName}</span>
                <span className="text-ink-secondary">{judgment.reason}</span>
              </div>
            ))}
          </div>
        ) : null}
        {analysis.warnings.length > 0 ? (
          <div className="space-y-2">
            {analysis.warnings.map((warning) => (
              <InkNotice key={warning} tone="warning">
                {warning}
              </InkNotice>
            ))}
          </div>
        ) : null}
      </div>
    </InkModal>
  );
}

export function AlchemyFormulaListItem({
  formula,
  isActive,
  isDeleting,
  onSelect,
  onDelete,
}: {
  formula: AlchemyFormula;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const requiredMasteryExp = getFormulaMasteryRequiredExp(formula);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'w-full border px-3 py-3 text-left transition-colors',
        isActive
          ? 'border-crimson bg-crimson/5'
          : 'border-ink/10 hover:border-ink/30',
      )}
    >
      <div className="space-y-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold leading-6">{formula.name}</span>
            <InkBadge tone="default">
              {getPillFamilyLabel(formula.family)}
            </InkBadge>
          </div>
          <div className="text-ink-secondary flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>{`熟练 Lv.${formula.mastery.level}`}</span>
            <span>{`进度 ${formula.mastery.exp}/${requiredMasteryExp}`}</span>
            <span>{`需 ${formula.pattern.slotCount} 味灵材`}</span>
            {formula.pattern.minQuality ? (
              <span>{`至少 ${formula.pattern.minQuality}`}</span>
            ) : null}
          </div>
          <div className="text-ink-secondary space-y-1 text-sm leading-6">
            <p>{formula.description}</p>
            <p>药路取向：{formatFormulaTags(formula)}</p>
          </div>
        </div>
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <InkButton
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-crimson hover:text-crimson/80 w-[6em] justify-center"
          >
            {isDeleting ? '删除中……' : '删除'}
          </InkButton>
        </div>
      </div>
    </div>
  );
}

export function AlchemyFormulaSelectionModal({
  isOpen,
  onClose,
  formulas,
  selectedFormulaId,
  isLoading,
  error,
  search,
  familyFilter,
  pagination,
  isDeleting,
  isSubmitting,
  onSearchChange,
  onFamilyFilterChange,
  onPageChange,
  onSelectFormula,
  onDeleteFormula,
}: {
  isOpen: boolean;
  onClose: () => void;
  formulas: AlchemyFormula[];
  selectedFormulaId: string | null;
  isLoading: boolean;
  error: string | null;
  search: string;
  familyFilter: PillFamily | 'all';
  pagination: FormulaListPagination;
  isDeleting: boolean;
  isSubmitting: boolean;
  onSearchChange: (value: string) => void;
  onFamilyFilterChange: (value: PillFamily | 'all') => void;
  onPageChange: (page: number) => void;
  onSelectFormula: (formula: AlchemyFormula) => void;
  onDeleteFormula: (formula: AlchemyFormula) => void;
}) {
  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title="选择丹方"
      className="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-ink-secondary text-xs">
            共 {pagination.total} 份丹方，第 {pagination.page} /{' '}
            {pagination.totalPages} 页
          </div>
          <InkActionGroup align="right">
            <InkButton
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={
                isSubmitting || isLoading || !pagination.hasPreviousPage
              }
            >
              上一页
            </InkButton>
            <InkButton
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={isSubmitting || isLoading || !pagination.hasNextPage}
            >
              下一页
            </InkButton>
            <InkButton variant="primary" onClick={onClose}>
              完成选择
            </InkButton>
          </InkActionGroup>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_12rem]">
          <InkInput
            label="搜索丹方"
            placeholder="按名称或记述查找"
            value={search}
            onChange={onSearchChange}
            disabled={isSubmitting}
          />
          <label className="text-ink-secondary flex flex-col gap-1 text-sm">
            族类
            <select
              value={familyFilter}
              onChange={(event) =>
                onFamilyFilterChange(event.target.value as PillFamily | 'all')
              }
              disabled={isSubmitting}
              className="border-ink/20 bg-paper text-ink min-h-10 border px-3"
            >
              <option value="all">全部</option>
              {PILL_FAMILY_VALUES.map((family) => (
                <option key={family} value={family}>
                  {getPillFamilyLabel(family)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
        {isLoading ? <InkNotice>正在整理你的丹方笔录……</InkNotice> : null}
        {!isLoading && formulas.length === 0 ? (
          <InkNotice tone="info">
            {search || familyFilter !== 'all'
              ? '没有符合筛选条件的丹方。'
              : '你尚未悟得丹方。先在“即兴炼丹”中炼出稳固成丹，再尝试留方。'}
          </InkNotice>
        ) : null}

        <div className="space-y-2">
          {formulas.map((formula) => (
            <AlchemyFormulaListItem
              key={formula.id}
              formula={formula}
              isActive={formula.id === selectedFormulaId}
              isDeleting={isDeleting}
              onSelect={() => onSelectFormula(formula)}
              onDelete={() => onDeleteFormula(formula)}
            />
          ))}
        </div>
      </div>
    </InkModal>
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
      nameMark={
        model.appearance ? (
          <PillAppearanceMark
            appearance={model.appearance}
            className="text-xs"
          />
        ) : undefined
      }
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
          <div className="border-wood/30 bg-wood/10 flex items-center justify-between border px-3 py-2">
            <span className="text-ink-secondary text-sm">本炉成丹</span>
            <span className="text-wood text-xl font-bold">
              {consumable.quantity} 枚
            </span>
          </div>
          {meta.batch ? (
            <div className="border-border/50 flex justify-between border-b pb-2">
              <span className="opacity-70">配伍</span>
              <span className="font-bold">
                {getBatchTierLabel(meta.batch.compoundTier)} ·{' '}
                {meta.batch.roleSummary}
              </span>
            </div>
          ) : null}
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
          <InkButton onClick={onRejectDiscovery} disabled={isHandlingDiscovery}>
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

export type AlchemySceneProps = {
  sectContext?: {
    facilityLevel: number;
    discountPercent: number;
  };
};

export function AlchemyScene({ sectContext }: AlchemySceneProps) {
  const { cultivator, note, isLoading } = usePlayerStateView();
  const { mutate } = usePlayerStateActions();
  const cultivatorId = cultivator?.id ?? null;
  const { tasks } = useTaskList(cultivatorId ?? undefined);
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
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isFormulaSelectionModalOpen, setIsFormulaSelectionModalOpen] =
    useState(false);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [previewState, setPreviewState] = useState<PreviewState>(
    DEFAULT_PREVIEW_STATE,
  );
  const [formulaAnalysis, setFormulaAnalysis] =
    useState<FormulaAnalysisResult | null>(null);
  const [isFormulaAnalysisModalOpen, setIsFormulaAnalysisModalOpen] =
    useState(false);
  const [isAnalyzingFormula, setIsAnalyzingFormula] = useState(false);
  const [formulaAnalysisError, setFormulaAnalysisError] = useState<
    string | null
  >(null);
  const [analysisCooldownRemaining, setAnalysisCooldownRemaining] =
    useState(0);
  const [analysisExpiresAfterMs, setAnalysisExpiresAfterMs] = useState<number | null>(
    null,
  );
  const [formulas, setFormulas] = useState<AlchemyFormula[]>([]);
  const [selectedFormulaSnapshot, setSelectedFormulaSnapshot] =
    useState<AlchemyFormula | null>(null);
  const [formulaSearch, setFormulaSearch] = useState('');
  const [formulaFamilyFilter, setFormulaFamilyFilter] = useState<
    PillFamily | 'all'
  >('all');
  const [formulaPage, setFormulaPage] = useState(1);
  const [formulaPagination, setFormulaPagination] =
    useState<FormulaListPagination>(DEFAULT_FORMULA_PAGINATION);
  const [formulasError, setFormulasError] = useState<string | null>(null);
  const [isLoadingFormulas, setIsLoadingFormulas] = useState(false);
  const analyzedFormulaSelectionKeyRef = useRef<string | null>(null);
  const { pushToast } = useInkUI();
  const { openQiActionConfirm } = useQiActionConfirm();
  const navigate = useNavigate();
  const selectedFormula = useMemo(
    () =>
      selectedFormulaSnapshot?.id === selectedFormulaId
        ? selectedFormulaSnapshot
        : (formulas.find((formula) => formula.id === selectedFormulaId) ?? null),
    [formulas, selectedFormulaId, selectedFormulaSnapshot],
  );
  const nextTutorialTask = useMemo(() => findNextTutorialTask(tasks), [tasks]);
  const isStarterAlchemyTask =
    nextTutorialTask?.definitionId === 'tutorial_first_alchemy';
  const formulaJudgmentMap = useMemo(
    () =>
      Object.fromEntries(
        (formulaAnalysis?.materialJudgments ?? []).map((judgment) => [
          judgment.materialId,
          judgment,
        ]),
      ) as Record<string, FormulaMaterialJudgment>,
    [formulaAnalysis],
  );
  const currentFormulaSelectionKey = useMemo(() => {
    if (activeMode !== 'formula' || !selectedFormulaId) {
      return null;
    }

    return JSON.stringify({
      formulaId: selectedFormulaId,
      materials: selectedMaterialIds.map((id) => ({
        id,
        dose: doseMap[id] ?? MIN_DOSE,
      })),
    });
  }, [activeMode, doseMap, selectedFormulaId, selectedMaterialIds]);

  useEffect(() => {
    if (analysisCooldownRemaining <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setAnalysisCooldownRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [analysisCooldownRemaining]);

  useEffect(() => {
    if (!formulaAnalysis || !analysisExpiresAfterMs) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFormulaAnalysis(null);
      setIsFormulaAnalysisModalOpen(false);
      setAnalysisExpiresAfterMs(null);
      setFormulaAnalysisError('上次推演已散去，请重新推演药路。');
    }, analysisExpiresAfterMs);

    return () => window.clearTimeout(timer);
  }, [analysisExpiresAfterMs, formulaAnalysis]);

  const clearFormulaAnalysis = (options?: { keepError?: boolean }) => {
    setFormulaAnalysis(null);
    setIsFormulaAnalysisModalOpen(false);
    setAnalysisExpiresAfterMs(null);
    analyzedFormulaSelectionKeyRef.current = null;
    if (!options?.keepError) {
      setFormulaAnalysisError(null);
    }
  };

  useEffect(() => {
    if (
      analyzedFormulaSelectionKeyRef.current &&
      analyzedFormulaSelectionKeyRef.current !== currentFormulaSelectionKey
    ) {
      analyzedFormulaSelectionKeyRef.current = null;
      setFormulaAnalysis(null);
      setIsFormulaAnalysisModalOpen(false);
      setAnalysisExpiresAfterMs(null);
      setFormulaAnalysisError(null);
    }
  }, [currentFormulaSelectionKey]);

  const loadFormulas = async (options?: {
    page?: number;
  }) => {
    if (!cultivatorId) {
      return;
    }

    try {
      setIsLoadingFormulas(true);
      const nextPage = options?.page ?? formulaPage;
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: '5',
      });
      const keyword = formulaSearch.trim();
      if (keyword) {
        params.set('search', keyword);
      }
      if (formulaFamilyFilter !== 'all') {
        params.set('family', formulaFamilyFilter);
      }
      const response = await fetch(`/api/alchemy/formulas?${params.toString()}`);
      const result: FormulaListResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '丹方列表读取失败');
      }

      const nextFormulas = result.data.formulas;

      setFormulas(nextFormulas);
      setFormulaPagination(result.data.pagination);
      setFormulaPage(result.data.pagination.page);
      setFormulasError(null);
    } catch (error) {
      setFormulasError(
        error instanceof Error
          ? error.message
          : '丹方列表读取失败，请稍后再试。',
      );
    } finally {
      setIsLoadingFormulas(false);
    }
  };

  useEffect(() => {
    if (!cultivatorId || !isFormulaSelectionModalOpen) {
      return;
    }

    let cancelled = false;

    const loadInitialFormulas = async () => {
      try {
        setIsLoadingFormulas(true);
        const params = new URLSearchParams({
          page: String(formulaPage),
          pageSize: '5',
        });
        const keyword = formulaSearch.trim();
        if (keyword) {
          params.set('search', keyword);
        }
        if (formulaFamilyFilter !== 'all') {
          params.set('family', formulaFamilyFilter);
        }
        const response = await fetch(`/api/alchemy/formulas?${params.toString()}`);
        const result: FormulaListResponse = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || '丹方列表读取失败');
        }

        const nextFormulas = result.data.formulas;

        setFormulas(nextFormulas);
        setFormulaPagination(result.data.pagination);
        setFormulaPage(result.data.pagination.page);
        setFormulasError(null);
      } catch (error) {
        if (cancelled) return;
        setFormulasError(
          error instanceof Error
            ? error.message
            : '丹方列表读取失败，请稍后再试。',
        );
      } finally {
        if (!cancelled) {
          setIsLoadingFormulas(false);
        }
      }
    };

    void loadInitialFormulas();

    return () => {
      cancelled = true;
    };
  }, [
    cultivatorId,
    formulaFamilyFilter,
    formulaPage,
    formulaSearch,
    isFormulaSelectionModalOpen,
  ]);

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
    const materialQuantities = Object.fromEntries(
      selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
    );
    params.set('materialQuantities', JSON.stringify(materialQuantities));
    if (activeMode === 'formula' && selectedFormulaId) {
      params.set('formulaId', selectedFormulaId);
    }

    return {
      key: JSON.stringify({
        activeMode,
        selectedFormulaId,
        materialIds: selectedMaterialIds,
        materialQuantities,
      }),
      url: `/api/craft?${params.toString()}`,
    };
  }, [activeMode, doseMap, selectedFormulaId, selectedMaterialIds]);

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
          batchPreview: result.data.batchPreview ?? null,
          canAfford: result.data.canAfford,
          previewError: null,
        });
      } catch (error) {
        if (cancelled) return;
        setPreviewState({
          key: previewRequest.key,
          estimatedSpiritStones: null,
          validation: null,
          batchPreview: null,
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
    clearFormulaAnalysis();
    setIsMaterialModalOpen(false);
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
    clearFormulaAnalysis();
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
    clearFormulaAnalysis();
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
      analysisId:
        activeMode === 'formula' ? formulaAnalysis?.analysisId : undefined,
      materialQuantities: Object.fromEntries(
        selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
      ),
      userPrompt: activeMode === 'improvised' ? userPrompt.trim() : undefined,
    }),
    [
      activeMode,
      doseMap,
      formulaAnalysis?.analysisId,
      selectedFormulaId,
      selectedMaterialIds,
      userPrompt,
    ],
  );

  const hasFreshPreview = previewState.key === previewRequest?.key;
  const estimatedSpiritStones = hasFreshPreview
    ? previewState.estimatedSpiritStones
    : null;
  const batchPreview = hasFreshPreview ? previewState.batchPreview : null;
  const validation = hasFreshPreview ? previewState.validation : null;
  const canAfford = hasFreshPreview ? previewState.canAfford : true;
  const previewError = hasFreshPreview ? previewState.previewError : null;
  const displayValidation = validation;
  const displayCanAfford = canAfford;
  const isFormulaMode = activeMode === 'formula';
  const displayBatchPreview = isFormulaMode ? batchPreview : null;
  const displayPreviewWarnings =
    isFormulaMode ? (displayValidation?.warnings ?? []) : [];
  const qiCost = isFormulaMode
    ? QI_ACTION_COSTS.alchemy_formula
    : QI_ACTION_COSTS.alchemy_improvised;
  const hasCraftableFormulaAnalysis =
    !!formulaAnalysis?.analysisId;
  const canAnalyzeFormula =
    !isSubmitting &&
    !isAnalyzingFormula &&
    !!selectedFormulaId &&
    selectedMaterialIds.length > 0 &&
    hasFreshPreview &&
    estimatedSpiritStones !== null &&
    !previewError &&
    displayCanAfford &&
    displayValidation?.valid !== false &&
    analysisCooldownRemaining <= 0;
  const canCraftFormula =
    !isSubmitting &&
    !!selectedFormulaId &&
    hasCraftableFormulaAnalysis &&
    !previewError &&
    estimatedSpiritStones !== null &&
    displayCanAfford &&
    displayValidation?.valid !== false;
  const canChooseMaterials = !isSubmitting && (!isFormulaMode || !!selectedFormulaId);
  const formulaPrimaryButtonLabel = isSubmitting
    ? '丹火炼中……'
    : isAnalyzingFormula
      ? '推演中……'
      : !formulaAnalysis?.analysisId
      ? analysisCooldownRemaining > 0
        ? `${analysisCooldownRemaining} 秒后可再推演`
        : '推演药路'
      : formulaAnalysis.fitBand === 'poor'
        ? '强行开炉'
        : '依方成丹';

  const handleAnalyzeFormula = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }
    if (!selectedFormulaId) {
      pushToast({ message: '请先选定丹方。', tone: 'warning' });
      return;
    }
    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '请先投入灵材。', tone: 'warning' });
      return;
    }
    if (!hasFreshPreview || estimatedSpiritStones === null) {
      pushToast({ message: '炉前验材尚未完成。', tone: 'warning' });
      return;
    }
    if (previewError || displayValidation?.valid === false || !displayCanAfford) {
      pushToast({ message: '请先让这一炉通过验材。', tone: 'warning' });
      return;
    }
    if (analysisCooldownRemaining > 0) {
      pushToast({
        message: `炉意未散，请 ${analysisCooldownRemaining} 秒后再推演药路。`,
        tone: 'warning',
      });
      return;
    }

    setIsAnalyzingFormula(true);
    setFormulaAnalysisError(null);

    try {
      const response = await fetch(
        `/api/alchemy/formulas/${selectedFormulaId}/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            materialIds: selectedMaterialIds,
            materialQuantities: Object.fromEntries(
              selectedMaterialIds.map((id) => [id, doseMap[id] ?? MIN_DOSE]),
            ),
          }),
        },
      );
      const result: FormulaAnalyzeResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        if (typeof result.remainingSeconds === 'number') {
          setAnalysisCooldownRemaining(result.remainingSeconds);
        }
        throw new Error(result.error || '推演药路失败');
      }

      if (!result.data.valid) {
        clearFormulaAnalysis();
        setFormulaAnalysisError(result.data.staticBlockingReason || '当前炉材未通过炉前验材。');
        return;
      }

      setFormulaAnalysis(result.data);
      setIsFormulaAnalysisModalOpen(true);
      setAnalysisExpiresAfterMs(result.data.expiresInSeconds * 1000);
      analyzedFormulaSelectionKeyRef.current = currentFormulaSelectionKey;
      setAnalysisCooldownRemaining(result.data.cooldownRemainingSeconds);
      pushToast({
        message:
          result.data.fitBand === 'aligned'
            ? '药路已明，可依方成丹。'
            : result.data.fitBand === 'degraded'
              ? '这炉尚可循方，但药力会有折损。'
              : '这炉偏离丹方较远，仍可强行收丹。',
        tone:
          result.data.fitBand === 'poor'
            ? 'warning'
            : result.data.fitBand === 'degraded'
              ? 'default'
              : 'success',
      });
    } catch (error) {
      clearFormulaAnalysis({ keepError: true });
      setFormulaAnalysisError(
        error instanceof Error ? error.message : '推演药路失败，请稍后再试。',
      );
      pushToast({
        message:
          error instanceof Error ? error.message : '推演药路失败，请稍后再试。',
        tone: 'danger',
      });
    } finally {
      setIsAnalyzingFormula(false);
    }
  };

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }
    if (activeMode === 'formula' && !selectedFormulaId) {
      pushToast({ message: '请先选定丹方。', tone: 'warning' });
      return;
    }
    if (activeMode === 'formula' && !formulaAnalysis?.analysisId) {
      pushToast({ message: '请先推演药路。', tone: 'warning' });
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
    openQiActionConfirm({
      actionName: activeMode === 'formula' ? '丹方炼丹' : '开炉炼丹',
      qiCost,
      confirmLabel: activeMode === 'formula' ? '依方成丹' : '开炉炼丹',
      onConfirm: async () => {
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
          const result = await mutate<NonNullable<AlchemyCraftResponse['data']>>(
            fetch('/api/craft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(submitPayload),
            }),
          );

          if (!result.consumable) {
            throw new Error('炼丹失败');
          }

          const nextConsumable = result.consumable;
          const discoveredFormula = result.formulaDiscovery ?? null;
          const successMessage = `【${nextConsumable.name}】丹成 ${nextConsumable.quantity} 枚！`;
          setCreatedConsumable(nextConsumable);
          setFormulaDiscovery(discoveredFormula);
          setFormulaProgress(result.formulaProgress ?? null);
          setIsResultModalOpen(true);
          setIsDiscoveryModalOpen(false);
          setCelebrationTick((prev) => prev + 1);
          setStatus(successMessage);
          pushToast({ message: successMessage, tone: 'success' });
          setSelectedMaterialIds([]);
          setSelectedMaterialMap({});
          setDoseMap({});
          setIsMaterialModalOpen(false);
          if (activeMode === 'improvised') {
            setUserPrompt('');
          }
          setPreviewState(DEFAULT_PREVIEW_STATE);
          clearFormulaAnalysis();
          setMaterialsRefreshKey((prev) => prev + 1);
        } catch (error) {
          if (error instanceof Error && error.message.includes('请先推演药路')) {
            clearFormulaAnalysis({ keepError: true });
            setFormulaAnalysisError(error.message);
          }
          const failMessage =
            error instanceof Error
              ? `炸炉了：${error.message}`
              : '炼丹失败，请稍后再试。';
          setStatus(failMessage);
          pushToast({ message: failMessage, tone: 'danger' });
        } finally {
          setSubmitting(false);
        }
      },
    });
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
        setSelectedFormulaId(result.data.formula.id);
        setSelectedFormulaSnapshot(result.data.formula);
        setFormulaPage(1);
        await loadFormulas({ page: 1 });
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
          clearFormulaAnalysis();
          if (selectedFormulaId === formula.id) {
            setSelectedFormulaId(null);
            setSelectedFormulaSnapshot(null);
          }
          await loadFormulas({
            page:
              formulas.length === 1 && formulaPagination.hasPreviousPage
                ? formulaPagination.page - 1
                : formulaPagination.page,
          });
          pushToast({
            message: result.message || `已删除【${formula.name}】`,
            tone: 'success',
          });
        } catch (error) {
          pushToast({
            message:
              error instanceof Error
                ? error.message
                : '丹方删除失败，请稍后再试。',
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
  const handlePrimaryAction = () => {
    if (isFormulaMode) {
      if (hasCraftableFormulaAnalysis) {
        void handleSubmit();
        return;
      }
      void handleAnalyzeFormula();
      return;
    }

    void handleSubmit();
  };

  return (
    <GameSceneFrame
      title={sectContext ? '【宗门丹房】' : '【炼丹房】'}
      description={sectContext ? '赤铜丹炉吞吐灵焰，药柜沿墙依性归置；投下灵材、定住丹意，便可在此守候成丹。' : '丹意引炉，药性成形。左侧专心排布材料与炉法，右侧始终盯着丹方、灵石消耗与当前炉况。'}
      headerMeta={
        <div className="space-y-3">
          {sectContext ? <InkButton onClick={() => navigate('/game/sect')} variant="secondary">返回宗门总视图</InkButton> : null}
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
          {sectContext ? (
            <GameSceneAsideSection title="宗门丹火">
              <div className="space-y-2 text-sm leading-7">
                <p>丹器坊等级：{sectContext.facilityLevel}级</p>
                <p>当前灵石减免：{sectContext.discountPercent}%</p>
              </div>
            </GameSceneAsideSection>
          ) : null}
          <GameSceneAsideSection title="第一炉建议">
            <div className="space-y-2 text-sm leading-7">
              <p>先选青露草、凝水花一类凡品灵草，投入 1 份即可。</p>
              <p>丹意可写：疗伤回元，药性温和。</p>
              <p>第一炉只求看懂成丹结果，不必追求高品阶。</p>
              {isStarterAlchemyTask ? (
                <InkButton
                  variant="primary"
                  onClick={() => {
                    setActiveMode('improvised');
                    setUserPrompt(STARTER_ALCHEMY_PROMPT);
                    setPreviewState(DEFAULT_PREVIEW_STATE);
                    clearFormulaAnalysis();
                    setIsMaterialModalOpen(true);
                  }}
                  disabled={isSubmitting}
                >
                  选择首炉灵材
                </InkButton>
              ) : null}
            </div>
          </GameSceneAsideSection>

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
              {displayBatchPreview ? (
                <p>
                  预计出丹：{displayBatchPreview.minYield}
                  {displayBatchPreview.maxYield !== displayBatchPreview.minYield
                    ? `-${displayBatchPreview.maxYield}`
                    : ''}{' '}
                  枚
                </p>
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
                <p>
                  {formulaAnalysis
                    ? getFormulaAnalysisNarrative(formulaAnalysis.fitBand)
                    : '丹方已定，只待这一炉药性显出真章。'}
                </p>
              </div>
            ) : activeMode === 'formula' ? (
              <p>请先选定丹方，再投入灵材。</p>
            ) : (
              <p>请投入灵材并注入丹意，炉火会顺着材料药性与这缕心意凝成丹形。</p>
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
      contentClassName={sectContext ? 'bg-[radial-gradient(circle_at_50%_100%,rgba(190,65,18,0.16),transparent_32%),linear-gradient(145deg,rgba(184,124,54,0.08),transparent_46%)] px-3 py-4 sm:px-5' : undefined}
    >
      <GameSceneTabs
        items={[
          { label: '即兴炼丹', value: 'improvised' },
          { label: '丹方炼制', value: 'formula' },
        ]}
        activeValue={activeMode}
        onChange={handleModeChange}
      />

      {activeMode === 'formula' ? (
        <GameSceneSection title="丹方摘要">
          {selectedFormula ? (
            <div className="space-y-3">
              <AlchemyFormulaSummaryCard formula={selectedFormula} />
              <InkButton
                variant="outline"
                onClick={() => setIsFormulaSelectionModalOpen(true)}
                disabled={isSubmitting}
              >
                更换丹方
              </InkButton>
              {formulaAnalysis ? (
                <InkNotice tone="info">
                  <div className="space-y-3">
                    <span>
                      药路已推演：{getFormulaFitBandLabel(formulaAnalysis.fitBand)}
                      ，合方程度 {Math.round(formulaAnalysis.fitScore * 100)}%。
                    </span>
                    {formulaAnalysis.batchProfile ? (
                      <span>
                        本炉预计 {formulaAnalysis.batchProfile.yieldQuantity}{' '}
                        枚，配伍
                        {getBatchTierLabel(
                          formulaAnalysis.batchProfile.compoundTier,
                        )}
                        。
                      </span>
                    ) : null}
                    <InkButton
                      variant="outline"
                      onClick={() => setIsFormulaAnalysisModalOpen(true)}
                      disabled={isSubmitting}
                    >
                      查看点评
                    </InkButton>
                  </div>
                </InkNotice>
              ) : formulaAnalysisError ? (
                <InkNotice tone="warning">{formulaAnalysisError}</InkNotice>
              ) : selectedMaterialIds.length > 0 ? (
                <InkNotice tone="info">
                  灵材既入炉中，还需先推演药路，再可依方收丹。
                </InkNotice>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <InkNotice tone="info">
                先选定一份丹方，再安排炉材。
              </InkNotice>
              <InkButton
                variant="primary"
                onClick={() => setIsFormulaSelectionModalOpen(true)}
                disabled={isSubmitting}
              >
                选择丹方
              </InkButton>
            </div>
          )}
        </GameSceneSection>
      ) : null}

      <GameSceneSection title="炉材投入">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm leading-7">
            已投入 {selectedMaterialIds.length} / {MAX_MATERIALS} 种灵材
          </p>
          <InkButton
            variant="outline"
            onClick={() => setIsMaterialModalOpen(true)}
            disabled={!canChooseMaterials}
          >
            打开材料
          </InkButton>
        </div>
        {isFormulaMode && !selectedFormulaId ? (
          <InkNotice tone="info">
            先选丹方，再甄选这一炉要投入的灵材。
          </InkNotice>
        ) : null}
        <SelectedMaterialsWithDose
          selectedIds={selectedMaterialIds}
          materialMap={selectedMaterialMap}
          doseMap={doseMap}
          minDose={MIN_DOSE}
          maxDose={MAX_DOSE}
          disabled={!canChooseMaterials}
          judgmentMap={formulaJudgmentMap}
          sortByJudgment={activeMode === 'formula' && !!formulaAnalysis}
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
      ) : null}

      <GameSceneSection title="预计消耗">
        {estimatedSpiritStones !== null ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between border border-dashed p-3">
            <span className="text-sm">
              {SPIRIT_STONES_LABEL}：
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
              ? '请先选定丹方并投入材料，过一遍炉前验材。'
              : '请先选择材料以查看本炉消耗。'}
          </InkNotice>
        )}

        {displayBatchPreview ? (
          <InkNotice tone="info">
            {displayBatchPreview.summary} 预计出丹{' '}
            {displayBatchPreview.minYield}
            {displayBatchPreview.maxYield !== displayBatchPreview.minYield
              ? `-${displayBatchPreview.maxYield}`
              : ''}{' '}
            枚；共 {displayBatchPreview.materialKindCount} 种灵材，合计{' '}
            {displayBatchPreview.totalDose} 份。
          </InkNotice>
        ) : null}

        {previewError && <InkNotice tone="warning">{previewError}</InkNotice>}
        {displayValidation?.blockingReason && (
          <InkNotice tone="warning">
            {displayValidation.blockingReason}
          </InkNotice>
        )}
        {displayPreviewWarnings.map((warning) => (
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
          onClick={handlePrimaryAction}
          disabled={
            isFormulaMode
              ? formulaAnalysis?.analysisId
                ? !canCraftFormula
                : !canAnalyzeFormula
              : isSubmitting ||
                selectedMaterialIds.length === 0 ||
                !userPrompt.trim() ||
                !!previewError ||
                estimatedSpiritStones === null ||
                !displayCanAfford ||
                displayValidation?.valid === false
          }
        >
          {isFormulaMode
            ? formulaPrimaryButtonLabel
            : isSubmitting
              ? '丹火炼中……'
              : '开炉炼丹'}
        </InkButton>
      </InkActionGroup>

      {status && !isResultModalOpen && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      <MaterialSelectionModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        title="甄选炼丹灵材"
        maxMaterials={MAX_MATERIALS}
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

      <AlchemyFormulaSelectionModal
        isOpen={isFormulaSelectionModalOpen}
        onClose={() => setIsFormulaSelectionModalOpen(false)}
        formulas={formulas}
        selectedFormulaId={selectedFormulaId}
        isLoading={isLoadingFormulas}
        error={formulasError}
        search={formulaSearch}
        familyFilter={formulaFamilyFilter}
        pagination={formulaPagination}
        isDeleting={isDeletingFormula}
        isSubmitting={isSubmitting}
        onSearchChange={(value) => {
          setFormulaSearch(value);
          setFormulaPage(1);
        }}
        onFamilyFilterChange={(value) => {
          setFormulaFamilyFilter(value);
          setFormulaPage(1);
        }}
        onPageChange={setFormulaPage}
        onSelectFormula={(formula) => {
          clearFormulaAnalysis();
          setSelectedFormulaId(formula.id);
          setSelectedFormulaSnapshot(formula);
          setPreviewState(DEFAULT_PREVIEW_STATE);
          setIsFormulaSelectionModalOpen(false);
        }}
        onDeleteFormula={openDeleteFormulaConfirm}
      />

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

      <AlchemyFormulaAnalysisModal
        analysis={formulaAnalysis}
        cooldownRemainingSeconds={analysisCooldownRemaining}
        isOpen={isFormulaAnalysisModalOpen}
        isCrafting={isSubmitting}
        onClose={() => setIsFormulaAnalysisModalOpen(false)}
        onCraft={() => {
          setIsFormulaAnalysisModalOpen(false);
          void handleSubmit();
        }}
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

export default AlchemyScene;
