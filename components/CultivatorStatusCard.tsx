'use client';

import { InkBadge, InkButton } from '@/components/InkComponents';
import { InkModal } from '@/components/InkModal';
import type { Cultivator } from '@/types/cultivator';
import { calculateExpProgress } from '@/utils/cultivationUtils';
import { useMemo, useState } from 'react';

interface CultivatorStatusCardProps {
  cultivator: Cultivator;
  showDetails?: boolean;
}

export function CultivatorStatusCard({
  cultivator,
  showDetails = true,
}: CultivatorStatusCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const statusData = useMemo(() => {
    if (!cultivator.cultivation_progress) {
      return null;
    }

    const progress = cultivator.cultivation_progress;
    const expPercent = calculateExpProgress(progress);
    const canBreakthrough = expPercent >= 60;

    // 计算突破类型
    let breakthroughType: 'forced' | 'normal' | 'perfect' | null = null;
    if (expPercent >= 100) {
      breakthroughType = 'perfect';
    } else if (expPercent >= 80) {
      breakthroughType = 'normal';
    } else if (expPercent >= 60) {
      breakthroughType = 'forced';
    }

    return {
      ...progress,
      expPercent,
      canBreakthrough,
      breakthroughType,
    };
  }, [cultivator.cultivation_progress]);

  if (!statusData) {
    return null;
  }

  const getBreakthroughTypeLabel = (
    type: 'forced' | 'normal' | 'perfect' | null,
  ) => {
    if (!type) return null;
    const labels = {
      forced: { text: '强行突破', color: 'text-orange-500' },
      normal: { text: '常规突破', color: 'text-blue-500' },
      perfect: { text: '圆满突破', color: 'text-crimson' },
    };
    return labels[type];
  };

  const breakthroughLabel = getBreakthroughTypeLabel(
    statusData.breakthroughType,
  );

  return (
    <>
      <div className="px-4 py-3 border border-ink/20 rounded-lg bg-ink/5 shadow-sm relative overflow-hidden">
        {/* 顶部标题 */}
        <div className="flex justify-between items-center mb-4">
          <div className="font-bold text-lg text-ink flex items-center gap-2">
            <span>⚡️ 修炼状态</span>
            <span>
              {statusData.bottleneck_state && (
                <InkBadge tone="warning">瓶颈</InkBadge>
              )}
              {statusData.inner_demon && (
                <InkBadge tone="danger">心魔</InkBadge>
              )}
            </span>
          </div>
          {showDetails && (
            <InkButton
              variant="secondary"
              onClick={() => setShowExplanation(true)}
              className="text-xs"
            >
              💡说明
            </InkButton>
          )}
        </div>

        {/* 修为进度条 */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-ink-secondary">修为进度</span>
            <span className="text-sm text-ink">
              {statusData.expPercent.toFixed(2)}%
            </span>
          </div>
          <div className="relative w-full border-ink/20 border rounded-full h-3 overflow-hidden">
            {/* 进度条 */}
            <div
              className={`h-full transition-all duration-500 ${
                statusData.expPercent >= 100
                  ? 'bg-crimson'
                  : statusData.expPercent >= 90
                    ? 'bg-linear-to-r from-blue-500 to-cyan-500'
                    : 'bg-linear-to-r from-ink to-[#16a951]'
              }`}
              style={{ width: `${Math.min(statusData.expPercent, 100)}%` }}
            />
            {/* 瓶颈期标记线（90%处） */}
            {statusData.expPercent > 80 && (
              <div
                className="absolute top-0 h-full w-0.5 bg-orange-500/50"
                style={{ left: '90%' }}
              />
            )}
          </div>
          <div className="text-xs text-ink-secondary mt-1 text-right">
            {statusData.cultivation_exp.toLocaleString()} /{' '}
            {statusData.exp_cap.toLocaleString()}
          </div>
        </div>

        {/* 感悟值 */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-ink-secondary">道心感悟</span>
            <span className="text-sm text-ink">
              {statusData.comprehension_insight} / 100
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const filled = statusData.comprehension_insight >= (i + 1) * 10;
              return (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-sm transition-colors ${
                    filled ? 'bg-[#003472]' : 'border-ink/20 border'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* 状态提示 */}
        {showDetails && (
          <div className="space-y-2 text-sm">
            {/* 突破可用性 */}
            {statusData.canBreakthrough && breakthroughLabel && (
              <div className="flex items-center gap-2 px-2 py-1 bg-ink/5 rounded">
                <span className="text-ink-secondary">可尝试：</span>
                <span className={`font-bold ${breakthroughLabel.color}`}>
                  {breakthroughLabel.text}
                </span>
                {statusData.breakthroughType === 'perfect' && (
                  <span className="text-xs opacity-70">(成功率最高)</span>
                )}
              </div>
            )}

            {/* 瓶颈期说明 */}
            {statusData.bottleneck_state && (
              <div className="p-2 bg-orange-500/5 rounded border border-orange-500/30">
                <p className="text-xs text-ink">
                  ⚠️
                  已入瓶颈期，闭关修为获取效率降低50%。建议通过副本、战斗等方式积累感悟后再突破。
                </p>
              </div>
            )}

            {/* 心魔说明 */}
            {statusData.inner_demon && (
              <div className="p-2 bg-crimson/5 rounded border border-crimson/30">
                <p className="text-xs text-crimson">
                  🔥 心魔缠身，突破成功率-5%。连续失败{' '}
                  {statusData.breakthrough_failures} 次，需静心调息。
                </p>
              </div>
            )}

            {/* 顿悟buff */}
            {/* {statusData.epiphany_buff_expires_at && ( */}
            <div className="p-2 bg-yellow-600/5 rounded border border-yellow-600/30">
              <p className="text-xs text-yellow-600">
                ✨ 顿悟状态，修为获取翻倍！
              </p>
            </div>
            {/* )} */}
          </div>
        )}
      </div>

      {/* 说明弹窗 */}
      <InkModal
        isOpen={showExplanation}
        onClose={() => setShowExplanation(false)}
        title="修炼系统说明"
      >
        <div className="space-y-4 text-sm leading-relaxed">
          <section>
            <h3 className="font-bold text-ink mb-2">📊 修为进度</h3>
            <p className="text-ink-secondary mb-2">
              修为是突破境界的前置条件。每个境界阶段都有修为上限，需通过闭关、战斗、副本等方式积累。
            </p>
            <ul className="list-disc list-inside text-ink-secondary space-y-1 ml-2">
              <li>修为达到60%时可尝试突破（但成功率较低）</li>
              <li>修为达到90%时进入瓶颈期</li>
              <li>修为达到100%且感悟≥50时为圆满突破</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-ink mb-2">🌸 道心感悟</h3>
            <p className="text-ink-secondary mb-2">
              感悟值影响突破成功率和失败保护。可通过副本奇遇、战斗领悟、顿悟事件等获得。
            </p>
            <div className="bg-ink/5 p-3 rounded border border-ink/10">
              <p className="text-xs text-ink-secondary">
                <strong>公式：</strong>成功率加成 = 1.0 + 感悟值/150
                <br />
                <strong>示例：</strong>50感悟 → 1.33倍加成
              </p>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-ink mb-2">⚔️ 突破类型</h3>
            <div className="space-y-2">
              <div className="p-2 bg-orange-500/10 rounded">
                <p className="font-bold text-orange-500 text-xs mb-1">
                  强行突破（60%-79%）
                </p>
                <p className="text-xs text-ink-secondary">
                  成功率×0.5，失败损失50%-70%修为
                </p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded">
                <p className="font-bold text-blue-500 text-xs mb-1">
                  常规突破（80%-99%）
                </p>
                <p className="text-xs text-ink-secondary">
                  成功率×0.75-1.05，失败损失30%-50%修为
                </p>
              </div>
              <div className="p-2 bg-gold/10 rounded">
                <p className="font-bold text-gold text-xs mb-1">
                  圆满突破（100%+50感悟）
                </p>
                <p className="text-xs text-ink-secondary">
                  成功率×1.2，失败损失20%-30%修为，属性成长+20%
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-ink mb-2">🚧 特殊状态</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">⚠️</span>
                <div>
                  <strong className="text-ink">瓶颈期：</strong>
                  <p className="text-xs text-ink-secondary">
                    修为达90%后触发，闭关效率降低50%。需通过副本、战斗等多元化方式积累感悟。
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-crimson">🔥</span>
                <div>
                  <strong className="text-ink">心魔：</strong>
                  <p className="text-xs text-ink-secondary">
                    连续突破失败3次触发，突破成功率-5%。成功突破后自动消除。
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">✨</span>
                <div>
                  <strong className="text-ink">顿悟：</strong>
                  <p className="text-xs text-ink-secondary">
                    低概率触发（受悟性影响），修为获取翻倍，持续3天。
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <div className="pt-4 border-t border-ink/10">
            <InkButton
              variant="primary"
              className="w-full"
              onClick={() => setShowExplanation(false)}
            >
              明白了
            </InkButton>
          </div>
        </div>
      </InkModal>
    </>
  );
}
