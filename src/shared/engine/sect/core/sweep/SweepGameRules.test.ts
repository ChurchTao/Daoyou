import { describe, expect, it } from 'vitest';
import {
  createSweepGameState,
  createSweepMaze,
  simulateSweepMoves,
  stepSweepGame,
  sweepDirectionsForPath,
  SWEEP_GRID_COLUMNS,
  SWEEP_GRID_ROWS,
  SWEEP_LEAF_COUNT,
  SWEEP_MAX_MOVES,
  type SweepCell,
  type SweepMaze,
} from './SweepGameRules';

const key = (cell: SweepCell) => `${cell.x}:${cell.y}`;

function edgeCount(maze: SweepMaze) {
  return maze.cells.reduce((sum, cell) => sum + cell.passages.length, 0) / 2;
}

function isBoundary(cell: SweepCell) {
  return (
    cell.x === 0 ||
    cell.y === 0 ||
    cell.x === SWEEP_GRID_COLUMNS - 1 ||
    cell.y === SWEEP_GRID_ROWS - 1
  );
}

describe('SweepGameRules', () => {
  it('generates the same perfect maze, endpoints, and leaves for the same seed', () => {
    const left = createSweepMaze('sect:date:session');
    const right = createSweepMaze('sect:date:session');

    expect(right).toEqual(left);
    expect(left.cells).toHaveLength(SWEEP_GRID_COLUMNS * SWEEP_GRID_ROWS);
    expect(edgeCount(left)).toBe(left.cells.length - 1);
    expect(left.solution).toHaveLength(new Set(left.solution.map(key)).size);
  });

  it('chooses boundary endpoints and places twelve unique leaves on their path', () => {
    const maze = createSweepMaze('leaf-placement');
    const solutionKeys = new Set(maze.solution.map(key));
    const leafKeys = maze.leaves.map(key);

    expect(isBoundary(maze.start)).toBe(true);
    expect(isBoundary(maze.end)).toBe(true);
    expect(maze.leaves).toHaveLength(SWEEP_LEAF_COUNT);
    expect(new Set(leafKeys).size).toBe(SWEEP_LEAF_COUNT);
    expect(leafKeys).not.toContain(key(maze.start));
    expect(leafKeys).not.toContain(key(maze.end));
    expect(leafKeys.every((leaf) => solutionKeys.has(leaf))).toBe(true);
  });

  it('replays the unique solution to collect every leaf and reach the end', () => {
    const state = createSweepGameState('sweep-success');
    const moves = sweepDirectionsForPath(state.maze.solution);
    const result = simulateSweepMoves('sweep-success', moves);

    expect(result.success).toBe(true);
    expect(result.state.completed).toBe(true);
    expect(result.state.collectedLeaves).toHaveLength(SWEEP_LEAF_COUNT);
    expect(result.state.player).toEqual(result.state.maze.end);
  });

  it('blocks walls and visited cells during local play', () => {
    const state = createSweepGameState('blocked-moves');
    const startCell = state.maze.cells.find(
      (cell) => cell.x === state.player.x && cell.y === state.player.y,
    )!;
    const wall = ['up', 'right', 'down', 'left'].find(
      (direction) => !startCell.passages.includes(direction as never),
    ) as 'up' | 'right' | 'down' | 'left';
    const forward = startCell.passages[0]!;
    const moved = stepSweepGame(state, forward);

    expect(stepSweepGame(state, wall)).toMatchObject({ moved: false, reason: 'wall' });
    expect(moved.moved).toBe(true);
    const reverse = { up: 'down', right: 'left', down: 'up', left: 'right' }[
      forward
    ] as 'up' | 'right' | 'down' | 'left';
    expect(stepSweepGame(moved.state, reverse)).toMatchObject({
      moved: false,
      reason: 'visited',
    });
  });

  it('rejects illegal, repeated, oversized, and incomplete server traces', () => {
    const state = createSweepGameState('server-validation');
    const first = sweepDirectionsForPath(state.maze.solution)[0]!;
    const reverse = { up: 'down', right: 'left', down: 'up', left: 'right' }[
      first
    ] as 'up' | 'right' | 'down' | 'left';

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
