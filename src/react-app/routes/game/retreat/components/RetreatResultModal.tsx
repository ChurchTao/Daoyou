import { InkModal } from '@app/components/layout';
import { InkButton, InkIdentifyCelebration } from '@app/components/ui';
import type { RetreatResultData } from '@shared/contracts/retreat';
import type {
  BreakthroughResult,
  CultivationResult,
} from '@shared/engine/cultivation/CultivationEngine';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import type { Attributes } from '@shared/types/cultivator';
import { getAttributeInfo } from '@shared/lib/gameConceptDisplay';
import { format } from 'd3-format';
import { useMemo } from 'react';
import { isSuccessfulBreakthrough } from '../lib/retreatStream';

const COMPREHENSION_LABEL = getGameConceptLabel('comprehension_insight');

interface RetreatResultModalProps {
  isOpen: boolean;
  retreatResult: RetreatResultData | null;
  isStreaming: boolean;
  celebrationTick: number;
  onClose: () => void;
  onGoReincarnate: () => void;
}

export function RetreatResultModal({
  isOpen,
  retreatResult,
  isStreaming,
  celebrationTick,
  onClose,
  onGoReincarnate,
}: RetreatResultModalProps) {
  if (!retreatResult) {
    return null;
  }

  const title =
    retreatResult.action === 'breakthrough' ? '冲关回响' : '闭关回响';
  const showStoryPanel = Boolean(
    retreatResult.storyType || retreatResult.story || isStreaming,
  );
  const primaryLabel = isStreaming
    ? '推演中……'
    : retreatResult.depleted
      ? '转世重修 →'
      : '收拢心神';
  const canGoAllocateAttributes =
    !isStreaming &&
    isSuccessfulBreakthrough(retreatResult) &&
    'attributePointReward' in retreatResult.summary &&
    retreatResult.summary.attributePointReward > 0;

  return (
    <>
      <InkModal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        className="max-w-2xl"
        footer={
          <div className="flex w-full flex-wrap gap-3">
            {canGoAllocateAttributes ? (
              <InkButton
                href="/game/cultivator/attributes"
                variant="secondary"
                className="w-full sm:w-auto"
              >
                分配根基属性
              </InkButton>
            ) : null}
            <InkButton
              variant="primary"
              onClick={retreatResult.depleted ? onGoReincarnate : onClose}
              disabled={isStreaming}
              className={canGoAllocateAttributes ? 'w-full sm:w-auto' : 'w-full'}
            >
              {primaryLabel}
            </InkButton>
          </div>
        }
      >
        <div className="space-y-5">
          {showStoryPanel ? (
            <div className="border-ink/10 bg-bgpaper/70 border border-dashed p-4 text-sm leading-7 whitespace-pre-line">
              {getStoryText(retreatResult, isStreaming)}
            </div>
          ) : null}

          {retreatResult.action === 'cultivate' ? (
            <CultivationResultContent retreatResult={retreatResult} />
          ) : (
            <BreakthroughResultContent retreatResult={retreatResult} />
          )}
        </div>
      </InkModal>

      {isOpen &&
      celebrationTick > 0 &&
      isSuccessfulBreakthrough(retreatResult) ? (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      ) : null}
    </>
  );
}

function CultivationResultContent({
  retreatResult,
}: {
  retreatResult: RetreatResultData;
}) {
  const summary = retreatResult.summary as CultivationResult['summary'];

  return (
    <div className="border-ink/10 space-y-3 border border-dashed bg-[rgba(255,252,245,0.78)] p-4 text-sm leading-7">
      <p className="text-ink text-base font-medium">🌱 修炼有成</p>
      <p>修为增长：+{Number(summary.exp_gained)}</p>
      <p>当前进度：{format('.2f')(summary.progress)}%</p>

      {summary.insight_gained > 0 ? (
        <p>
          {COMPREHENSION_LABEL}：+{summary.insight_gained}
          {summary.epiphany_triggered ? (
            <span className="text-gold ml-1">（顿悟加持）</span>
          ) : null}
        </p>
      ) : null}

      {summary.epiphany_triggered ? (
        <p className="text-gold">✨ 触发顿悟！修为翻倍，感悟大增！</p>
      ) : null}

      {summary.bottleneck_entered ? (
        <p className="text-wood">
          ⚠️ 已入瓶颈期，闭关效率降低。建议通过副本、战斗等方式寻求突破。
        </p>
      ) : null}
    </div>
  );
}

function BreakthroughResultContent({
  retreatResult,
}: {
  retreatResult: RetreatResultData;
}) {
  const summary = retreatResult.summary as BreakthroughResult['summary'];
  const buffBonus = Math.max(
    0,
    (summary.modifiers?.pillBonus ?? 0) + (summary.modifiers?.fateBonus ?? 0),
  );
  const displayedBaseChance = Math.max(
    0,
    Math.min(1, summary.chance - buffBonus),
  );
  const realmChangeText =
    summary.success && summary.toRealm && summary.toStage
      ? `${summary.fromRealm}${summary.fromStage} → ${summary.toRealm}${summary.toStage}`
      : '';

  const attributeGrowthText = useMemo(() => {
    if (!summary.attributeGrowth) return '';

    const mapping: Array<{ key: keyof Attributes; label: string }> = [
      { key: 'vitality', label: getAttributeInfo('vitality').label },
      { key: 'spirit', label: getAttributeInfo('spirit').label },
      { key: 'speed', label: getAttributeInfo('speed').label },
      { key: 'willpower', label: getAttributeInfo('willpower').label },
    ];

    return mapping
      .map(({ key, label }) => {
        const gain = summary.attributeGrowth[key];
        return gain ? `${label}+${gain}` : null;
      })
      .filter(Boolean)
      .join('，');
  }, [summary.attributeGrowth]);

  return (
    <div className="border-ink/10 space-y-3 border border-dashed bg-[rgba(255,252,245,0.78)] p-4 text-sm leading-7">
      <p className="text-ink text-base font-medium">
        {summary.success ? '🌅 突破成功！' : '☁️ 冲关失败'}
      </p>

      <p>成功率 {format('.1%')(Math.min(summary.chance, 1))}</p>
      {buffBonus > 0 ? (
        <p className="text-emerald-700">
          机缘加成：+{format('.1%')(buffBonus)}（
          {format('.1%')(displayedBaseChance)} →{' '}
          {format('.1%')(Math.min(summary.chance, 1))}）
        </p>
      ) : null}

      {realmChangeText ? <p>境界突破：{realmChangeText}</p> : null}

      {'naturalAttributeGrowth' in summary &&
      summary.naturalAttributeGrowth > 0 ? (
        <p>自然成长：五维各 +{summary.naturalAttributeGrowth}</p>
      ) : null}

      {summary.attributePointReward > 0 ? (
        <p>根基收益：获得 {summary.attributePointReward} 点可分配属性点</p>
      ) : !('naturalAttributeGrowth' in summary) && attributeGrowthText ? (
        <p>属性收获：{attributeGrowthText}</p>
      ) : null}

      {summary.lifespanGained > 0 ? (
        <p>寿元增加：+{summary.lifespanGained} 年</p>
      ) : null}

      {!summary.success ? (
        <div className="border-wood/35 bg-bgpaper mt-1 space-y-2 border border-dashed p-3">
          <p className="text-wood font-medium">【道途坎坷，受创不轻】</p>

          {summary.exp_lost ? (
            <p className="text-wood">
              修为损失：-{summary.exp_lost} 点
              <span className="ml-1 text-xs opacity-80">
                （冲关失败，法力涣散）
              </span>
            </p>
          ) : null}

          {summary.insight_change && summary.insight_change < 0 ? (
            <p className="text-wood">
              道行感悟：{summary.insight_change}
              <span className="ml-1 text-xs opacity-80">
                （未能破关，心生迷惘）
              </span>
            </p>
          ) : null}

          {summary.inner_demon_triggered ? (
            <p className="text-crimson font-medium">
              ⚠️ 屡战屡败，已生心魔！下次突破成功率将降低
              <span className="ml-1 text-xs opacity-80">
                （可通过副本、战斗等历练消除）
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getStoryText(
  retreatResult: RetreatResultData,
  isStreaming: boolean,
): string {
  if (retreatResult.story) {
    return retreatResult.story;
  }

  if (isStreaming) {
    return '天机推演中……';
  }

  return '天机推演中断，此番结果已然落定。';
}
