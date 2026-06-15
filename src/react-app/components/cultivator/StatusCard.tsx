import { InkCard } from '@app/components/ui/InkCard';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import {
  CULTIVATION_BOOST_STATUS_KEY,
  getCultivationBoostDisplayText,
} from '@shared/lib/cultivationBoost';
import {
  BREAKTHROUGH_FOCUS_STATUS_KEY,
  CLEAR_MIND_STATUS_KEY,
  getBreakthroughFocusBonus,
  getProtectMeridiansReductionPercent,
  PROTECT_MERIDIANS_STATUS_KEY,
} from '@shared/lib/pillEffectScaling';
import type { ConditionStatusInstance } from '@shared/types/condition';

interface StatusCardProps {
  buffs: ConditionStatusInstance[];
  title?: string;
  compact?: boolean;
  emptyMessage?: string;
}

function formatPercent(value: number): string {
  const percent = Number((value * 100).toFixed(1));
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent}%`;
}

function getStatusDescription(buff: ConditionStatusInstance): string {
  const config = getConditionStatusTemplate(buff.key);

  if (buff.key === CULTIVATION_BOOST_STATUS_KEY) {
    return `${getCultivationBoostDisplayText(buff)}，剩余 ${
      buff.usesRemaining ?? 1
    } 次闭关`;
  }

  if (buff.key === BREAKTHROUGH_FOCUS_STATUS_KEY) {
    return `突破成功率 +${formatPercent(
      getBreakthroughFocusBonus(buff),
    )}，剩余 ${buff.usesRemaining ?? 1} 次突破`;
  }

  if (buff.key === PROTECT_MERIDIANS_STATUS_KEY) {
    return `失败修为损失降低 ${formatPercent(
      getProtectMeridiansReductionPercent(buff),
    )}，剩余 ${buff.usesRemaining ?? 1} 次突破`;
  }

  if (buff.key === CLEAR_MIND_STATUS_KEY) {
    return `突破失败不会滋生心魔，剩余 ${buff.usesRemaining ?? 1} 次突破`;
  }

  return config?.description || '未知状态';
}

/**
 * 通用状态卡片组件
 * 显示角色的持久 Buff 状态
 */
export function StatusCard({
  buffs,
  title = '状态',
  compact = false,
  emptyMessage = '无异常状态',
}: StatusCardProps) {
  const displayInfos = buffs.map((buff, index) => {
    const config = getConditionStatusTemplate(buff.key);
    return {
      key: `${buff.key}:${index}`,
      name: config?.name || buff.key,
      description: getStatusDescription(buff),
      stacks: buff.stacks,
      icon: config?.display.icon || '💫',
    };
  });

  if (displayInfos.length === 0) {
    return compact ? null : (
      <InkCard className="p-4">
        <p className="text-ink-secondary text-center text-sm">{emptyMessage}</p>
      </InkCard>
    );
  }

  return (
    <InkCard className={compact ? 'p-3' : 'p-4'}>
      {!compact && <h3 className="mb-3 font-bold">{title}</h3>}
      <div className="space-y-2">
        {displayInfos.map((info) => (
          <div key={info.key} className="flex items-start gap-2 text-sm">
            <span className="text-base">{info.icon}</span>
            <div className="flex-1">
              <div className="text-ink font-bold">
                {info.name}
                {info.stacks > 1 && ` (${info.stacks}层)`}
              </div>
              <div className="text-ink-secondary text-xs">
                {info.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </InkCard>
  );
}
