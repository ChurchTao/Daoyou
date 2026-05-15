import { InkCard } from '@app/components/ui/InkCard';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import type { ConditionStatusInstance } from '@shared/types/condition';

interface StatusCardProps {
  buffs: ConditionStatusInstance[];
  title?: string;
  compact?: boolean;
  emptyMessage?: string;
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
      description: config?.description || '未知状态',
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
