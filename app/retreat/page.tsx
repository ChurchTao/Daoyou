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
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Attributes } from '@/types/cultivator';
import type { BreakthroughAttemptSummary } from '@/utils/breakthroughEngine';
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

export default function RetreatPage() {
  const { cultivator, isLoading, refresh, note } = useCultivatorBundle();
  const { pushToast } = useInkUI();
  const pathname = usePathname();
  const router = useRouter();
  const [retreatYears, setRetreatYears] = useState('10');
  const [retreatResult, setRetreatResult] = useState<{
    summary: BreakthroughAttemptSummary | CultivationSummary;
    story?: string;
    storyType?: 'breakthrough' | 'lifespan' | null;
    action?: 'cultivate' | 'breakthrough';
  } | null>(null);
  const [retreatLoading, setRetreatLoading] = useState(false);

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
    const summary = retreatResult.summary as BreakthroughAttemptSummary;
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

  const handleBreakthrough = async () => {
    const parsedYears = Number(retreatYears || '0');
    if (!Number.isFinite(parsedYears) || parsedYears <= 0) {
      pushToast({
        message: '请输入闭关年限',
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
      {/* 修为状态卡片 */}
      {cultivator.cultivation_progress && (
        <CultivatorStatusCard cultivator={cultivator} showDetails={true} />
      )}

      <InkSection title="【悟道修行】">
        <div className="space-y-3 text-sm leading-6">
          <div className="p-3 bg-ink/5 rounded border border-ink/10">
            <p className="text-ink-secondary mb-2">
              当前境界：
              <InkBadge tier={cultivator.realm}>
                {cultivator.realm_stage}
              </InkBadge>
            </p>
            <p className="text-ink-secondary">
              剩余寿元：<span className="text-ink font-bold">{remainingLifespan}</span> 年
              <span className="opacity-60 ml-4">
                累计闭关 {cultivator.closed_door_years_total ?? 0} 年
              </span>
            </p>
          </div>

          <InkInput
            label="闭关年限"
            value={retreatYears}
            placeholder="输入 1~300 之间的整数"
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
                onClick={handleBreakthrough}
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

      {/* 修炼/突破结果 */}
      {retreatResult && (
        <InkSection title={retreatResult.action === 'cultivate' ? "【修炼成果】" : "【突破结果】"}>
          <div className="space-y-3 rounded border border-ink-border p-3 text-sm leading-6">
            {/* 修炼结果 */}
            {retreatResult.action === 'cultivate' && (
              <>
                <p className="font-medium">🌱 修炼有成</p>
                <p>
                  修为增长：+
                  {Number((retreatResult.summary as CultivationSummary).exp_gained)}
                </p>
                <p>
                  当前进度：
                  {(retreatResult.summary as CultivationSummary).progress}%
                </p>
                {(retreatResult.summary as CultivationSummary).insight_gained > 0 && (
                  <p>
                    感悟提升：+
                    {(retreatResult.summary as CultivationSummary).insight_gained}
                  </p>
                )}
                {(retreatResult.summary as CultivationSummary).epiphany_triggered && (
                  <p className="text-gold">✨ 触发顿悟！修为翻倍！</p>
                )}
                {(retreatResult.summary as CultivationSummary).bottleneck_entered && (
                  <p className="text-orange-500">
                    ⚠️ 已入瓶颈期，闭关效率降低。建议通过副本、战斗等方式积累感悟。
                  </p>
                )}
              </>
            )}

            {/* 突破结果 */}
            {retreatResult.action === 'breakthrough' && (
              <>
                <p className="font-medium">
                  {(retreatResult.summary as BreakthroughAttemptSummary).success
                    ? '🌅 突破成功！'
                    : (retreatResult.summary as BreakthroughAttemptSummary).lifespanDepleted
                      ? '⛅️ 坐化于洞府……'
                      : '☁️ 虽收益颇多，但境界仍未突破'}
                </p>
                <p>
                  成功率{' '}
                  {`${((retreatResult.summary as BreakthroughAttemptSummary).chance * 100).toFixed(1)}%`}
                  ｜闭关 {(retreatResult.summary as BreakthroughAttemptSummary).yearsSpent} 年
                </p>
                {attributeGrowthText && <p>属性收获：{attributeGrowthText}</p>}
                {(retreatResult.summary as BreakthroughAttemptSummary).lifespanGained > 0 && (
                  <p>
                    寿元增加：+
                    {(retreatResult.summary as BreakthroughAttemptSummary).lifespanGained} 年
                  </p>
                )}
                {retreatResult.story && (
                  <div className="whitespace-pre-line rounded p-3 text-sm leading-6">
                    {retreatResult.story}
                  </div>
                )}
                {(retreatResult.summary as BreakthroughAttemptSummary).lifespanDepleted ? (
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
