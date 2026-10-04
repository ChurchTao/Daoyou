/** A terminal result must settle before the single reward row can advance weeks. */
export interface TowerLifecycleState {
  status: string;
  season: { seasonEndsAt: string };
  battleId?: string;
  battle?: { settled: boolean; snapshot: { state: { phase: string } } };
}

export function shouldExpireTowerRun(run: TowerLifecycleState, now: number) {
  return (
    now >= Date.parse(run.season.seasonEndsAt) &&
    !(
      run.battle &&
      !run.battle.settled &&
      run.battle.snapshot.state.phase === 'ended'
    )
  );
}

export function towerRunOccupancy(
  run: TowerLifecycleState | null,
  now: number,
) {
  if (!run || shouldExpireTowerRun(run, now)) return 'none';
  if (run.battleId) return 'battle';
  return run.status === 'FINISHED' ? 'none' : 'run';
}
