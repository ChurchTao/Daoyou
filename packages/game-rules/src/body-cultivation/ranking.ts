import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import { BODY_REALM_LABELS } from './config.js';
import { getBodyCultivationSummary } from './summary.js';

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
