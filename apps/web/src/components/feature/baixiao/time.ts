import { BAIXIAO_RANK_UNIT_MS } from '@daoyou/game-domain/baixiao/meet';

export function baixiaoTime(milliseconds: number) {
  const tenths = Math.round(milliseconds / BAIXIAO_RANK_UNIT_MS);
  const minutes = Math.floor(tenths / 600);
  return `${minutes}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
}

export function baixiaoCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
