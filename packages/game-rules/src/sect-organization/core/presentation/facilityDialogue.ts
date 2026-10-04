import type { SectFacilityState } from '../domain/index.js';
import type {
  SectBenefitMetric,
  SectFacilityEffectSnapshot,
} from '../organization/index.js';

export type SectFacilityDialogueEmphasis =
  'level' | 'benefit' | 'progress' | 'warning';

export interface SectFacilityDialogueSegment {
  text: string;
  emphasis?: SectFacilityDialogueEmphasis;
}

const isPlayerFacingText = (value: string): boolean =>
  Boolean(value.trim()) && !/[A-Za-z_]/u.test(value);

function formatMetric(metric: SectBenefitMetric): string | undefined {
  if (
    metric.format === 'percent' &&
    typeof metric.value === 'number' &&
    Number.isFinite(metric.value)
  )
    return `${Math.round(metric.value * 10_000) / 100}%`;
  if (
    metric.format === 'number' &&
    typeof metric.value === 'number' &&
    Number.isFinite(metric.value)
  )
    return metric.value.toLocaleString('zh-CN');
  if (metric.format === 'text' && isPlayerFacingText(String(metric.value)))
    return String(metric.value);
  return undefined;
}

export function describeSectFacilityStatus(args: {
  facilityLabel: string;
  facility: SectFacilityState;
  effect?: SectFacilityEffectSnapshot;
}): SectFacilityDialogueSegment[] {
  const facilityLabel = isPlayerFacingText(args.facilityLabel)
    ? args.facilityLabel.trim()
    : '此处设施';
  const metrics =
    args.effect?.metrics
      .filter(
        (metric) =>
          metric.key !== 'level' &&
          isPlayerFacingText(metric.label) &&
          formatMetric(metric) !== undefined,
      )
      .map((metric) => ({
        label: metric.label.trim(),
        value: formatMetric(metric) as string,
      })) ?? [];
  const segments: SectFacilityDialogueSegment[] = [
    { text: `${facilityLabel}如今是` },
    { text: `${args.facility.level}级`, emphasis: 'level' },
    { text: '。' },
  ];
  if (args.effect?.summary.trim() && isPlayerFacingText(args.effect.summary)) {
    segments.push({
      text: args.effect.summary.replace(/[。；]+$/u, ''),
      emphasis: 'benefit',
    });
    segments.push({ text: '。' });
  }
  if (metrics.length) {
    segments.push({
      text: metrics
        .map((metric) => `${metric.label}${metric.value}`)
        .join('，'),
    });
    segments.push({ text: '。' });
  }
  return segments;
}
