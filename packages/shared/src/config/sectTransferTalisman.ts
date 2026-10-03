/** 保留场景 ID，避免已创建的后台道具失效；玩家语义统一为“欺天”。 */
export const CHEAT_HEAVEN_TALISMAN_SCENARIO = 'sect_transfer';
export const CHEAT_HEAVEN_TALISMAN_NAME = '欺天符';

export function isSectTransferTalismanScenario(value: string): boolean {
  return value === CHEAT_HEAVEN_TALISMAN_SCENARIO;
}
