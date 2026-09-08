import type { RealmType } from '@shared/types/constants';
import { canChallengeDungeonRealm } from '../game/mapSystem';

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
  if (input.firstVisit && (hpPercent < 80 || mpPercent < 80))
    reasons.push('首次探秘前，请将气血和法力恢复至八成');
  return {
    shouldBlock: reasons.length > 0,
    reasons,
    hints: [],
    hpPercent,
    mpPercent,
  };
}
