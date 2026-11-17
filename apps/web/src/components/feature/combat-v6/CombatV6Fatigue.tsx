import type { CombatV6VersionStamp } from '@daoyou/combat-core/types';
import { pvpFatigueNotice } from '@daoyou/game-rules/combat/pvp';

export function CombatV6Fatigue({ round, versions }: { round: number; versions: CombatV6VersionStamp }) {
  const notice = pvpFatigueNotice(round, versions);
  if (!notice) return null;
  return <p className="px-3 py-1 text-sm text-ink-secondary" role="status">{notice}</p>;
}
