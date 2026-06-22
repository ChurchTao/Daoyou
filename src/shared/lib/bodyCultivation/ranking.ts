import type { CultivatorCondition } from '@shared/types/condition';
import { BODY_REALM_LABELS } from './config';
import { getBodyCultivationSummary } from './summary';

export interface BodyCultivationRankingTag {
  realm: string;
  totalLevel: number;
  label: string;
}

export function getBodyCultivationRankingTag(
  condition: CultivatorCondition | undefined,
): BodyCultivationRankingTag {
  const summary = getBodyCultivationSummary(condition);
  const realm = BODY_REALM_LABELS[summary.realm.key];
  return {
    realm,
    totalLevel: summary.totalLevel,
    label: `${realm} · 肉身 Lv.${summary.totalLevel}`,
  };
}
