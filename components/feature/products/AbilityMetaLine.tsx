'use client';

import { cn } from '@/lib/cn';
import {
  formatTargetPolicyValue,
  type AbilityProjectionSummary,
} from './abilityDisplay';

interface AbilityMetaLineProps {
  projection?: AbilityProjectionSummary;
  className?: string;
}

interface MetaItemProps {
  label: string;
  value: string | number;
}

function MetaItem({ label, value }: MetaItemProps) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-secondary">{label}</span>
      <span className="text-ink-primary font-medium">{value}</span>
    </span>
  );
}

export function AbilityMetaLine({
  projection,
  className,
}: AbilityMetaLineProps) {
  if (!projection || projection.projectionKind !== 'active_skill') return null;

  const items = [
    projection.targetPolicy
      ? {
          key: 'target-policy',
          label: '目标策略',
          value: formatTargetPolicyValue(projection.targetPolicy),
        }
      : null,
    projection.mpCost !== undefined
      ? {
          key: 'mp-cost',
          label: '法力消耗',
          value: projection.mpCost,
        }
      : null,
    projection.cooldown !== undefined
      ? {
          key: 'cooldown',
          label: '冷却',
          value: `${projection.cooldown}回合`,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; value: string | number }>;

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'text-ink-secondary flex flex-wrap gap-x-4 gap-y-1 text-sm leading-relaxed',
        className,
      )}
    >
      {items.map((item) => (
        <MetaItem key={item.key} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
