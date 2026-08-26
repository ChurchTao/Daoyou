export const TALISMAN_SCENARIO_OPTIONS = [
  {
    value: 'attribute_reset',
    label: '归元洗髓·属性重置',
  },
  {
    value: 'sect_transfer',
    label: '欺天符·无损转宗',
  },
  {
    value: 'fate_reshape',
    label: '天机逆命·命格重塑',
  },
  {
    value: 'identity_reshape',
    label: '改天换地·身份重塑',
  },
  {
    value: 'draw_gongfa',
    label: '问法寻卷·功法抽取',
  },
  {
    value: 'draw_skill',
    label: '问法寻卷·神通抽取',
  },
  {
    value: 'friend_mail_send',
    label: '好友传音',
  },
  {
    value: 'auction_private_listing',
    label: '拍卖行·专属交易',
  },
  {
    value: 'qi_restore_small',
    label: '小聚灵符·恢复灵气',
  },
  {
    value: 'qi_restore_medium',
    label: '中聚灵符·恢复灵气',
  },
  {
    value: 'qi_restore_large',
    label: '大聚灵符·恢复灵气',
  },
  {
    value: 'qi_restore_fill_to_max',
    label: '天地引气符·补满灵气',
  },
] as const;

export type TalismanScenario =
  (typeof TALISMAN_SCENARIO_OPTIONS)[number]['value'];

export function isTalismanScenario(value: string): value is TalismanScenario {
  return TALISMAN_SCENARIO_OPTIONS.some((option) => option.value === value);
}
