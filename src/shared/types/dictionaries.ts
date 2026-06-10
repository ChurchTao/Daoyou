import type { Quality } from './constants';

export interface QualityDisplayInfo {
  label: string;
  tier: string;
}

export const QUALITY_DISPLAY_MAP: Record<Quality, QualityDisplayInfo> = {
  凡品: { label: '凡品', tier: '凡品' },
  灵品: { label: '灵品', tier: '灵品' },
  玄品: { label: '玄品', tier: '玄品' },
  真品: { label: '真品', tier: '真品' },
  地品: { label: '地品', tier: '地品' },
  天品: { label: '天品', tier: '天品' },
  仙品: { label: '仙品', tier: '仙品' },
  神品: { label: '神品', tier: '神品' },
};

export function getQualityInfo(quality: Quality): QualityDisplayInfo {
  return (
    QUALITY_DISPLAY_MAP[quality] ?? {
      label: quality,
      tier: '凡品',
    }
  );
}

export function getConsumableRankInfo(quality: Quality): QualityDisplayInfo {
  return getQualityInfo(quality);
}
