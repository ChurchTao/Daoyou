'use client';

import { format } from 'd3-format';
import { InkSection } from '@/components/layout';
import { InkButton } from '@/components/ui';
import type {
  BreakthroughResult,
  CultivationResult,
} from '@/engine/cultivation/CultivationEngine';
import type { Attributes } from '@/types/cultivator';
import { useMemo } from 'react';
import type { RetreatResultData } from '../hooks/useRetreatViewModel';

interface RetreatResultSectionProps {
  retreatResult: RetreatResultData;
  onGoReincarnate: () => void;
}

/**
 * 修炼/突破结果展示组件
 */
export function RetreatResultSection({
  retreatResult,
  onGoReincarnate,
}: RetreatResultSectionProps) {
  const isCultivation = retreatResult.action === 'cultivate';

  if (isCultivation) {
    return (
      <CultivationResultContent
        retreatResult={retreatResult}
        onGoReincarnate={onGoReincarnate}
      />
    );
  }

  return <BreakthroughResultContent retreatResult={retreatResult} />;
}

function CultivationResultContent({
  retreatResult,
  onGoReincarnate,
}: RetreatResultSectionProps) {
  const summary = retreatResult.summary as CultivationResult['summary'];

  return (
    <InkSection title="【修炼成果】">
      <div className="space-y-3 rounded border border-ink-border p-3 text-sm leading-6">
        <p className="font-medium">🌱 修炼有成</p>
        <p>修为增长：+{Number(summary.exp_gained)}</p>
        <p>当前进度：{format('.2f')(summary.progress)}%</p>

        {summary.insight_gained > 0 && (
          <p>感悟提升：+{summary.insight_gained}</p>
        )}

        {summary.epiphany_triggered && (
          <p className="text-gold">✨ 触发顿悟！修为翻倍！</p>
        )}

        {summary.bottleneck_entered && (
          <p className="text-orange-500">
            ⚠️ 已入瓶颈期，闭关效率降低。建议通过副本、战斗等方式积累感悟。
          </p>
        )}

        {retreatResult.story && (
          <div className="whitespace-pre-line rounded p-3 text-sm leading-6">
            {retreatResult.story}
          </div>
        )}

        {retreatResult.depleted && (
          <InkButton variant="primary" onClick={onGoReincarnate}>
            转世重修 →
          </InkButton>
        )}
      </div>
    </InkSection>
  );
}

function BreakthroughResultContent({
  retreatResult,
}: {
  retreatResult: RetreatResultData;
}) {
  const summary = retreatResult.summary as BreakthroughResult['summary'];

  const attributeGrowthText = useMemo(() => {
    if (!summary.attributeGrowth) return '';

    const mapping: Array<{ key: keyof Attributes; label: string }> = [
      { key: 'vitality', label: '体魄' },
      { key: 'spirit', label: '灵力' },
      { key: 'speed', label: '身法' },
      { key: 'willpower', label: '神识' },
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
    <InkSection title="【突破结果】">
      <div className="space-y-3 rounded border border-ink-border p-3 text-sm leading-6">
        <p className="font-medium">
          {summary.success ? '🌅 突破成功！' : '☁️ 冲关失败'}
        </p>

        <p>成功率 {format('.1%')(Math.min(summary.chance, 1))}</p>

        {attributeGrowthText && <p>属性收获：{attributeGrowthText}</p>}

        {summary.lifespanGained > 0 && (
          <p>寿元增加：+{summary.lifespanGained} 年</p>
        )}

        {/* 失败时显示损失信息 */}
        {!summary.success && (
          <div className="mt-3 p-3 bg-orange-50/50 border border-orange-200 rounded-lg space-y-2">
            <p className="text-orange-800 font-medium">
              【道途坎坷，受创不轻】
            </p>

            {summary.exp_lost && (
              <p className="text-orange-700">
                修为损失：-{summary.exp_lost} 点
                <span className="text-xs ml-1 opacity-80">
                  （冲关失败，真元涣散）
                </span>
              </p>
            )}

            {summary.insight_change && summary.insight_change < 0 && (
              <p className="text-orange-700">
                道行感悟：{summary.insight_change}
                <span className="text-xs ml-1 opacity-80">
                  （未能破关，心生迷惘）
                </span>
              </p>
            )}

            {summary.inner_demon_triggered && (
              <p className="text-red-600 font-medium">
                ⚠️ 屡战屡败，已生心魔！下次突破成功率将降低
                <span className="text-xs ml-1 opacity-80">
                  （可通过副本、战斗等历练消除）
                </span>
              </p>
            )}
          </div>
        )}

        {retreatResult.story && (
          <div className="whitespace-pre-line rounded p-3 text-sm leading-6">
            {retreatResult.story}
          </div>
        )}
      </div>
    </InkSection>
  );
}
