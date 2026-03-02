export const temporaryRestrictions = {
  disableConsumableBetBattle: true,
  disableConsumableAuctionListing: true,
} as const;

export const TEMP_DISABLED_MESSAGES = {
  consumableBetBattle: '消耗品赌战已临时关闭，待系统调整完成后恢复。',
  consumableAuctionListing: '拍卖行消耗品寄售已临时关闭，待系统调整完成后恢复。',
} as const;
