export const SWEEP_RULES_VERSION = 1;
export const SWEEP_TICK_RATE = 20;
export const SWEEP_MAX_TICKS = 1_200;
export const SWEEP_LEAF_COUNT = 18;
export const SWEEP_MAX_INPUT_SEGMENTS = 600;

export interface SweepVector {
  x: number;
  y: number;
}

export interface SweepInputSegment {
  ticks: number;
  direction: number | null;
  sweeping: boolean;
}

export interface SweepObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SweepGameState {
  tick: number;
  player: SweepVector;
  facing: number;
  cooldown: number;
  leaves: Array<SweepVector & { cleared: boolean }>;
  cleared: number;
  combo: number;
  maxCombo: number;
}

export interface SweepSimulationResult {
  state: SweepGameState;
  success: boolean;
  reason?: 'too_many_segments' | 'invalid_trace' | 'timeout' | 'leaves_remaining';
}

export const SWEEP_BOARD = { width: 1_000, height: 560 } as const;
export const SWEEP_OBSTACLES: readonly SweepObstacle[] = [
  { x: 0, y: 0, width: 1_000, height: 72 },
  { x: 0, y: 0, width: 74, height: 560 },
  { x: 926, y: 0, width: 74, height: 560 },
  { x: 0, y: 510, width: 330, height: 50 },
  { x: 670, y: 510, width: 330, height: 50 },
  { x: 105, y: 100, width: 105, height: 70 },
  { x: 790, y: 100, width: 105, height: 70 },
] as const;

const DIRECTIONS: readonly SweepVector[] = [
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: 1, y: 0 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: 0, y: 1 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -1, y: 0 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
] as const;

function hashSeed(seed: string): number {
  let value = 2166136261;
  for (const char of seed) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0 || 1;
}

function randomSequence(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function overlapsObstacle(point: SweepVector, radius: number): boolean {
  return SWEEP_OBSTACLES.some(
    (obstacle) =>
      point.x + radius > obstacle.x &&
      point.x - radius < obstacle.x + obstacle.width &&
      point.y + radius > obstacle.y &&
      point.y - radius < obstacle.y + obstacle.height,
  );
}

export function createSweepGameState(seed: string): SweepGameState {
  const random = randomSequence(seed);
  const leaves: SweepGameState['leaves'] = [];
  let attempts = 0;
  while (leaves.length < SWEEP_LEAF_COUNT && attempts++ < 2_000) {
    const point = { x: 90 + random() * 820, y: 90 + random() * 390 };
    if (overlapsObstacle(point, 15)) continue;
    if (leaves.some((leaf) => Math.hypot(leaf.x - point.x, leaf.y - point.y) < 35))
      continue;
    leaves.push({ ...point, cleared: false });
  }
  if (leaves.length !== SWEEP_LEAF_COUNT)
    throw new Error('无法生成有效的清扫山门场景');
  return {
    tick: 0,
    player: { x: 500, y: 470 },
    facing: 0,
    cooldown: 0,
    leaves,
    cleared: 0,
    combo: 0,
    maxCombo: 0,
  };
}

export function stepSweepGame(
  state: SweepGameState,
  input: Pick<SweepInputSegment, 'direction' | 'sweeping'>,
): SweepGameState {
  if (state.tick >= SWEEP_MAX_TICKS || state.cleared === SWEEP_LEAF_COUNT)
    return state;
  const next: SweepGameState = {
    ...state,
    tick: state.tick + 1,
    player: { ...state.player },
    leaves: state.leaves.map((leaf) => ({ ...leaf })),
    cooldown: Math.max(0, state.cooldown - 1),
  };
  const direction =
    input.direction === null ? null : DIRECTIONS[input.direction] ?? null;
  if (direction) {
    next.facing = input.direction!;
    const candidate = {
      x: next.player.x + direction.x * 8,
      y: next.player.y + direction.y * 8,
    };
    if (!overlapsObstacle(candidate, 20)) next.player = candidate;
  }
  if (!input.sweeping || next.cooldown > 0) return next;
  next.cooldown = 8;
  const facing = DIRECTIONS[next.facing] ?? DIRECTIONS[0];
  let clearedThisSweep = 0;
  for (const leaf of next.leaves) {
    if (leaf.cleared) continue;
    const dx = leaf.x - next.player.x;
    const dy = leaf.y - next.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 115 || distance < 1) continue;
    const facingDot = (dx * facing.x + dy * facing.y) / distance;
    if (facingDot < 0.45) continue;
    leaf.cleared = true;
    clearedThisSweep += 1;
  }
  next.cleared += clearedThisSweep;
  next.combo = clearedThisSweep > 0 ? next.combo + clearedThisSweep : 0;
  next.maxCombo = Math.max(next.maxCombo, next.combo);
  return next;
}

export function simulateSweepTrace(
  seed: string,
  segments: readonly SweepInputSegment[],
): SweepSimulationResult {
  if (segments.length > SWEEP_MAX_INPUT_SEGMENTS)
    return { state: createSweepGameState(seed), success: false, reason: 'too_many_segments' };
  let state = createSweepGameState(seed);
  for (const segment of segments) {
    if (
      !Number.isInteger(segment.ticks) ||
      segment.ticks < 1 ||
      segment.ticks > SWEEP_MAX_TICKS ||
      (segment.direction !== null &&
        (!Number.isInteger(segment.direction) || segment.direction < 0 || segment.direction > 7))
    )
      return { state, success: false, reason: 'invalid_trace' };
    if (state.tick + segment.ticks > SWEEP_MAX_TICKS)
      return { state, success: false, reason: 'timeout' };
    for (let tick = 0; tick < segment.ticks; tick += 1) {
      state = stepSweepGame(state, segment);
      if (state.cleared === SWEEP_LEAF_COUNT)
        return { state, success: true };
    }
  }
  return {
    state,
    success: false,
    reason: state.tick >= SWEEP_MAX_TICKS ? 'timeout' : 'leaves_remaining',
  };
}

export function appendSweepInput(
  trace: SweepInputSegment[],
  input: Pick<SweepInputSegment, 'direction' | 'sweeping'>,
): void {
  const last = trace[trace.length - 1];
  if (
    last &&
    last.direction === input.direction &&
    last.sweeping === input.sweeping &&
    last.ticks < SWEEP_MAX_TICKS
  ) {
    last.ticks += 1;
    return;
  }
  trace.push({ ...input, ticks: 1 });
}
