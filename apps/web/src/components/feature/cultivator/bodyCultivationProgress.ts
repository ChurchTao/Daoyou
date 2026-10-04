import type { BodyCultivationTrackSummary } from '@daoyou/game-rules/body-cultivation/progress';

export function getTrackProgressPercent(
  track: BodyCultivationTrackSummary,
): number {
  return Math.round(
    Math.max(0, Math.min(track.progress / track.threshold, 1)) * 100,
  );
}
