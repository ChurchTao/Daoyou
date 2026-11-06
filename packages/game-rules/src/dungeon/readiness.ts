import type { RealmType } from '@daoyou/constants/realms';
import { canChallengeDungeonRealm } from '../world/dungeon.js';

const FIRST_VISIT_MINIMUM_PERCENT = 80;

export function dungeonReadiness(input: {
  realm: RealmType;
  selectedNodeRealm?: RealmType | null;
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  firstVisit: boolean;
}) {
  const hpPercent =
    input.hp.max > 0 ? Math.floor((input.hp.current / input.hp.max) * 100) : 0;
  const mpPercent =
    input.mp.max > 0
      ? Math.floor((input.mp.current / input.mp.max) * 100)
      : 100;
  const reasons: string[] = [];
  if (
    input.selectedNodeRealm &&
    !canChallengeDungeonRealm(input.realm, input.selectedNodeRealm)
  )
    reasons.push('当前人物境界不足以挑战此秘境');
  if (
    input.firstVisit &&
    (hpPercent < FIRST_VISIT_MINIMUM_PERCENT || mpPercent < FIRST_VISIT_MINIMUM_PERCENT)
  )
    reasons.push(`首次探秘前，请将气血和法力恢复至${FIRST_VISIT_MINIMUM_PERCENT}%`);
  return {
    shouldBlock: reasons.length > 0,
    reasons,
    hints: [],
    hpPercent,
    mpPercent,
  };
}
