export const SWEEP_RULES_VERSION = 2;
export const SWEEP_GRID_COLUMNS = 13;
export const SWEEP_GRID_ROWS = 7;
export const SWEEP_LEAF_COUNT = 12;
export const SWEEP_MAX_MOVES = SWEEP_GRID_COLUMNS * SWEEP_GRID_ROWS - 1;
export const SWEEP_BOARD = { width: 1_000, height: 560 } as const;

export const SWEEP_DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type SweepDirection = (typeof SWEEP_DIRECTIONS)[number];

export interface SweepCell {
  x: number;
  y: number;
}

export interface SweepMazeCell extends SweepCell {
  passages: SweepDirection[];
}

export interface SweepMaze {
  columns: number;
  rows: number;
  cells: SweepMazeCell[];
  start: SweepCell;
  end: SweepCell;
  leaves: SweepCell[];
  solution: SweepCell[];
}

export interface SweepGameState {
  maze: SweepMaze;
  player: SweepCell;
  visited: SweepCell[];
  collectedLeaves: SweepCell[];
  moves: SweepDirection[];
  completed: boolean;
}

export interface SweepGameProgress {
  player: SweepCell;
  visited: SweepCell[];
  cleared: number;
  totalLeaves: number;
  steps: number;
  completed: boolean;
}

export type SweepMoveBlockReason = 'wall' | 'visited' | 'completed';

export interface SweepMoveResult {
  state: SweepGameState;
  moved: boolean;
  reason?: SweepMoveBlockReason;
}

export interface SweepSimulationResult {
  state: SweepGameState;
  success: boolean;
  reason?:
    | 'too_many_moves'
    | 'invalid_move'
    | 'revisited_cell'
    | 'leaves_remaining'
    | 'not_at_end';
}

const DIRECTION_VECTORS: Record<SweepDirection, SweepCell> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const OPPOSITE_DIRECTION: Record<SweepDirection, SweepDirection> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

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

function cellKey(cell: SweepCell): string {
  return `${cell.x}:${cell.y}`;
}

function sameCell(left: SweepCell, right: SweepCell): boolean {
  return left.x === right.x && left.y === right.y;
}

function cellIndex(cell: SweepCell): number {
  return cell.y * SWEEP_GRID_COLUMNS + cell.x;
}

function getCell(cells: readonly SweepMazeCell[], cell: SweepCell): SweepMazeCell {
  const found = cells[cellIndex(cell)];
  if (!found) throw new Error('清扫迷宫格子不存在');
  return found;
}

function destination(cell: SweepCell, direction: SweepDirection): SweepCell {
  const vector = DIRECTION_VECTORS[direction];
  return { x: cell.x + vector.x, y: cell.y + vector.y };
}

function isBoundaryCell(cell: SweepCell): boolean {
  return (
    cell.x === 0 ||
    cell.y === 0 ||
    cell.x === SWEEP_GRID_COLUMNS - 1 ||
    cell.y === SWEEP_GRID_ROWS - 1
  );
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function mazeDistances(maze: { cells: readonly SweepMazeCell[] }, start: SweepCell) {
  const distances = new Map<string, number>([[cellKey(start), 0]]);
  const parents = new Map<string, SweepCell>();
  const queue: SweepCell[] = [{ ...start }];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    const distance = distances.get(cellKey(current))!;
    for (const direction of getCell(maze.cells, current).passages) {
      const next = destination(current, direction);
      const key = cellKey(next);
      if (distances.has(key)) continue;
      distances.set(key, distance + 1);
      parents.set(key, current);
      queue.push(next);
    }
  }
  return { distances, parents };
}

function pathBetween(
  maze: { cells: readonly SweepMazeCell[] },
  start: SweepCell,
  end: SweepCell,
) {
  const { parents } = mazeDistances(maze, start);
  const path: SweepCell[] = [{ ...end }];
  while (!sameCell(path[0]!, start)) {
    const parent = parents.get(cellKey(path[0]!));
    if (!parent) throw new Error('清扫迷宫起终点不连通');
    path.unshift({ ...parent });
  }
  return path;
}

function farthestBoundaryPair(cells: readonly SweepMazeCell[]) {
  const boundary = cells.filter(isBoundaryCell);
  let bestStart = boundary[0]!;
  let bestEnd = boundary[1]!;
  let bestDistance = -1;
  for (let leftIndex = 0; leftIndex < boundary.length - 1; leftIndex += 1) {
    const start = boundary[leftIndex]!;
    const { distances } = mazeDistances({ cells }, start);
    for (let rightIndex = leftIndex + 1; rightIndex < boundary.length; rightIndex += 1) {
      const end = boundary[rightIndex]!;
      const distance = distances.get(cellKey(end)) ?? -1;
      if (distance > bestDistance) {
        bestStart = start;
        bestEnd = end;
        bestDistance = distance;
      }
    }
  }
  return {
    start: { x: bestStart.x, y: bestStart.y },
    end: { x: bestEnd.x, y: bestEnd.y },
  };
}

export function isSweepDirection(value: unknown): value is SweepDirection {
  return typeof value === 'string' && SWEEP_DIRECTIONS.includes(value as SweepDirection);
}

export function createSweepMaze(seed: string): SweepMaze {
  const random = randomSequence(seed);
  const cells: SweepMazeCell[] = Array.from(
    { length: SWEEP_GRID_COLUMNS * SWEEP_GRID_ROWS },
    (_, index) => ({
      x: index % SWEEP_GRID_COLUMNS,
      y: Math.floor(index / SWEEP_GRID_COLUMNS),
      passages: [],
    }),
  );
  const first = cells[Math.floor(random() * cells.length)]!;
  const visited = new Set<string>([cellKey(first)]);
  const stack: SweepMazeCell[] = [first];

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const candidates = shuffled(SWEEP_DIRECTIONS, random)
      .map((direction) => ({ direction, next: destination(current, direction) }))
      .filter(
        ({ next }) =>
          next.x >= 0 &&
          next.x < SWEEP_GRID_COLUMNS &&
          next.y >= 0 &&
          next.y < SWEEP_GRID_ROWS &&
          !visited.has(cellKey(next)),
      );
    const candidate = candidates[0];
    if (!candidate) {
      stack.pop();
      continue;
    }
    const next = getCell(cells, candidate.next);
    current.passages.push(candidate.direction);
    next.passages.push(OPPOSITE_DIRECTION[candidate.direction]);
    visited.add(cellKey(next));
    stack.push(next);
  }

  const { start, end } = farthestBoundaryPair(cells);
  const solution = pathBetween({ cells }, start, end);
  const leafCandidates = shuffled(solution.slice(1, -1), random);
  if (leafCandidates.length < SWEEP_LEAF_COUNT)
    throw new Error('清扫迷宫正路不足以放置落叶');

  return {
    columns: SWEEP_GRID_COLUMNS,
    rows: SWEEP_GRID_ROWS,
    cells,
    start,
    end,
    leaves: leafCandidates.slice(0, SWEEP_LEAF_COUNT).map((cell) => ({ ...cell })),
    solution,
  };
}

export function createSweepGameState(seed: string): SweepGameState {
  const maze = createSweepMaze(seed);
  return {
    maze,
    player: { ...maze.start },
    visited: [{ ...maze.start }],
    collectedLeaves: [],
    moves: [],
    completed: false,
  };
}

export function sweepGameProgress(state: SweepGameState): SweepGameProgress {
  return {
    player: { ...state.player },
    visited: state.visited.map((cell) => ({ ...cell })),
    cleared: state.collectedLeaves.length,
    totalLeaves: state.maze.leaves.length,
    steps: state.moves.length,
    completed: state.completed,
  };
}

export function stepSweepGame(
  state: SweepGameState,
  direction: SweepDirection,
): SweepMoveResult {
  if (state.completed) return { state, moved: false, reason: 'completed' };
  const current = getCell(state.maze.cells, state.player);
  if (!current.passages.includes(direction))
    return { state, moved: false, reason: 'wall' };
  const nextPlayer = destination(state.player, direction);
  if (state.visited.some((cell) => sameCell(cell, nextPlayer)))
    return { state, moved: false, reason: 'visited' };

  const collectedLeaves = state.maze.leaves.some(
    (leaf) => sameCell(leaf, nextPlayer),
  )
    ? [...state.collectedLeaves, { ...nextPlayer }]
    : state.collectedLeaves;
  const completed =
    sameCell(nextPlayer, state.maze.end) &&
    collectedLeaves.length === state.maze.leaves.length;
  return {
    moved: true,
    state: {
      ...state,
      player: nextPlayer,
      visited: [...state.visited, nextPlayer],
      collectedLeaves,
      moves: [...state.moves, direction],
      completed,
    },
  };
}

export function simulateSweepMoves(
  seed: string,
  moves: readonly unknown[],
): SweepSimulationResult {
  let state = createSweepGameState(seed);
  if (moves.length > SWEEP_MAX_MOVES)
    return { state, success: false, reason: 'too_many_moves' };
  for (const move of moves) {
    if (!isSweepDirection(move))
      return { state, success: false, reason: 'invalid_move' };
    const result = stepSweepGame(state, move);
    if (!result.moved)
      return {
        state,
        success: false,
        reason: result.reason === 'visited' ? 'revisited_cell' : 'invalid_move',
      };
    state = result.state;
  }
  if (state.completed) return { state, success: true };
  return {
    state,
    success: false,
    reason:
      state.collectedLeaves.length < state.maze.leaves.length
        ? 'leaves_remaining'
        : 'not_at_end',
  };
}

export function sweepDirectionsForPath(path: readonly SweepCell[]): SweepDirection[] {
  const directions: SweepDirection[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    const direction = SWEEP_DIRECTIONS.find((candidate) => {
      const vector = DIRECTION_VECTORS[candidate];
      return current.x - previous.x === vector.x && current.y - previous.y === vector.y;
    });
    if (!direction) throw new Error('清扫路径包含非相邻格子');
    directions.push(direction);
  }
  return directions;
}
