import Link from '@app/components/router/AppLink';
import type { HuntMine } from '@daoyou/contracts/hunts';
import { useEffect } from 'react';
import { HUNT_TEAM_CHANGED, huntTeamSummary } from './huntTeamView';
import { useHunts } from './useHunts';

export function HuntTeamBar() {
  const { data, refresh } = useHunts<HuntMine>('/api/hunts/me', 5000);
  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(HUNT_TEAM_CHANGED, onChange);
    return () => window.removeEventListener(HUNT_TEAM_CHANGED, onChange);
  }, [refresh]);
  const team = data?.team;
  if (!team) return null;
  return (
    <Link
      href="/game/hunt-team"
      className="block w-full bg-[color-mix(in_srgb,var(--color-crimson)_14%,var(--color-paper))] text-left transition-colors hover:bg-[color-mix(in_srgb,var(--color-crimson)_20%,var(--color-paper))]"
    >
      <span className="mx-auto flex w-full max-w-5xl items-center gap-2 py-2 pr-[max(env(safe-area-inset-right),0.625rem)] pl-[max(env(safe-area-inset-left),0.625rem)] sm:pr-[max(env(safe-area-inset-right),0.75rem)] sm:pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
        <span className="text-crimson shrink-0 text-sm font-semibold">
          结伴
        </span>
        <span className="text-ink min-w-0 flex-1 truncate text-sm leading-6">
          {huntTeamSummary(team)}
        </span>
        <span className="text-crimson shrink-0 text-sm">查看</span>
      </span>
    </Link>
  );
}
