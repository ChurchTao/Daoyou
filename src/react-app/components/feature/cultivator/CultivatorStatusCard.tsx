import { InkModal } from '@app/components/layout';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { calculateBreakthroughChance } from '@server/utils/breakthroughCalculator';
import { calculateExpProgress } from '@server/utils/cultivationUtils';
import type { Cultivator } from '@shared/types/cultivator';
import { format } from 'd3-format';
import { useMemo, useState } from 'react';

interface CultivatorStatusCardProps {
  cultivator: Cultivator;
  showDetails?: boolean;
  showTitle?: boolean;
}

export function CultivatorStatusCard({
  cultivator,
  showDetails = true,
  showTitle = true,
}: CultivatorStatusCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const statusData = useMemo(() => {
    if (!cultivator.cultivation_progress) {
      return null;
    }

    const progress = cultivator.cultivation_progress;
    const expPercent = calculateExpProgress(progress);
    const canBreakthrough = expPercent >= 60;

    // 使用新的突破概率计算系统
    let breakthroughType: 'forced' | 'normal' | 'perfect' | null = null;
    let breakthroughChance = 0;
    let breakthroughRecommendation = '';

    if (canBreakthrough) {
      try {
        const result = calculateBreakthroughChance(cultivator);
        breakthroughType = result.breakthroughType;
        breakthroughChance = result.chance;
        breakthroughRecommendation = result.recommendation;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // 容错处理：使用简单的类型判断
        if (expPercent >= 100) {
          breakthroughType = 'perfect';
        } else if (expPercent >= 80) {
          breakthroughType = 'normal';
        } else {
          breakthroughType = 'forced';
        }
      }
    }

    return {
      ...progress,
      expPercent,
      canBreakthrough,
      breakthroughType,
      breakthroughChance,
      breakthroughRecommendation,
    };
  }, [cultivator]);

  if (!statusData) {
    return null;
  }

  const getBreakthroughTypeLabel = (
    type: 'forced' | 'normal' | 'perfect' | null,
  ) => {
    if (!type) return null;
    const labels = {
      forced: { text: '强行突破', color: 'text-wood' },
      normal: { text: '常规突破', color: 'text-teal' },
      perfect: { text: '圆满突破', color: 'text-crimson' },
    };
    return labels[type];
  };

  const breakthroughLabel = getBreakthroughTypeLabel(
    statusData.breakthroughType,
  );

  return (
    <>
      <div className="border-ink/20 bg-bgpaper relative overflow-hidden border border-dashed px-4 py-3">
        {/* 顶部标题 */}
        {showTitle && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-ink flex items-center gap-2 text-lg font-bold">
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
                className="text-sm"
              >
                💡说明
              </InkButton>
            )}
          </div>
        )}

        {/* 修为进度条 */}
        <div className="mb-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-ink-secondary text-sm">修为进度</span>
            <span className="text-ink text-sm">
              {format('.2f')(statusData.expPercent)}%
            </span>
          </div>
          <div className="bg-bgpaper border-ink/15 relative h-2 w-full overflow-hidden border border-dashed">
            {/* 进度条 */}
            <div
              className={`h-full transition-all duration-500 ${
                statusData.expPercent >= 100
                  ? 'bg-crimson'
                  : statusData.expPercent >= 90
                    ? 'bg-wood'
                    : 'bg-ink'
              }`}
              style={{ width: `${Math.min(statusData.expPercent, 100)}%` }}
            />
            {/* 瓶颈期标记线（90%处） */}
            {statusData.expPercent > 80 && (
              <div
                className="bg-wood/50 absolute top-0 h-full w-0.5"
                style={{ left: '90%' }}
              />
            )}
          </div>
          <div className="text-ink-secondary mt-1 text-right text-xs">
            {statusData.cultivation_exp.toLocaleString()} /{' '}
            {statusData.exp_cap.toLocaleString()}
          </div>
        </div>

        {/* 感悟值 */}
        <div className="mb-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-ink-secondary text-sm">道心感悟</span>
            <span className="text-ink text-sm">
              {format('.2f')(statusData.comprehension_insight)} / 100
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const filled = statusData.comprehension_insight >= (i + 1) * 10;
              return (
                <div
                  key={i}
                  className={`h-2 flex-1 transition-colors ${
                    filled ? 'bg-tier-di' : 'border-ink/20 border'
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
              <div className="space-y-1">
                <div className="bg-ink/5 flex items-center gap-2 px-2 py-1">
                  <span className="text-ink-secondary">可尝试：</span>
                  <span className={`font-bold ${breakthroughLabel.color}`}>
                    {breakthroughLabel.text}
                  </span>
                  {statusData.breakthroughChance > 0 && (
                    <span className="text-sm opacity-70">
                      (成功率{format('.1%')(statusData.breakthroughChance)})
                    </span>
                  )}
                </div>
                {statusData.breakthroughRecommendation && (
                  <div className="text-ink-secondary px-2 py-1 text-sm">
                    💡 {statusData.breakthroughRecommendation}
                  </div>
                )}
              </div>
            )}

            {/* 瓶颈期说明 */}
            {statusData.bottleneck_state && (
              <div className="border-wood/35 bg-bgpaper border border-dashed p-2">
                <p className="text-ink text-sm">
                  ⚠️
                  已入瓶颈期，闭关修为获取效率降低50%。建议通过副本、战斗等方式积累感悟后再突破。
                </p>
              </div>
            )}

            {/* 心魔说明 */}
            {statusData.inner_demon && (
              <div className="bg-crimson/5 border-crimson/30 border p-2">
                <p className="text-crimson text-sm">
                  🔥 心魔缠身，突破成功率-5%。连续失败{' '}
                  {statusData.breakthrough_failures} 次，需静心调息。
                </p>
              </div>
            )}

            {/* 顿悟buff */}
            {statusData.epiphany_buff_expires_at && (
              <div className="border-gold/30 bg-bgpaper border border-dashed p-2">
                <p className="text-gold text-sm">
                  ✨ 顿悟状态，修为获取翻倍！
                </p>
              </div>
            )}
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
            <h3 className="text-ink mb-2 font-bold">📊 修为进度</h3>
            <p className="text-ink-secondary mb-2">
              修为是突破境界的前置条件。每个境界阶段都有修为上限，需通过闭关、战斗、副本等方式积累。
            </p>
            <ul className="text-ink-secondary ml-2 list-inside list-disc space-y-1">
              <li>修为达到60%时可尝试突破（但成功率较低）</li>
              <li>修为达到90%时进入瓶颈期</li>
              <li>修为达到100%且感悟≥50时为圆满突破</li>
            </ul>
          </section>

          <section>
            <h3 className="text-ink mb-2 font-bold">🌸 道心感悟</h3>
            <p className="text-ink-secondary mb-2">
              感悟值影响突破成功率和失败保护。可通过副本奇遇、战斗领悟、顿悟事件等获得。
            </p>
            <div className="bg-ink/5 border-ink/10 border p-3">
              <p className="text-ink-secondary text-xs">
                <strong>公式：</strong>成功率加成 = 1.0 + (感悟值 / 100) × 0.25
                <br />
                <strong>示例：</strong>100感悟 → 1.25倍加成
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-ink mb-2 font-bold">⚔️ 突破类型</h3>
            <div className="space-y-2">
              <div className="border-wood/35 bg-bgpaper border border-dashed p-2">
                <p className="text-wood mb-1 text-sm font-bold">
                  强行突破（60%-79%）
                </p>
                <p className="text-ink-secondary text-sm">
                  成功率×0.5，失败损失50%-70%修为
                </p>
              </div>
              <div className="border-teal/35 bg-bgpaper border border-dashed p-2">
                <p className="text-teal mb-1 text-sm font-bold">
                  常规突破（80%-99%）
                </p>
                <p className="text-ink-secondary text-sm">
                  成功率×0.75-1.05，失败损失30%-50%修为
                </p>
              </div>
              <div className="bg-gold/10 p-2">
                <p className="text-gold mb-1 text-sm font-bold">
                  圆满突破（100%+50感悟）
                </p>
                <p className="text-ink-secondary text-sm">
                  成功率×1.2，失败损失20%-30%修为，属性成长+20%
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-ink mb-2 font-bold">🚧 特殊状态</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-wood">⚠️</span>
                <div>
                  <strong className="text-ink">瓶颈期：</strong>
                  <p className="text-ink-secondary text-sm">
                    修为达90%后触发，闭关效率降低50%。需通过副本、战斗等多元化方式积累感悟。
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-crimson">🔥</span>
                <div>
                  <strong className="text-ink">心魔：</strong>
                  <p className="text-ink-secondary text-sm">
                    连续突破失败3次触发，突破成功率-5%。成功突破后自动消除。
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">✨</span>
                <div>
                  <strong className="text-ink">顿悟：</strong>
                  <p className="text-ink-secondary text-sm">
                    低概率触发（受悟性影响），修为获取翻倍，持续3天。
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <div className="border-ink/10 border-t pt-4">
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
