'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Attributes } from '@/types/cultivator';
import type { BreakthroughAttemptSummary } from '@/utils/breakthroughEngine';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function RetreatPage() {
  const { cultivator, isLoading, refresh, note } = useCultivatorBundle();
  const pathname = usePathname();
  const router = useRouter();
  const [retreatYears, setRetreatYears] = useState('10');
  const [retreatResult, setRetreatResult] = useState<{
    summary: BreakthroughAttemptSummary;
    story?: string;
    storyType?: 'breakthrough' | 'lifespan' | null;
  } | null>(null);
  const [retreatError, setRetreatError] = useState<string | null>(null);
  const [retreatLoading, setRetreatLoading] = useState(false);
  const attributeGrowthText = useMemo(() => {
    if (!retreatResult?.summary?.attributeGrowth) return '';
    const mapping: Array<{ key: keyof Attributes; label: string }> = [
      { key: 'vitality', label: '体魄' },
      { key: 'spirit', label: '灵力' },
      { key: 'speed', label: '身法' },
      { key: 'willpower', label: '神识' },
    ];
    return mapping
      .map(({ key, label }) => {
        const gain = retreatResult.summary.attributeGrowth[key];
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
        title="【闭关突破】"
        subtitle="须有道基，方可入定"
        backHref="/"
        currentPath={pathname}
      >
        <InkNotice>
          尚未觉醒灵根，无法闭关。
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
      setRetreatError('请输入合法的闭关年限');
      return;
    }
    setRetreatLoading(true);
    setRetreatError(null);
    try {
      const response = await fetch('/api/cultivator/retreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          years: parsedYears,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '闭关失败');
      }
      setRetreatResult(payload.data);
      await refresh();
    } catch (error) {
      setRetreatError(
        error instanceof Error ? error.message : '闭关失败，请稍后再试',
      );
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
      title="【闭关突破】"
      subtitle="莫负洞天一寸时"
      backHref="/"
      currentPath={pathname}
      note={note}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回</InkButton>
          <InkButton href="/battle" variant="secondary">
            推演战力
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="【悟道修行】">
        <div className="space-y-2 text-sm leading-6">
          <p>
            当前境界：
            <InkBadge tier={cultivator.realm}>
              {cultivator.realm_stage}
            </InkBadge>
          </p>
          <p>
            剩余寿元：{remainingLifespan} 年｜累计闭关{' '}
            {cultivator.closed_door_years_total ?? 0} 年
          </p>
          <InkInput
            label="闭关年限"
            value={retreatYears}
            placeholder="输入 1~500 之间的整数"
            onChange={handleRetreatYearsChange}
            hint="闭关越久突破几率越高，但寿元也随之消耗"
          />
          {retreatError && <InkNotice tone="danger">{retreatError}</InkNotice>}
          <InkButton onClick={handleRetreat} disabled={retreatLoading}>
            {retreatLoading ? '推演中……' : '闭关冲关'}
          </InkButton>
        </div>
      </InkSection>

      {retreatResult && (
        <InkSection title="【闭关结果】">
          <div className="space-y-3 rounded border border-ink-border p-3 text-sm leading-6">
            <p className="font-medium">
              {retreatResult.summary.success
                ? '🌅 突破成功！'
                : retreatResult.summary.lifespanDepleted
                  ? '⛅️ 坐化于洞府……'
                  : '☁️ 暂未破境'}
            </p>
            <p>
              成功率 {`${(retreatResult.summary.chance * 100).toFixed(1)}%`}
              ｜掷值 {`${(retreatResult.summary.roll * 100).toFixed(1)}%`}｜闭关{' '}
              {retreatResult.summary.yearsSpent} 年
            </p>
            {attributeGrowthText && <p>属性收获：{attributeGrowthText}</p>}
            {retreatResult.summary.lifespanGained > 0 && (
              <p>寿元增加：+{retreatResult.summary.lifespanGained} 年</p>
            )}
            {retreatResult.story && (
              <div className="whitespace-pre-line rounded bg-paper/80 p-3 text-xs leading-6">
                {retreatResult.story}
              </div>
            )}
            {retreatResult.summary.lifespanDepleted ? (
              <InkButton variant="primary" onClick={handleGoReincarnate}>
                转世重修 →
              </InkButton>
            ) : null}
          </div>
        </InkSection>
      )}
    </InkPageShell>
  );
}
