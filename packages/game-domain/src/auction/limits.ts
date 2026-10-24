/**
 * 难估价货品的单价上限：灵兽、道装、玉简、传承灵印。
 * 取 9999 万，与角色灵石单次入账上限一致。单件成交扣税后卖家到手仍低于该入账上限。
 */
export const AUCTION_MAX_UNIT_PRICE = 99_990_000;

/** 单次卖家到手灵石上限，与 `updateSpiritStones` 的单次入账上限一致。 */
export const AUCTION_MAX_SELLER_RECEIPT = 99_990_000;

export const AUCTION_MAX_TRANSACTION_TOTAL = 1_000_000_000;

/** 每个角色同时占用的未过期在售货单上限，道具与灵兽合计。 */
export const AUCTION_MAX_ACTIVE_LISTINGS = 10;
