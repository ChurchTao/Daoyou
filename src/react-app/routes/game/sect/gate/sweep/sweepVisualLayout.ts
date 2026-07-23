import {
  SWEEP_CANVAS,
  SWEEP_GRID_COLUMNS,
  type SweepCell,
} from '@shared/engine/sect';

export const SWEEP_CELL_WIDTH = 78;
export const SWEEP_CELL_HEIGHT = 66;
export const SWEEP_BOARD_TOP = 176;
export const SWEEP_BOARD_WIDTH = SWEEP_GRID_COLUMNS * SWEEP_CELL_WIDTH;
export const SWEEP_BOARD_LEFT = (SWEEP_CANVAS.width - SWEEP_BOARD_WIDTH) / 2;
export const SWEEP_OBSTACLE_FRAME_SIZE = 192;

export const SWEEP_OBSTACLE_FRAMES = [
  'obstacleCracked',
  'obstacleAsh',
  'obstacleMoss',
  'obstacleSlate',
] as const;

export type SweepObstacleFrame = (typeof SWEEP_OBSTACLE_FRAMES)[number];

export function sweepVisualCellCenter(cell: SweepCell) {
  return {
    x: SWEEP_BOARD_LEFT + cell.x * SWEEP_CELL_WIDTH + SWEEP_CELL_WIDTH / 2,
    y: SWEEP_BOARD_TOP + cell.y * SWEEP_CELL_HEIGHT + SWEEP_CELL_HEIGHT / 2,
  };
}

export function sweepObstacleFrame(cell: SweepCell): SweepObstacleFrame {
  return SWEEP_OBSTACLE_FRAMES[
    (cell.x * 3 + cell.y * 5) % SWEEP_OBSTACLE_FRAMES.length
  ];
}

export function sweepObstacleAngle(cell: SweepCell): number {
  return ((cell.x * 11 + cell.y * 7) % 9) - 4;
}
