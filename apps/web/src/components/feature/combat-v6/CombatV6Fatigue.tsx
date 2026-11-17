import { InkTooltip } from '@app/components/ui/InkTooltip';
import type { CombatV6VersionStamp } from '@daoyou/combat-core/types';
import {
  pvpFatigueNotice,
  pvpRecoveryMultiplier,
} from '@daoyou/game-rules/combat/pvp';

export function CombatV6Fatigue({
  round,
  versions,
}: {
  round: number;
  versions: CombatV6VersionStamp;
}) {
  const notice = pvpFatigueNotice(0, versions);
  if (!notice) return null;
  const percent = Math.round(pvpRecoveryMultiplier({ round, versions }) * 100);
  const active = percent < 100;
  return (
    <InkTooltip
      label={active ? `久战衰减说明：气血恢复保留${percent}%` : '久战衰减说明'}
      triggerClassName={`cv6-fatigue ${active ? 'is-active' : ''}`}
      triggerContent={
        active ? (
          <span role="status">
            气血恢复 <span className="font-mono">{percent}%</span>
          </span>
        ) : (
          '久战衰减'
        )
      }
    >
      <p>{notice}</p>
    </InkTooltip>
  );
}
