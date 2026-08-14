import { MaterialSelector } from '@app/components/feature/creation';
import {
  InkButton,
  InkDetailDrawer,
  InkNotice,
  inkFieldVariants,
} from '@app/components/ui';
import { ALCHEMY_INTENT_SUGGESTIONS } from '@app/lib/alchemy/alchemyIntentSuggestions';
import { useState } from 'react';
import type { AlchemyMode } from '@shared/types/consumable';
import {
  ALCHEMY_MAX_DOSE,
  ALCHEMY_MAX_MATERIALS,
  ALCHEMY_MIN_DOSE,
  useAlchemyCraftSession,
} from '../alchemyCraftContext';
import { FormulaPickerModal } from '../FormulaPickerModal';
import { FurnaceMaterialDraftList } from '../FurnaceMaterialDraftList';

const MATERIAL_TYPES = ['herb', 'ore', 'monster', 'tcdb', 'aux'] as const;

export function FurnacePreparationStage({
  onModeChange,
}: {
  onModeChange?: (mode: AlchemyMode) => void;
}) {
  const session = useAlchemyCraftSession();
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [formulaPickerOpen, setFormulaPickerOpen] = useState(false);
  const [intentSuggestionsOpen, setIntentSuggestionsOpen] = useState(false);
  const [selectedIntentSuggestionId, setSelectedIntentSuggestionId] =
    useState<string | null>(null);
  const selectedIntentSuggestion = ALCHEMY_INTENT_SUGGESTIONS.find(
    (suggestion) => suggestion.id === selectedIntentSuggestionId,
  );
  return (
    <div className="space-y-6">
      <section>
        <p className="text-ink-secondary mb-3 text-xs tracking-[0.2em]">
          炼制方式
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice
            active={session.mode === 'improvised'}
            title="随心炼丹"
            detail="填写炼制目标并直接尝试，结果要等开鼎后才能知晓。"
            onClick={() =>
              onModeChange ? onModeChange('improvised') : session.setMode('improvised')
            }
          />
          <Choice
            active={session.mode === 'formula'}
            title="依方炼制"
            detail="选择已有丹方，预览时分析本炉材料是否符合要求。"
            onClick={() =>
              onModeChange ? onModeChange('formula') : session.setMode('formula')
            }
          />
        </div>
      </section>

      {session.mode === 'improvised' ? (
        <section className="space-y-3">
          <label className="block">
            <span className="text-ink-secondary text-xs tracking-[0.2em]">
              炼制目标
            </span>
            <textarea
              className={`${inkFieldVariants()} mt-3 min-h-28 resize-y`}
              value={session.intent}
              maxLength={300}
              placeholder="例如：以温养经脉、缓复气血为主，不求猛烈。"
              onChange={(event) => session.setIntent(event.target.value)}
            />
          </label>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-secondary mr-1 text-xs tracking-[0.16em]">
                丹灵建议
              </span>
              {ALCHEMY_INTENT_SUGGESTIONS.slice(0, 4).map((suggestion) => (
                <InkButton
                  key={suggestion.id}
                  variant="secondary"
                  onClick={() => session.setIntent(suggestion.prompt)}
                  aria-label={`使用炼制目标建议：${suggestion.prompt}`}
                >
                  {suggestion.label}
                </InkButton>
              ))}
              <InkButton
                variant="secondary"
                onClick={() => {
                  setSelectedIntentSuggestionId(null);
                  setIntentSuggestionsOpen(true);
                }}
              >
                更多
              </InkButton>
            </div>
            <div className="flex justify-end">
              <span className="text-ink-secondary text-xs">
                {session.intent.length} / 300
              </span>
            </div>
          </div>
          <InkNotice tone="info">
            没有丹方可供参照。丹药效果、品阶与数量都将在开鼎后揭晓。
          </InkNotice>
        </section>
      ) : (
        <section className="border-ink/15 border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-ink-secondary text-xs tracking-[0.2em]">
                本炉丹方
              </p>
              <p className="mt-2 text-lg">
                {session.formula?.name ?? '尚未选择'}
              </p>
              {session.formula ? (
                <p className="text-ink-secondary mt-1 text-xs">
                  熟练 Lv.{session.formula.mastery.level}
                </p>
              ) : null}
            </div>
            <InkButton
              variant={session.formula ? 'secondary' : 'primary'}
              onClick={() => setFormulaPickerOpen(true)}
            >
              {session.formula ? '更换丹方' : '选择丹方'}
            </InkButton>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-ink-secondary text-xs tracking-[0.2em]">
              已选材料
            </p>
            <p className="mt-1 text-sm">
              {session.materials.ids.length} / {ALCHEMY_MAX_MATERIALS} 味 · 共{' '}
              {session.totalDose} 份
            </p>
          </div>
          <InkButton
            variant="secondary"
            onClick={() => setMaterialPickerOpen(true)}
          >
            添加材料
          </InkButton>
        </div>
        <FurnaceMaterialDraftList
          selectedIds={session.materials.ids}
          materialMap={session.materials.map}
          doseMap={session.materials.doses}
          minDose={ALCHEMY_MIN_DOSE}
          maxDose={ALCHEMY_MAX_DOSE}
          disabled={session.submitting}
          onRemove={session.removeMaterial}
          onDoseChange={session.setMaterialDose}
        />
      </section>

      {session.readiness.loading ? (
        <InkNotice tone="info">正在检查材料与炼制消耗……</InkNotice>
      ) : null}
      {session.readiness.error ? (
        <InkNotice tone="warning">{session.readiness.error}</InkNotice>
      ) : null}
      {session.readiness.validation?.blockingReason ? (
        <InkNotice tone="warning">
          {session.readiness.validation.blockingReason}
        </InkNotice>
      ) : null}
      {session.readiness.estimatedSpiritStones !== null &&
      !session.readiness.loading &&
      !session.readiness.canAfford ? (
        <InkNotice tone="warning">
          灵石不足：本次炼制需要{' '}
          {session.readiness.estimatedSpiritStones.toLocaleString('zh-CN')} 枚，
          当前仅有{' '}
          {(session.cultivator?.spiritStones ?? 0).toLocaleString('zh-CN')} 枚。
        </InkNotice>
      ) : null}
      {session.analysis.error ? (
        <InkNotice tone="warning">{session.analysis.error}</InkNotice>
      ) : null}

      <div className="flex justify-end">
        <InkButton
          variant="primary"
          pending={
            session.readiness.loading ||
            (session.mode === 'formula' && session.analysis.loading)
          }
          pendingLabel={
            session.mode === 'formula' ? '正在生成预览……' : '正在检查……'
          }
          disabled={
            session.mode === 'improvised'
              ? !session.readyForImprovisedFire
              : !session.readyForFormulaAnalysis ||
                session.analysis.cooldownRemaining > 0
          }
          onClick={() =>
            session.mode === 'improvised'
              ? session.requestImprovisedFire()
              : void session.analyzeFormula()
          }
        >
          {session.mode === 'improvised'
            ? '尝试炼制'
            : session.analysis.cooldownRemaining > 0
            ? `${session.analysis.cooldownRemaining} 秒后可再次预览`
            : '查看炼制预览'}
        </InkButton>
      </div>

      <InkDetailDrawer
        isOpen={intentSuggestionsOpen}
        onClose={() => {
          setSelectedIntentSuggestionId(null);
          setIntentSuggestionsOpen(false);
        }}
        title="丹灵建议"
        description="先选择一种炼丹思路，再确认使用；填入后仍可继续修改。"
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-secondary min-w-0 truncate text-xs">
              {selectedIntentSuggestion
                ? `已选：${selectedIntentSuggestion.label}`
                : '尚未选择炼丹思路'}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <InkButton
                variant="secondary"
                onClick={() => {
                  setSelectedIntentSuggestionId(null);
                  setIntentSuggestionsOpen(false);
                }}
              >
                关闭
              </InkButton>
              <InkButton
                variant="primary"
                disabled={!selectedIntentSuggestion}
                onClick={() => {
                  if (!selectedIntentSuggestion) return;
                  session.setIntent(selectedIntentSuggestion.prompt);
                  setSelectedIntentSuggestionId(null);
                  setIntentSuggestionsOpen(false);
                }}
              >
                使用此建议
              </InkButton>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {ALCHEMY_INTENT_SUGGESTIONS.slice(4).map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              aria-pressed={selectedIntentSuggestionId === suggestion.id}
              className={`border p-4 text-left transition-colors ${
                selectedIntentSuggestionId === suggestion.id
                  ? 'border-crimson bg-crimson/[0.06] shadow-[inset_0_0_0_1px_rgba(145,36,36,0.12)]'
                  : 'border-ink/15 hover:border-crimson/50 hover:bg-ink/[0.02]'
              }`}
              onClick={() => setSelectedIntentSuggestionId(suggestion.id)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-base font-medium">{suggestion.label}</span>
                <span
                  className={`shrink-0 text-xs ${
                    selectedIntentSuggestionId === suggestion.id
                      ? 'text-crimson font-semibold'
                      : 'text-ink-secondary'
                  }`}
                >
                  {selectedIntentSuggestionId === suggestion.id ? '已选择' : '选择'}
                </span>
              </span>
              <span className="text-ink-secondary mt-2 block text-sm leading-6">
                {suggestion.prompt}
              </span>
            </button>
          ))}
        </div>
      </InkDetailDrawer>
      <InkDetailDrawer
        isOpen={materialPickerOpen}
        onClose={() => setMaterialPickerOpen(false)}
        title="选择本炉材料"
        description={`从药柜中选择材料。已选 ${session.materials.ids.length} / ${ALCHEMY_MAX_MATERIALS} 味，投入数量可在选择后调整。`}
        size="xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-secondary text-xs">
              已选择 {session.materials.ids.length} 味材料
            </span>
            <InkButton
              variant="primary"
              onClick={() => setMaterialPickerOpen(false)}
            >
              完成选择
            </InkButton>
          </div>
        }
      >
        <MaterialSelector
          cultivatorId={session.cultivator?.id}
          selectedMaterialIds={session.materials.ids}
          selectedMaterialMap={session.materials.map}
          onToggleMaterial={session.toggleMaterial}
          isSubmitting={session.submitting}
          includeMaterialTypes={[...MATERIAL_TYPES]}
          pageSize={16}
          loadingText="正在展开药材名录……"
          emptyNoticeText="暂无可用于炼丹的材料。"
          totalText={(total) => `共 ${total} 份可用材料`}
          showSelectedMaterialsPanel
        />
      </InkDetailDrawer>
      <FormulaPickerModal
        isOpen={formulaPickerOpen}
        selectedId={session.formula?.id}
        onClose={() => setFormulaPickerOpen(false)}
        onSelect={session.selectFormula}
      />
    </div>
  );
}

function Choice({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-28 border p-4 text-left transition-colors ${active ? 'border-crimson bg-crimson/5' : 'border-ink/15 hover:border-crimson/35'}`}
    >
      <span className="text-lg">{title}</span>
      <span className="text-ink-secondary mt-2 block text-sm leading-6">
        {detail}
      </span>
    </button>
  );
}
