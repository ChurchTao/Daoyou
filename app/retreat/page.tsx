'use client';

import { CultivatorStatusCard } from '@/components/feature/cultivator/CultivatorStatusCard';
import { InkModal, InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkNotice,
} from '@/components/ui';
import {
  BreakthroughResult,
  CultivationResult,
} from '@/engine/cultivation/CultivationEngine';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Attributes } from '@/types/cultivator';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function RetreatPage() {
  const { cultivator, isLoading, refresh, note } = useCultivatorBundle();
  const { pushToast } = useInkUI();
  const pathname = usePathname();
  const router = useRouter();
  const [retreatYears, setRetreatYears] = useState('10');
  const [retreatResult, setRetreatResult] = useState<{
    summary: BreakthroughResult['summary'] | CultivationResult['summary'];
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
    setShowBreakthroughConfirm(true);
  };

  const handleBreakthrough = async () => {
    setShowBreakthroughConfirm(false);
    setRetreatLoading(true);
    try {
      const response = await fetch('/api/cultivator/retreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
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
          </div>
          <p className="text-ink-secondary text-xs text-center opacity-80">
            修行之路，本就充满坎坷。机缘造化，在此一举。
          </p>
        </div>
      </InkModal>

      {/* 修炼/突破结果 */}
      {retreatResult && (
        <RetreatResult
          retreatResult={retreatResult}
          handleGoReincarnate={handleGoReincarnate}
        />
      )}
    </InkPageShell>
  );
}

// 修炼/突破结果
const RetreatResult = ({
  retreatResult,
  handleGoReincarnate,
}: {
  retreatResult: {
    summary: BreakthroughResult['summary'] | CultivationResult['summary'];
    story?: string;
    storyType?: 'breakthrough' | 'lifespan' | null;
    action?: 'cultivate' | 'breakthrough';
    depleted?: boolean;
  };
  handleGoReincarnate: () => void;
}) => {
  let summary = retreatResult.summary;
  const isCultivation = retreatResult.action === 'cultivate';

  const attributeGrowthText = useMemo(() => {
    if (!retreatResult || retreatResult.action !== 'breakthrough') return '';
    const summary = retreatResult.summary as BreakthroughResult['summary'];
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
  if (isCultivation) {
    summary = summary as CultivationResult['summary'];
    return (
      <InkSection title="【修炼成果】">
        <div className="space-y-3 rounded border border-ink-border p-3 text-sm leading-6">
          {/* 修炼结果 */}
          <p className="font-medium">🌱 修炼有成</p>
          <p>
            修为增长：+
            {Number(summary.exp_gained)}
          </p>
          <p>
            当前进度：
            {summary.progress.toFixed(2)}%
          </p>
          {summary.insight_gained > 0 && (
            <p>
              感悟提升：+
              {summary.insight_gained}
            </p>
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
          {retreatResult.depleted ? (
            <InkButton variant="primary" onClick={handleGoReincarnate}>
              转世重修 →
            </InkButton>
          ) : null}
        </div>
      </InkSection>
    );
  }

  summary = summary as BreakthroughResult['summary'];
  return (
    <InkSection title="【突破结果】">
      <div className="space-y-3 rounded border border-ink-border p-3 text-sm leading-6">
        {/* 突破结果 */}
        <p className="font-medium">
          {summary.success ? '🌅 突破成功！' : '☁️ 冲关失败'}
        </p>
        <p>成功率 {`${Math.min(summary.chance * 100, 100).toFixed(1)}%`}</p>
        {attributeGrowthText && <p>属性收获：{attributeGrowthText}</p>}
        {summary.lifespanGained > 0 && (
          <p>
            寿元增加：+
            {summary.lifespanGained} 年
          </p>
        )}

        {/* 失败时显示损失信息 */}
        {!summary.success && (
          <div className="mt-3 p-3 bg-orange-50/50 border border-orange-200 rounded-lg space-y-2">
            <p className="text-orange-800 font-medium">
              【道途坎坷，受创不轻】
            </p>
            {summary.exp_lost && (
              <p className="text-orange-700">
                修为损失：-
                {summary.exp_lost} 点
                <span className="text-xs ml-1 opacity-80">
                  （冲关失败，真元涣散）
                </span>
              </p>
            )}
            {summary.insight_change && summary.insight_change! < 0 && (
              <p className="text-orange-700">
                道行感悟：
                {summary.insight_change}
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
};
