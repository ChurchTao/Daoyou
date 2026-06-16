import { getRetreatQiCost } from '@shared/config/qiSystem';
import {
  getActiveCultivationBoostStatus,
  getCultivationBoostPercent,
} from '@shared/lib/cultivationBoost';
import { evaluateFateContext } from '@shared/lib/fates';
import {
  getBreakthroughFocusBonus,
  getProtectMeridiansReductionPercent,
} from '@shared/lib/pillEffectScaling';
import { isConditionStatusActive } from '@shared/lib/condition';
import type { Cultivator } from '@shared/types/cultivator';

export interface RetreatBuffTag {
  key: string;
  icon: string;
  label: string;
  value: string;
  tone: 'positive' | 'warning' | 'neutral';
}

export interface RetreatEfficiencyModel {
  years: number;
  isValidYears: boolean;
  retreatTags: RetreatBuffTag[];
  breakthroughTags: RetreatBuffTag[];
  hasCultivationBoost: boolean;
  lifespanCost: number;
  qiCost: number;
  emptyHint: string | null;
}

function normalizeYears(value: string | number): number {
  const years = typeof value === 'number' ? value : Number(value || '0');
  return Number.isFinite(years) ? Math.floor(years) : 0;
}

function formatSignedPercent(value: number): string {
  const percent = Number((value * 100).toFixed(1));
  const normalized = Number.isInteger(percent) ? percent.toFixed(0) : `${percent}`;
  return `${percent > 0 ? '+' : ''}${normalized}%`;
}

function findActiveStatus(
  cultivator: Cultivator,
  key: 'breakthrough_focus' | 'protect_meridians' | 'clear_mind',
) {
  return (
    cultivator.condition?.statuses.find(
      (status) => status.key === key && isConditionStatusActive(status),
    ) ?? null
  );
}

export function buildRetreatEfficiencyModel(input: {
  cultivator: Cultivator;
  retreatYears: string | number;
}): RetreatEfficiencyModel {
  const { cultivator } = input;
  const years = normalizeYears(input.retreatYears);
  const isValidYears = years >= 1 && years <= 200;
  const safeYears = isValidYears ? years : 0;
  const fateContext = evaluateFateContext(cultivator.pre_heaven_fates ?? []);
  const boostStatus = getActiveCultivationBoostStatus(cultivator.condition);
  const breakthroughFocus = findActiveStatus(cultivator, 'breakthrough_focus');
  const protectMeridians = findActiveStatus(cultivator, 'protect_meridians');
  const clearMind = findActiveStatus(cultivator, 'clear_mind');
  const retreatTags: RetreatBuffTag[] = [];
  const breakthroughTags: RetreatBuffTag[] = [];

  if (boostStatus) {
    retreatTags.push({
      key: 'cultivation_boost',
      icon: '🌿',
      label: '养元',
      value: formatSignedPercent(getCultivationBoostPercent(boostStatus)),
      tone: 'positive',
    });
  }

  if (fateContext.retreatExpMultiplier > 1.02) {
    retreatTags.push({
      key: 'fate_retreat_exp',
      icon: '🌕',
      label: '静修命格',
      value: formatSignedPercent(fateContext.retreatExpMultiplier - 1),
      tone: 'positive',
    });
  }

  if (breakthroughFocus) {
    breakthroughTags.push({
      key: 'breakthrough_focus',
      icon: '🕯️',
      label: '破境凝神',
      value: formatSignedPercent(getBreakthroughFocusBonus(breakthroughFocus)),
      tone: 'positive',
    });
  }

  if (protectMeridians) {
    breakthroughTags.push({
      key: 'protect_meridians',
      icon: '🪢',
      label: '护脉',
      value: `-${formatSignedPercent(
        getProtectMeridiansReductionPercent(protectMeridians),
      ).replace('+', '')}`,
      tone: 'positive',
    });
  }

  if (clearMind) {
    breakthroughTags.push({
      key: 'clear_mind',
      icon: '🪷',
      label: '清心',
      value:
        typeof clearMind.usesRemaining === 'number'
          ? `${clearMind.usesRemaining}次`
          : '',
      tone: 'positive',
    });
  }

  if (cultivator.cultivation_progress?.bottleneck_state) {
    retreatTags.push({
      key: 'bottleneck',
      icon: '⛰️',
      label: '瓶颈',
      value: '闭关放缓',
      tone: 'warning',
    });
  }

  return {
    years,
    isValidYears,
    retreatTags,
    breakthroughTags,
    hasCultivationBoost: Boolean(boostStatus),
    lifespanCost: safeYears,
    qiCost: safeYears > 0 ? getRetreatQiCost(safeYears) : 0,
    emptyHint: boostStatus
      ? null
      : '未见养元药力。若想添一层助益，可先看看修为丹。',
  };
}
