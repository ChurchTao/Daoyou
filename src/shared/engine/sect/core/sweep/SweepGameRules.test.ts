import { describe, expect, it } from 'vitest';
import {
  createSweepBoard,
  createSweepGameState,
  simulateSweepMoves,
  stepSweepGame,
  sweepDirectionsForPath,
  SWEEP_BLOCKED_COUNT,
  SWEEP_DIRECTIONS,
  SWEEP_GRID_COLUMNS,
  SWEEP_GRID_ROWS,
  SWEEP_LEAF_COUNT,
  SWEEP_MAX_MOVES,
  type SweepBoard,
  type SweepCell,
  type SweepDirection,
} from './SweepGameRules';

const key = (cell: SweepCell) => `${cell.x}:${cell.y}`;

function isBoundary(cell: SweepCell) {
  return (
    cell.x === 0 ||
    cell.y === 0 ||
    cell.x === SWEEP_GRID_COLUMNS - 1 ||
    cell.y === SWEEP_GRID_ROWS - 1
  );
}

function turns(path: readonly SweepCell[]) {
  const directions = sweepDirectionsForPath(path);
  return directions.reduce(
    (sum, direction, index) =>
      index > 0 && directions[index - 1] !== direction ? sum + 1 : sum,
    0,
  );
}

function directionBetween(from: SweepCell, to: SweepCell): SweepDirection {
  const direction = SWEEP_DIRECTIONS.find((candidate) => {
    const vectors: Record<SweepDirection, SweepCell> = {
      up: { x: 0, y: -1 },
      right: { x: 1, y: 0 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
    };
    return (
      from.x + vectors[candidate].x === to.x &&
      from.y + vectors[candidate].y === to.y
    );
  });
  if (!direction) throw new Error('测试格子不相邻');
  return direction;
}

function passableNeighbors(board: SweepBoard, cell: SweepCell) {
  return board.cells.filter(
    (candidate) =>
      candidate.kind === 'passable' &&
      Math.abs(candidate.x - cell.x) + Math.abs(candidate.y - cell.y) === 1,
  );
}

function decisionPoints(
  board: SweepBoard,
  path: readonly SweepCell[],
): number {
  const visited = new Set<string>([key(path[0]!)]);
  let count = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const choices = passableNeighbors(board, path[index]!).filter(
      (cell) => !visited.has(key(cell)),
    );
    if (choices.length >= 2) count += 1;
    visited.add(key(path[index + 1]!));
  }
  return count;
}

describe('SweepGameRules', () => {
  it('generates the same 7x5 board for the same seed', () => {
    const left = createSweepBoard('sect:date:session');
    const right = createSweepBoard('sect:date:session');

    expect(right).toEqual(left);
    expect(left.cells).toHaveLength(SWEEP_GRID_COLUMNS * SWEEP_GRID_ROWS);
    expect(left.cells.filter((cell) => cell.kind === 'blocked')).toHaveLength(
      SWEEP_BLOCKED_COUNT,
    );
    expect(left.solution).toHaveLength(new Set(left.solution.map(key)).size);
  });

  it('generates solvable, non-trivial boards across representative seeds', () => {
    for (let index = 0; index < 40; index += 1) {
      const board = createSweepBoard(`batch-seed-${index}`);
      const solutionKeys = new Set(board.solution.map(key));
      const leafKeys = board.leaves.map(key);

      expect(isBoundary(board.start)).toBe(true);
      expect(isBoundary(board.end)).toBe(true);
      expect(board.leaves).toHaveLength(SWEEP_LEAF_COUNT);
      expect(new Set(leafKeys).size).toBe(SWEEP_LEAF_COUNT);
      expect(leafKeys).not.toContain(key(board.start));
      expect(leafKeys).not.toContain(key(board.end));
      expect(leafKeys.every((leaf) => solutionKeys.has(leaf))).toBe(true);
      expect(board.solution.length - 1).toBeGreaterThanOrEqual(14);
      expect(turns(board.solution)).toBeGreaterThanOrEqual(5);
      expect(decisionPoints(board, board.solution)).toBeGreaterThanOrEqual(3);
      expect(
        simulateSweepMoves(
          `batch-seed-${index}`,
          sweepDirectionsForPath(board.solution),
        ).success,
      ).toBe(true);
    }
  });

  it('replays a solution to collect every leaf and finish at the end', () => {
    const board = createSweepBoard('sweep-success');
    const result = simulateSweepMoves(
      'sweep-success',
      sweepDirectionsForPath(board.solution),
    );

    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('completed');
    expect(result.state.collectedLeaves).toHaveLength(SWEEP_LEAF_COUNT);
    expect(result.state.player).toEqual(result.state.board.end);
  });

  it('blocks obstacle and visited cells without ending the run', () => {
    const state = createSweepGameState('blocked-moves');
    const blockedDirection = SWEEP_DIRECTIONS.find((direction) => {
      const next = {
        up: { x: state.player.x, y: state.player.y - 1 },
        right: { x: state.player.x + 1, y: state.player.y },
        down: { x: state.player.x, y: state.player.y + 1 },
        left: { x: state.player.x - 1, y: state.player.y },
      }[direction];
      return (
        !next ||
        state.board.cells.find(
          (cell) => cell.x === next.x && cell.y === next.y,
        )?.kind !== 'passable'
      );
    })!;
    const forward = sweepDirectionsForPath(state.board.solution)[0]!;
    const moved = stepSweepGame(state, forward);
    const reverse = {
      up: 'down',
      right: 'left',
      down: 'up',
      left: 'right',
    }[forward] as SweepDirection;

    expect(stepSweepGame(state, blockedDirection)).toMatchObject({
      moved: false,
      reason: 'blocked',
    });
    expect(moved.moved).toBe(true);
    expect(stepSweepGame(moved.state, reverse)).toMatchObject({
      moved: false,
      reason: 'visited',
    });
  });

  it('fails when entering the end early or running out of legal cells', () => {
    const state = createSweepGameState('failure-states');
    const endNeighbor = passableNeighbors(state.board, state.board.end)[0]!;
    const earlyEnd = stepSweepGame(
      {
        ...state,
        player: { ...endNeighbor },
        visited: [{ ...endNeighbor }],
      },
      directionBetween(endNeighbor, state.board.end),
    );
    expect(earlyEnd.state).toMatchObject({
      phase: 'failed',
      failureReason: 'end_too_early',
    });

    const target = state.board.cells.find(
      (cell) =>
        cell.kind === 'passable' &&
        ![state.board.start, state.board.end].some(
          (special) => key(special) === key(cell),
        ) &&
        passableNeighbors(state.board, cell).length > 0,
    )!;
    const previous = passableNeighbors(state.board, target)[0]!;
    const deadEnd = stepSweepGame(
      {
        ...state,
        player: { ...previous },
        visited: state.board.cells
          .filter(
            (cell) =>
              cell.kind === 'passable' &&
              key(cell) !== key(target),
          )
          .map(({ x, y }) => ({ x, y })),
      },
      directionBetween(previous, target),
    );
    expect(deadEnd.state).toMatchObject({
      phase: 'failed',
      failureReason: 'dead_end',
    });
  });

  it('rejects illegal, repeated, oversized, and incomplete server traces', () => {
    const state = createSweepGameState('server-validation');
    const first = sweepDirectionsForPath(state.board.solution)[0]!;
    const reverse = {
      up: 'down',
      right: 'left',
      down: 'up',
      left: 'right',
    }[first] as SweepDirection;

    expect(simulateSweepMoves('server-validation', ['diagonal']).reason).toBe(
      'invalid_move',
    );
    expect(simulateSweepMoves('server-validation', [first, reverse]).reason).toBe(
      'revisited_cell',
    );
    expect(
      simulateSweepMoves(
        'server-validation',
        Array.from({ length: SWEEP_MAX_MOVES + 1 }, () => first),
      ).reason,
    ).toBe('too_many_moves');
    expect(simulateSweepMoves('server-validation', [first]).reason).toBe(
      'leaves_remaining',
    );
  });
});
