/** 所有标准宗门共用的稳定产品规则。 */
export const StandardSectRules = Object.freeze({
  methodCount: 6,
  methodSlots: Object.freeze([1, 2, 3, 4, 5, 6] as const),
  foundationPassiveCount: 1,
  activeAbilitySlotCount: 4,
  meridianLoadoutSlots: Object.freeze([1, 2, 3] as const),
  enabledMeridianLoadoutSlots: Object.freeze([1] as Array<1 | 2 | 3>),
  meridianNodeTransportLimit: 64,
  combatResourceCount: 1,
});
