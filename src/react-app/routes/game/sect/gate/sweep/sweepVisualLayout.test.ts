import {
  SWEEP_CANVAS,
  SWEEP_GRID_COLUMNS,
  SWEEP_GRID_ROWS,
} from '@shared/engine/sect';
import { describe, expect, it } from 'vitest';
import {
  SWEEP_BOARD_LEFT,
  SWEEP_BOARD_WIDTH,
  SWEEP_CELL_HEIGHT,
  SWEEP_OBSTACLE_FRAMES,
  sweepObstacleAngle,
  sweepObstacleFrame,
  sweepVisualCellCenter,
} from './sweepVisualLayout';

describe('sweep visual layout', () => {
  it('fits the interaction lattice inside the courtyard apron', () => {
    const first = sweepVisualCellCenter({ x: 0, y: 0 });
    const last = sweepVisualCellCenter({
      x: SWEEP_GRID_COLUMNS - 1,
      y: SWEEP_GRID_ROWS - 1,
    });

    expect(SWEEP_BOARD_LEFT).toBeGreaterThan(SWEEP_CANVAS.width * 0.25);
    expect(SWEEP_BOARD_LEFT + SWEEP_BOARD_WIDTH).toBeLessThan(
      SWEEP_CANVAS.width * 0.75,
    );
    expect(first.y).toBeGreaterThan(SWEEP_CANVAS.height * 0.3);
    expect(last.y + SWEEP_CELL_HEIGHT / 2).toBeLessThan(
      SWEEP_CANVAS.height * 0.82,
    );
  });

  it('selects deterministic compact obstacle variants', () => {
    const frames = new Set<string>();
    for (let y = 0; y < SWEEP_GRID_ROWS; y += 1) {
      for (let x = 0; x < SWEEP_GRID_COLUMNS; x += 1) {
        const cell = { x, y };
        const frame = sweepObstacleFrame(cell);
        frames.add(frame);
        expect(SWEEP_OBSTACLE_FRAMES).toContain(frame);
        expect(sweepObstacleAngle(cell)).toBeGreaterThanOrEqual(-4);
        expect(sweepObstacleAngle(cell)).toBeLessThanOrEqual(4);
      }
    }

    expect(frames).toEqual(new Set(SWEEP_OBSTACLE_FRAMES));
  });
});
