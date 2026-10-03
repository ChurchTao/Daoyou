export const SWEEP_RULES_VERSION = 3;
export const SWEEP_GRID_COLUMNS = 7;
export const SWEEP_GRID_ROWS = 5;
export const SWEEP_BLOCKED_COUNT = 9;
export const SWEEP_LEAF_COUNT = 4;
export const SWEEP_MAX_MOVES = SWEEP_GRID_COLUMNS * SWEEP_GRID_ROWS - 1;
export const SWEEP_CANVAS = { width: 1_120, height: 630 } as const;

const SWEEP_MIN_SOLUTION_MOVES = 14;
const SWEEP_MIN_SOLUTION_TURNS = 5;
const SWEEP_MIN_DECISION_POINTS = 3;
const SWEEP_GENERATION_ATTEMPTS = 128;
const SWEEP_SOLVER_NODE_LIMIT = 80_000;

export const SWEEP_DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type SweepDirection = (typeof SWEEP_DIRECTIONS)[number];
export type SweepCellKind = 'passable' | 'blocked';
export type SweepGamePhase = 'playing' | 'failed' | 'completed';
export type SweepFailureReason = 'end_too_early' | 'dead_end';

export interface SweepCell {
  x: number;
  y: number;
}

export interface SweepBoardCell extends SweepCell {
  kind: SweepCellKind;
}

export interface SweepBoard {
  columns: number;
  rows: number;
  cells: SweepBoardCell[];
  start: SweepCell;
  end: SweepCell;
  leaves: SweepCell[];
  solution: SweepCell[];
}

export interface SweepGameState {
  board: SweepBoard;
  player: SweepCell;
  visited: SweepCell[];
  collectedLeaves: SweepCell[];
  moves: SweepDirection[];
  phase: SweepGamePhase;
  failureReason?: SweepFailureReason;
}

export interface SweepGameProgress {
  player: SweepCell;
  visited: SweepCell[];
  cleared: number;
  totalLeaves: number;
  steps: number;
  phase: SweepGamePhase;
  failureReason?: SweepFailureReason;
  completed: boolean;
}

export type SweepMoveBlockReason = 'blocked' | 'visited' | 'finished';

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
    | 'end_too_early'
    | 'dead_end'
    | 'leaves_remaining'
    | 'not_at_end';
}

const DIRECTION_VECTORS: Record<SweepDirection, SweepCell> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
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

function inBounds(cell: SweepCell): boolean {
  return (
    cell.x >= 0 &&
    cell.x < SWEEP_GRID_COLUMNS &&
    cell.y >= 0 &&
    cell.y < SWEEP_GRID_ROWS
  );
}

function cellIndex(cell: SweepCell): number {
  return cell.y * SWEEP_GRID_COLUMNS + cell.x;
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

function manhattan(left: SweepCell, right: SweepCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function allCells(): SweepCell[] {
  return Array.from(
    { length: SWEEP_GRID_COLUMNS * SWEEP_GRID_ROWS },
    (_, index) => ({
      x: index % SWEEP_GRID_COLUMNS,
      y: Math.floor(index / SWEEP_GRID_COLUMNS),
    }),
  );
}

function isPassable(board: Pick<SweepBoard, 'cells'>, cell: SweepCell): boolean {
  return inBounds(cell) && board.cells[cellIndex(cell)]?.kind === 'passable';
}

function passableNeighbors(
  board: Pick<SweepBoard, 'cells'>,
  cell: SweepCell,
): Array<{ direction: SweepDirection; cell: SweepCell }> {
  return SWEEP_DIRECTIONS.map((direction) => ({
    direction,
    cell: destination(cell, direction),
  })).filter((candidate) => isPassable(board, candidate.cell));
}

function leafMaskAt(leaves: readonly SweepCell[], cell: SweepCell): number {
  const index = leaves.findIndex((leaf) => sameCell(leaf, cell));
  return index < 0 ? 0 : 1 << index;
}

function solveSweepBoard(
  board: Omit<SweepBoard, 'solution'>,
  random: () => number,
): SweepCell[] | undefined {
  const targetLeafMask = (1 << board.leaves.length) - 1;
  const visited = Array.from({ length: board.cells.length }, () => false);
  const path: SweepCell[] = [{ ...board.start }];
  visited[cellIndex(board.start)] = true;
  let visitedNodes = 0;

  const visit = (
    current: SweepCell,
    collectedLeafMask: number,
    previousDirection: SweepDirection | undefined,
    turns: number,
    decisionPoints: number,
  ): boolean => {
    visitedNodes += 1;
    if (visitedNodes > SWEEP_SOLVER_NODE_LIMIT) return false;

    if (sameCell(current, board.end)) {
      return (
        collectedLeafMask === targetLeafMask &&
        path.length - 1 >= SWEEP_MIN_SOLUTION_MOVES &&
        turns >= SWEEP_MIN_SOLUTION_TURNS &&
        decisionPoints >= SWEEP_MIN_DECISION_POINTS
      );
    }

    const candidates = passableNeighbors(board, current).filter(
      ({ cell }) => !visited[cellIndex(cell)],
    );
    const nextDecisionPoints =
      decisionPoints + (candidates.length >= 2 ? 1 : 0);
    const ranked = candidates
      .map((candidate) => {
        const nextLeafMask =
          collectedLeafMask | leafMaskAt(board.leaves, candidate.cell);
        const reachesEnd = sameCell(candidate.cell, board.end);
        const endAllowed = nextLeafMask === targetLeafMask;
        const nearestLeafDistance = board.leaves.reduce((distance, leaf, index) => {
          if ((nextLeafMask & (1 << index)) !== 0) return distance;
          return Math.min(distance, manhattan(candidate.cell, leaf));
        }, Number.POSITIVE_INFINITY);
        return {
          ...candidate,
          nextLeafMask,
          score:
            (leafMaskAt(board.leaves, candidate.cell) ? 100 : 0) +
            (reachesEnd && endAllowed ? 60 : 0) -
            (reachesEnd && !endAllowed ? 10_000 : 0) -
            (Number.isFinite(nearestLeafDistance) ? nearestLeafDistance : 0) +
            random(),
        };
      })
      .sort((left, right) => right.score - left.score);

    for (const candidate of ranked) {
      if (sameCell(candidate.cell, board.end) && candidate.nextLeafMask !== targetLeafMask)
        continue;
      const index = cellIndex(candidate.cell);
      visited[index] = true;
      path.push(candidate.cell);
      const nextTurns =
        previousDirection && previousDirection !== candidate.direction
          ? turns + 1
          : turns;
      if (
        visit(
          candidate.cell,
          candidate.nextLeafMask,
          candidate.direction,
          nextTurns,
          nextDecisionPoints,
        )
      )
        return true;
      path.pop();
      visited[index] = false;
    }
    return false;
  };

  return visit(board.start, 0, undefined, 0, 0)
    ? path.map((cell) => ({ ...cell }))
    : undefined;
}

function createCandidateBoard(random: () => number): SweepBoard | undefined {
  const cells = allCells();
  const boundary = shuffled(cells.filter(isBoundaryCell), random);
  const start = boundary[0]!;
  const end = boundary.find(
    (cell) => !sameCell(cell, start) && manhattan(cell, start) >= 6,
  );
  if (!end) return undefined;

  const blocked = new Set(
    shuffled(
      cells.filter(
        (cell) => !sameCell(cell, start) && !sameCell(cell, end),
      ),
      random,
    )
      .slice(0, SWEEP_BLOCKED_COUNT)
      .map(cellKey),
  );
  const boardCells: SweepBoardCell[] = cells.map((cell) => ({
    ...cell,
    kind: blocked.has(cellKey(cell)) ? 'blocked' : 'passable',
  }));
  const leaves = shuffled(
    boardCells.filter(
      (cell) =>
        cell.kind === 'passable' &&
        !sameCell(cell, start) &&
        !sameCell(cell, end),
    ),
    random,
  )
    .slice(0, SWEEP_LEAF_COUNT)
    .map(({ x, y }) => ({ x, y }));
  const partial = {
    columns: SWEEP_GRID_COLUMNS,
    rows: SWEEP_GRID_ROWS,
    cells: boardCells,
    start: { ...start },
    end: { ...end },
    leaves,
  };
  const solution = solveSweepBoard(partial, random);
  return solution ? { ...partial, solution } : undefined;
}

function fallbackBoard(): SweepBoard {
  const solution: SweepCell[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 0 },
    { x: 5, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 1 },
    { x: 6, y: 2 },
    { x: 5, y: 2 },
    { x: 5, y: 3 },
    { x: 6, y: 3 },
    { x: 6, y: 4 },
  ];
  const blocked = new Set([
    '3:0',
    '5:1',
    '0:3',
    '0:4',
    '2:3',
    '4:3',
    '1:4',
    '3:4',
    '5:4',
  ]);
  return {
    columns: SWEEP_GRID_COLUMNS,
    rows: SWEEP_GRID_ROWS,
    cells: allCells().map((cell) => ({
      ...cell,
      kind: blocked.has(cellKey(cell)) ? 'blocked' : 'passable',
    })),
    start: { ...solution[0]! },
    end: { ...solution[solution.length - 1]! },
    leaves: [solution[4]!, solution[8]!, solution[12]!, solution[17]!].map(
      (cell) => ({ ...cell }),
    ),
    solution,
  };
}

function availableMoves(state: SweepGameState): SweepDirection[] {
  return passableNeighbors(state.board, state.player)
    .filter(
      ({ cell }) =>
        !state.visited.some((visited) => sameCell(visited, cell)),
    )
    .map(({ direction }) => direction);
}

export function isSweepDirection(value: unknown): value is SweepDirection {
  return (
    typeof value === 'string' &&
    SWEEP_DIRECTIONS.includes(value as SweepDirection)
  );
}

export function createSweepBoard(seed: string): SweepBoard {
  const random = randomSequence(seed);
  for (let attempt = 0; attempt < SWEEP_GENERATION_ATTEMPTS; attempt += 1) {
    const board = createCandidateBoard(random);
    if (board) return board;
  }
  return fallbackBoard();
}

export function createSweepGameState(seed: string): SweepGameState {
  const board = createSweepBoard(seed);
  return {
    board,
    player: { ...board.start },
    visited: [{ ...board.start }],
    collectedLeaves: [],
    moves: [],
    phase: 'playing',
  };
}

export function sweepGameProgress(state: SweepGameState): SweepGameProgress {
  return {
    player: { ...state.player },
    visited: state.visited.map((cell) => ({ ...cell })),
    cleared: state.collectedLeaves.length,
    totalLeaves: state.board.leaves.length,
    steps: state.moves.length,
    phase: state.phase,
    ...(state.failureReason ? { failureReason: state.failureReason } : {}),
    completed: state.phase === 'completed',
  };
}

export function stepSweepGame(
  state: SweepGameState,
  direction: SweepDirection,
): SweepMoveResult {
  if (state.phase !== 'playing')
    return { state, moved: false, reason: 'finished' };
  const nextPlayer = destination(state.player, direction);
  if (!isPassable(state.board, nextPlayer))
    return { state, moved: false, reason: 'blocked' };
  if (state.visited.some((cell) => sameCell(cell, nextPlayer)))
    return { state, moved: false, reason: 'visited' };

  const collectedLeaves = state.board.leaves.some((leaf) =>
    sameCell(leaf, nextPlayer),
  )
    ? [...state.collectedLeaves, { ...nextPlayer }]
    : state.collectedLeaves;
  const reachedEnd = sameCell(nextPlayer, state.board.end);
  const collectedAllLeaves =
    collectedLeaves.length === state.board.leaves.length;
  const movedState: SweepGameState = {
    ...state,
    player: nextPlayer,
    visited: [...state.visited, nextPlayer],
    collectedLeaves,
    moves: [...state.moves, direction],
    phase: reachedEnd
      ? collectedAllLeaves
        ? 'completed'
        : 'failed'
      : 'playing',
    ...(reachedEnd && !collectedAllLeaves
      ? { failureReason: 'end_too_early' as const }
      : {}),
  };
  if (
    movedState.phase === 'playing' &&
    availableMoves(movedState).length === 0
  ) {
    movedState.phase = 'failed';
    movedState.failureReason = 'dead_end';
  }
  return { moved: true, state: movedState };
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
        reason:
          result.reason === 'visited' ? 'revisited_cell' : 'invalid_move',
      };
    state = result.state;
    if (state.phase === 'failed')
      return {
        state,
        success: false,
        reason: state.failureReason ?? 'dead_end',
      };
  }
  if (state.phase === 'completed') return { state, success: true };
  return {
    state,
    success: false,
    reason:
      state.collectedLeaves.length < state.board.leaves.length
        ? 'leaves_remaining'
        : 'not_at_end',
  };
}

export function sweepDirectionsForPath(
  path: readonly SweepCell[],
): SweepDirection[] {
  const directions: SweepDirection[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    const direction = SWEEP_DIRECTIONS.find((candidate) => {
      const vector = DIRECTION_VECTORS[candidate];
      return (
        current.x - previous.x === vector.x &&
        current.y - previous.y === vector.y
      );
    });
    if (!direction) throw new Error('清扫路径包含非相邻格子');
    directions.push(direction);
  }
  return directions;
}
