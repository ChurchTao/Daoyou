import type {
  ResourceChangeDescriptor,
  ResourceDataMap,
} from '@daoyou/contracts/resources';

export type QiSettlementBaseline = {
  qiAfter: number;
  qiLastRefreshedAt: string | null;
};

export function qiCurrencyPatch(
  settlement: QiSettlementBaseline,
): Pick<ResourceDataMap['player.currency'], 'qi' | 'qiLastRefreshedAt'> {
  return {
    qi: settlement.qiAfter,
    qiLastRefreshedAt: settlement.qiLastRefreshedAt,
  };
}

export function qiCurrencyChange(
  eventType: string,
  settlement: QiSettlementBaseline,
): ResourceChangeDescriptor<'player.currency'> {
  return {
    resourceTopic: 'player.currency',
    eventType,
    operation: 'merge',
    payload: qiCurrencyPatch(settlement),
  };
}
