'use client';

import { CultivatorStatusCard } from '@/components/CultivatorStatusCard';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { InkModal } from '@/components/InkModal';
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Attributes } from '@/types/cultivator';
import { type BreakthroughAttemptSummary } from '@/utils/breakthroughCalculator';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface CultivationSummary {
  exp_gained: number;
  exp_before: number;
  exp_after: number;
  insight_gained: number;
  epiphany_triggered: boolean;
  bottleneck_entered: boolean;
  can_breakthrough: boolean;
  progress: number;
}

interface ExtendedBreakthroughSummary extends BreakthroughAttemptSummary {
  exp_lost?: number;
  insight_change?: number;
  inner_demon_triggered?: boolean;
}

export default function RetreatPage() {
  const { cultivator, isLoading, refresh, note } = useCultivatorBundle();
  const { pushToast } = useInkUI();
  const pathname = usePathname();
  const router = useRouter();
  const [retreatYears, setRetreatYears] = useState('10');
  const [retreatResult, setRetreatResult] = useState<{
    summary: ExtendedBreakthroughSummary | CultivationSummary;
    story?: string;
    storyType?: 'breakthrough' | 'lifespan' | null;
    action?: 'cultivate' | 'breakthrough';
  } | null>(null);
  const [retreatLoading, setRetreatLoading] = useState(false);
  const [showBreakthroughConfirm, setShowBreakthroughConfirm] = useState(false);

  // 计算修为进度
  const cultivationProgress = useMemo(() => {
    if (!cultivator?.cultivation_progress) return null;
    const progress = cultivator.cultivation_progress;
    const percent = Math.floor(
      (progress.cultivation_exp / progress.exp_cap) * 100,
    );
    const canBreakthrough = percent >= 60;

    // 计算突破类型
    let breakthroughType: 'forced' | 'normal' | 'perfect' | null = null;
    if (percent >= 100 && progress.comprehension_insight >= 50) {
      breakthroughType = 'perfect';
    } else if (percent >= 80) {
      breakthroughType = 'normal';
    } else if (percent >= 60) {
      breakthroughType = 'forced';
    }

    return {
      ...progress,
      percent,
      canBreakthrough,
      breakthroughType,
    };
  }, [cultivator]);

  const attributeGrowthText = useMemo(() => {
    if (!retreatResult || retreatResult.action !== 'breakthrough') return '';
    const summary = retreatResult.summary as ExtendedBreakthroughSummary;
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
  }, [retreatResult]);

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">洞府封闭中，稍候片刻……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell
        title="【洞府】"
        subtitle="须有道基，方可入定"
        backHref="/"
        currentPath={pathname}
      >
        <InkNotice>
          尚未觉醒灵根，无法入驻洞府。
          <InkButton href="/create" variant="primary" className="ml-2">
            前往觉醒 →
          </InkButton>
        </InkNotice>
      </InkPageShell>
    );
  }

  const remainingLifespan = Math.max(cultivator.lifespan - cultivator.age, 0);

  const handleRetreatYearsChange = (value: string) => {
    const numeric = value.replace(/[^\d]/g, '');
    setRetreatYears(numeric);
  };

  const handleRetreat = async () => {
    const parsedYears = Number(retreatYears || '0');
    if (!Number.isFinite(parsedYears) || parsedYears <= 0) {
      pushToast({
        message: '闭关年限似乎不对哦，道友请三思而行',
        tone: 'warning',
      });
      return;
    }
    setRetreatLoading(true);
    try {
      const response = await fetch('/api/cultivator/retreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          years: parsedYears,
          action: 'cultivate',
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '闭关失败');
      }
      setRetreatResult(payload.data);
      await refresh();
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '闭关失败，请稍后再试',
        tone: 'danger',
      });
    } finally {
      setRetreatLoading(false);
    }
  };

  const handleBreakthroughClick = () => {
    const parsedYears = Number(retreatYears || '0');
    if (!Number.isFinite(parsedYears) || parsedYears <= 0) {
      pushToast({
        message: '请输入闭关年限',
        tone: 'warning',
      });
      return;
    }
    setShowBreakthroughConfirm(true);
  };

  const handleBreakthrough = async () => {
    setShowBreakthroughConfirm(false);
    const parsedYears = Number(retreatYears || '0');
    setRetreatLoading(true);
    try {
      const response = await fetch('/api/cultivator/retreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          years: parsedYears,
          action: 'breakthrough',
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '突破失败');
      }
      setRetreatResult(payload.data);
      await refresh();
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '突破失败，请稍后再试',
        tone: 'danger',
      });
    } finally {
      setRetreatLoading(false);
    }
  };

  const handleGoReincarnate = () => {
    if (retreatResult?.story && typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'reincarnateContext',
        JSON.stringify({
          story: retreatResult.story,
          name: cultivator.name,
          realm: cultivator.realm,
          realm_stage: cultivator.realm_stage,
        }),
      );
    }
    router.push('/reincarnate');
  };

  return (
    <InkPageShell
      title="【洞府】"
      subtitle="莫负洞天一寸时"
      backHref="/"
      currentPath={pathname}
      note={note}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="【悟道修行】">
        <div className="space-y-3 text-sm leading-6">
          <div className="p-3 border border-ink/20 rounded-lg bg-ink/5 shadow-sm">
            <p className="text-ink-secondary mb-2">
              当前境界：
              <InkBadge tier={cultivator.realm}>
                {cultivator.realm_stage}
              </InkBadge>
            </p>
            <p className="text-ink-secondary">
              剩余寿元：
              <span className="text-ink font-bold">{remainingLifespan}</span> 年
              <span className="opacity-60 ml-4">
                累计闭关 {cultivator.closed_door_years_total ?? 0} 年
              </span>
            </p>
          </div>
          {/* 修为状态卡片 */}
          {cultivator.cultivation_progress && (
            <CultivatorStatusCard cultivator={cultivator} showDetails={true} />
          )}

          <InkInput
            label="闭关年限"
            value={retreatYears}
            placeholder="输入 1~200 之间的整数"
            onChange={handleRetreatYearsChange}
            hint="闭关越久修为增长越多，但会消耗相应寿元"
          />

          {/* 双按钮模式 */}
          <div className="flex gap-2">
            <InkButton
              onClick={handleRetreat}
              disabled={retreatLoading}
              className="flex-1"
            >
              {retreatLoading ? '修炼中……' : '🧘 闭关修炼'}
            </InkButton>

            {cultivationProgress?.canBreakthrough && (
              <InkButton
                onClick={handleBreakthroughClick}
                disabled={retreatLoading}
                variant="primary"
                className="flex-1"
              >
                {retreatLoading ? '冲关中……' : '⚡️ 尝试突破'}
              </InkButton>
            )}
          </div>

          {!cultivationProgress?.canBreakthrough && (
            <p className="text-sm opacity-70">提示：修为达到60%时可尝试突破</p>
          )}
        </div>
      </InkSection>

      {/* 突破确认弹窗 */}
      <InkModal
        isOpen={showBreakthroughConfirm}
        onClose={() => setShowBreakthroughConfirm(false)}
        title="【突破确认】"
        footer={
          <div className="flex gap-3 mt-4">
            <InkButton
              onClick={() => setShowBreakthroughConfirm(false)}
              className="flex-1"
            >
              再做准备
            </InkButton>
            <InkButton
              onClick={handleBreakthrough}
              variant="primary"
              className="flex-1"
            >
              破关！
            </InkButton>
          </div>
        }
      >
        <div className="mt-4 space-y-3 text-sm leading-6">
          <p className="text-ink-secondary">
            道友确定要尝试突破吗？此举关乎道途，不可不慎重。
          </p>

          <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2">
            <p className="text-amber-900 font-medium">【突破风险】</p>
            <p className="text-amber-800 text-xs">
              • 若冲关失败，修为将有所损耗，真元涣散
            </p>
            <p className="text-amber-800 text-xs">
              • 道行感悟将有所降低，心生迷惘
            </p>
            <p className="text-amber-800 text-xs">
              • 连续失败三次将生心魔，影响后续突破
            </p>
            <p className="text-amber-800 text-xs">• 消耗{retreatYears}年寿元</p>
          </div>

          {cultivationProgress && (
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
              <p className="text-blue-900 font-medium">【当前状态】</p>
              <p className="text-blue-800 text-xs">
                修为进度：{cultivationProgress.percent}%
              </p>
              <p className="text-blue-800 text-xs">
                道行感悟：{cultivationProgress.comprehension_insight}/100
              </p>
              <p className="text-blue-800 text-xs">
                突破类型：
                {cultivationProgress.breakthroughType === 'perfect' &&
                  '圆满突破（修为100%+感悟50+）'}
                {cultivationProgress.breakthroughType === 'normal' &&
                  '正常突破（修为80%+）'}
                {cultivationProgress.breakthroughType === 'forced' &&
                  '强行突破（属性成长减少20%）'}
              </p>
            </div>
          )}

          <p className="text-ink-secondary text-xs text-center opacity-80">
            修行之路，本就充满坎坷。机缘造化，在此一举。
          </p>
        </div>
      </InkModal>

      {/* 修炼/突破结果 */}
      {retreatResult && (
        <InkSection
          title={
            retreatResult.action === 'cultivate'
              ? '【修炼成果】'
              : '【突破结果】'
          }
        >
          <div className="space-y-3 rounded border border-ink-border p-3 text-sm leading-6">
            {/* 修炼结果 */}
            {retreatResult.action === 'cultivate' && (
              <>
                <p className="font-medium">🌱 修炼有成</p>
                <p>
                  修为增长：+
                  {Number(
                    (retreatResult.summary as CultivationSummary).exp_gained,
                  )}
                </p>
                <p>
                  当前进度：
                  {(retreatResult.summary as CultivationSummary).progress}%
                </p>
                {(retreatResult.summary as CultivationSummary).insight_gained >
                  0 && (
                  <p>
                    感悟提升：+
                    {
                      (retreatResult.summary as CultivationSummary)
                        .insight_gained
                    }
                  </p>
                )}
                {(retreatResult.summary as CultivationSummary)
                  .epiphany_triggered && (
                  <p className="text-gold">✨ 触发顿悟！修为翻倍！</p>
                )}
                {(retreatResult.summary as CultivationSummary)
                  .bottleneck_entered && (
                  <p className="text-orange-500">
                    ⚠️
                    已入瓶颈期，闭关效率降低。建议通过副本、战斗等方式积累感悟。
                  </p>
                )}
              </>
            )}

            {/* 突破结果 */}
            {retreatResult.action === 'breakthrough' && (
              <>
                <p className="font-medium">
                  {(retreatResult.summary as ExtendedBreakthroughSummary)
                    .success
                    ? '🌅 突破成功！'
                    : (retreatResult.summary as ExtendedBreakthroughSummary)
                          .lifespanDepleted
                      ? '⛅️ 坐化于洞府……'
                      : '☁️ 冲关失败'}
                </p>
                <p>
                  成功率{' '}
                  {`${Math.min((retreatResult.summary as ExtendedBreakthroughSummary).chance * 100, 100).toFixed(1)}%`}
                  ｜闭关{' '}
                  {
                    (retreatResult.summary as ExtendedBreakthroughSummary)
                      .yearsSpent
                  }{' '}
                  年
                </p>
                {attributeGrowthText && <p>属性收获：{attributeGrowthText}</p>}
                {(retreatResult.summary as ExtendedBreakthroughSummary)
                  .lifespanGained > 0 && (
                  <p>
                    寿元增加：+
                    {
                      (retreatResult.summary as ExtendedBreakthroughSummary)
                        .lifespanGained
                    }{' '}
                    年
                  </p>
                )}

                {/* 失败时显示损失信息 */}
                {!(retreatResult.summary as ExtendedBreakthroughSummary)
                  .success &&
                  !(retreatResult.summary as ExtendedBreakthroughSummary)
                    .lifespanDepleted && (
                    <div className="mt-3 p-3 bg-orange-50/50 border border-orange-200 rounded-lg space-y-2">
                      <p className="text-orange-800 font-medium">
                        【道途坎坷，受创不轻】
                      </p>
                      {(retreatResult.summary as ExtendedBreakthroughSummary)
                        .exp_lost && (
                        <p className="text-orange-700">
                          修为损失：-
                          {
                            (
                              retreatResult.summary as ExtendedBreakthroughSummary
                            ).exp_lost
                          }{' '}
                          点
                          <span className="text-xs ml-1 opacity-80">
                            （冲关失败，真元涣散）
                          </span>
                        </p>
                      )}
                      {(retreatResult.summary as ExtendedBreakthroughSummary)
                        .insight_change &&
                        (retreatResult.summary as ExtendedBreakthroughSummary)
                          .insight_change! < 0 && (
                          <p className="text-orange-700">
                            道行感悟：
                            {
                              (
                                retreatResult.summary as ExtendedBreakthroughSummary
                              ).insight_change
                            }
                            <span className="text-xs ml-1 opacity-80">
                              （未能破关，心生迷惘）
                            </span>
                          </p>
                        )}
                      {(retreatResult.summary as ExtendedBreakthroughSummary)
                        .inner_demon_triggered && (
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
                {(retreatResult.summary as ExtendedBreakthroughSummary)
                  .lifespanDepleted ? (
                  <InkButton variant="primary" onClick={handleGoReincarnate}>
                    转世重修 →
                  </InkButton>
                ) : null}
              </>
            )}
          </div>
        </InkSection>
      )}
    </InkPageShell>
  );
}
