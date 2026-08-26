import {
  ATTRIBUTE_RESET_TALISMAN_NAME,
  ATTRIBUTE_RESET_TALISMAN_SCENARIO,
  isAttributeResetTalismanScenario,
} from '@shared/config/attributeResetTalisman';
import { IDENTITY_RESHAPE_SCENARIO } from '@shared/config/identityReshape';
import {
  QI_RESTORE_TALISMAN_SCENARIOS,
  isQiRestoreTalismanScenario,
} from '@shared/config/qiSystem';
import {
  CHEAT_HEAVEN_TALISMAN_SCENARIO,
  isSectTransferTalismanScenario,
} from '@shared/config/sectTransferTalisman';
import {
  AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO,
  FRIEND_MAIL_TALISMAN_SCENARIO,
} from '@shared/config/socialConfig';
import { isTalismanConsumable } from '@shared/lib/consumables';
import type { Consumable } from '@shared/types/cultivator';
import { buildManualDrawHref } from '@shared/types/manualDraw';

const TALISMAN_SCENARIO_LABELS: Record<string, string> = {
  [ATTRIBUTE_RESET_TALISMAN_SCENARIO]: '根基属性重洗',
  [CHEAT_HEAVEN_TALISMAN_SCENARIO]: '欺天符·无损转宗',
  fate_reshape: '命格重塑',
  [IDENTITY_RESHAPE_SCENARIO]: '改天换地·身份重塑',
  draw_gongfa: '问法寻卷·功法抽取',
  draw_skill: '问法寻卷·神通抽取',
  [FRIEND_MAIL_TALISMAN_SCENARIO]: '传音玉简·好友传音',
  [AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO]: '拍卖行·专属交易',
};

const TALISMAN_SCENARIO_HREFS: Record<string, string> = {
  [CHEAT_HEAVEN_TALISMAN_SCENARIO]: '/game/sect/transfer',
  fate_reshape: '/game/fate-reshape',
  [IDENTITY_RESHAPE_SCENARIO]: '/game/identity-reshape',
  draw_gongfa: buildManualDrawHref('gongfa'),
  draw_skill: buildManualDrawHref('skill'),
  [FRIEND_MAIL_TALISMAN_SCENARIO]: '/game/mail',
  [AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO]: '/game/auction',
};

const TALISMAN_SCENARIO_ACTION_LABELS: Record<string, string> = {
  [ATTRIBUTE_RESET_TALISMAN_SCENARIO]: '使用',
  [CHEAT_HEAVEN_TALISMAN_SCENARIO]: '前往欺天台转宗',
  fate_reshape: '前往重塑',
  [IDENTITY_RESHAPE_SCENARIO]: '前往改命',
  draw_gongfa: '抽功法秘籍',
  draw_skill: '抽神通秘籍',
  [FRIEND_MAIL_TALISMAN_SCENARIO]: '去传音',
  [AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO]: '去上架',
};

const TALISMAN_USAGE_HINTS: Record<string, string> = {
  [ATTRIBUTE_RESET_TALISMAN_SCENARIO]: `【可在背包中直接使用，重置六维自由分配并返还属性点】`,
  [CHEAT_HEAVEN_TALISMAN_SCENARIO]:
    '【前往欺天台查看转宗后的变化，确认成功后才会消耗】',
  fate_reshape: '【前往命格重塑功能页启封，开启时立即扣除】',
  [IDENTITY_RESHAPE_SCENARIO]: '【前往身份重塑文戏启封，开启时立即扣除】',
  draw_gongfa: '【前往问法寻卷，直接消耗符箓抽取功法秘籍】',
  draw_skill: '【前往问法寻卷，直接消耗符箓抽取神通秘籍】',
  [FRIEND_MAIL_TALISMAN_SCENARIO]:
    '【前往传音玉简，给好友发送传音时消耗；不足时可去天骄宝阁购买】',
  [AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO]:
    '【前往拍卖行，上架专属交易时消耗；不足时可去天骄宝阁购买】',
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

export function isAttributeResetTalisman(consumable: Consumable): boolean {
  return (
    isTalismanConsumable(consumable) &&
    isAttributeResetTalismanScenario(consumable.spec.scenario)
  );
}

export function isSectTransferTalisman(consumable: Consumable): boolean {
  return (
    isTalismanConsumable(consumable) &&
    isSectTransferTalismanScenario(consumable.spec.scenario)
  );
}

export function getTalismanScenarioLabel(scenario: string): string {
  if (isQiRestoreTalismanScenario(scenario)) {
    return QI_RESTORE_TALISMAN_SCENARIOS[scenario].label;
  }

  return TALISMAN_SCENARIO_LABELS[scenario] ?? '专属玩法符箓';
}

export function getTalismanActionHref(
  consumable: Consumable,
): string | undefined {
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
  if (isAttributeResetTalismanScenario(consumable.spec.scenario)) {
    return TALISMAN_USAGE_HINTS[ATTRIBUTE_RESET_TALISMAN_SCENARIO];
  }
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
  const lines = isAttributeResetTalismanScenario(consumable.spec.scenario)
    ? [
        `用途：重置六维自由分配，返还已投入的可分配属性点`,
        '使用方式：可在背包中直接使用，也可在根基属性页确认启封',
        consumable.spec.notes ??
          `${ATTRIBUTE_RESET_TALISMAN_NAME}启封后，六维回到当前境界自然成长值。`,
        consumable.description,
      ]
    : restoreText
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

export function buildTalismanUseConfirmText(consumable: Consumable): string {
  return buildTalismanDetailText(consumable);
}
