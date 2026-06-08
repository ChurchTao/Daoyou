import {
  QI_RESTORE_TALISMAN_SCENARIOS,
  isQiRestoreTalismanScenario,
} from '@shared/config/qiSystem';
import { isTalismanConsumable } from '@shared/lib/consumables';
import type { Consumable } from '@shared/types/cultivator';
import { buildManualDrawHref } from '@shared/types/manualDraw';

const TALISMAN_SCENARIO_LABELS: Record<string, string> = {
  fate_reshape: '命格重塑',
  draw_gongfa: '问法寻卷·功法抽取',
  draw_skill: '问法寻卷·神通抽取',
};

const TALISMAN_SCENARIO_HREFS: Record<string, string> = {
  fate_reshape: '/game/fate-reshape',
  draw_gongfa: buildManualDrawHref('gongfa'),
  draw_skill: buildManualDrawHref('skill'),
};

const TALISMAN_SCENARIO_ACTION_LABELS: Record<string, string> = {
  fate_reshape: '前往重塑',
  draw_gongfa: '抽功法秘籍',
  draw_skill: '抽神通秘籍',
};

const TALISMAN_USAGE_HINTS: Record<string, string> = {
  fate_reshape: '【前往命格重塑功能页启封，开启时立即扣除】',
  draw_gongfa: '【前往问法寻卷，直接消耗符箓抽取功法秘籍】',
  draw_skill: '【前往问法寻卷，直接消耗符箓抽取神通秘籍】',
};

function getQiRestoreEffectText(scenario: string): string | null {
  if (!isQiRestoreTalismanScenario(scenario)) return null;

  const amount = QI_RESTORE_TALISMAN_SCENARIOS[scenario].amount;
  return amount === 'fill_to_max'
    ? '将天地灵气补至基础上限'
    : `恢复 ${amount} 点天地灵气`;
}

export function isQiRestoreTalisman(consumable: Consumable): boolean {
  return (
    isTalismanConsumable(consumable) &&
    isQiRestoreTalismanScenario(consumable.spec.scenario)
  );
}

export function getTalismanScenarioLabel(scenario: string): string {
  if (isQiRestoreTalismanScenario(scenario)) {
    return QI_RESTORE_TALISMAN_SCENARIOS[scenario].label;
  }

  return TALISMAN_SCENARIO_LABELS[scenario] ?? '专属玩法符箓';
}

export function getTalismanActionHref(consumable: Consumable): string | undefined {
  if (!isTalismanConsumable(consumable)) return undefined;
  return TALISMAN_SCENARIO_HREFS[consumable.spec.scenario];
}

export function getTalismanActionLabel(consumable: Consumable): string | null {
  if (!isTalismanConsumable(consumable)) return null;
  return TALISMAN_SCENARIO_ACTION_LABELS[consumable.spec.scenario] ?? null;
}

export function getTalismanUsageHint(consumable: Consumable): string {
  if (!isTalismanConsumable(consumable)) {
    return '';
  }

  const restoreText = getQiRestoreEffectText(consumable.spec.scenario);
  if (restoreText) {
    return `【可在背包中直接使用，${restoreText}】`;
  }

  return (
    TALISMAN_USAGE_HINTS[consumable.spec.scenario] ??
    '【需在对应玩法入口校验并锁定，终局结算后扣除】'
  );
}

export function buildTalismanDetailText(consumable: Consumable): string {
  if (!isTalismanConsumable(consumable)) {
    return consumable.description ?? '';
  }

  const restoreText = getQiRestoreEffectText(consumable.spec.scenario);
  const lines = restoreText
    ? [
        `用途：${restoreText}`,
        '使用方式：可在背包中直接使用',
        consumable.spec.notes,
        consumable.description,
      ]
    : [
        `适用玩法：${getTalismanScenarioLabel(consumable.spec.scenario)}`,
        '使用方式：需在对应玩法入口使用',
        consumable.spec.notes,
        consumable.description,
      ];

  return lines.filter(Boolean).join('\n');
}
