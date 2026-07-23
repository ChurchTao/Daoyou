import {
  createSweepGameState,
  stepSweepGame,
  SWEEP_CANVAS,
  SWEEP_GRID_COLUMNS,
  SWEEP_GRID_ROWS,
  sweepGameProgress,
  type SweepCell,
  type SweepDirection,
  type SweepGameProgress,
  type SweepGameState,
} from '@shared/engine/sect';
import * as Phaser from 'phaser';
import {
  SWEEP_BOARD_LEFT,
  SWEEP_BOARD_TOP,
  SWEEP_BOARD_WIDTH,
  SWEEP_CELL_HEIGHT,
  SWEEP_CELL_WIDTH,
  SWEEP_OBSTACLE_FRAME_SIZE,
  SWEEP_OBSTACLE_FRAMES,
  sweepObstacleAngle,
  sweepObstacleFrame,
  sweepVisualCellCenter,
} from './sweepVisualLayout';

const MOVE_DURATION = 105;
const ATLAS_FRAME_SIZE = 256;

const ATLAS_FRAMES = {
  player: { column: 0, row: 0 },
  leafYellow: { column: 1, row: 0 },
  leafRed: { column: 2, row: 0 },
  sweepCurved: { column: 3, row: 0 },
  startSeal: { column: 0, row: 1 },
  endSeal: { column: 1, row: 1 },
  sweepStraight: { column: 2, row: 1 },
  sweepDiagonal: { column: 3, row: 1 },
} as const;

const SWEEP_MARK_FRAMES = [
  'sweepCurved',
  'sweepStraight',
  'sweepDiagonal',
] as const;

export interface SweepPhaserController {
  move: (direction: SweepDirection) => void;
  reset: () => void;
  destroy: () => void;
}

interface SweepPhaserArguments {
  root: HTMLElement;
  seed: string;
  canvasLabel: string;
  onState: (state: SweepGameProgress) => void;
  onSuccess: (moves: SweepDirection[]) => void;
  onError: (message: string) => void;
}

interface QueuedMove {
  direction: SweepDirection;
  state: SweepGameState;
}

function cellKey(cell: SweepCell): string {
  return `${cell.x}:${cell.y}`;
}

function sameCell(left: SweepCell, right: SweepCell) {
  return left.x === right.x && left.y === right.y;
}

function directionBetween(
  from: SweepCell,
  to: SweepCell,
): SweepDirection | undefined {
  if (to.x === from.x && to.y === from.y - 1) return 'up';
  if (to.x === from.x + 1 && to.y === from.y) return 'right';
  if (to.x === from.x && to.y === from.y + 1) return 'down';
  if (to.x === from.x - 1 && to.y === from.y) return 'left';
  return undefined;
}

export function attachSweepPhaser(
  args: SweepPhaserArguments,
): SweepPhaserController {
  let state = createSweepGameState(args.seed);
  let queuedState = state;
  let moveScene: ((direction: SweepDirection) => void) | undefined;
  let resetScene: (() => void) | undefined;
  let destroyed = false;

  class SweepScene extends Phaser.Scene {
    private player?: Phaser.GameObjects.Image;
    private playerShadow?: Phaser.GameObjects.Ellipse;
    private leaves = new Map<string, Phaser.GameObjects.Container>();
    private visitedMarks = new Map<string, Phaser.GameObjects.Image>();
    private moveQueue: QueuedMove[] = [];
    private animating = false;
    private activePointerId?: number;
    private reportedSuccess = false;

    preload() {
      this.load.once(
        Phaser.Loader.Events.FILE_LOAD_ERROR,
        (file: Phaser.Loader.File) => {
          args.onError(`美术资源加载失败：${file.key}`);
        },
      );
      this.load.image(
        'sweep-background',
        '/assets/sect/sweep/cloud-stair-courtyard.webp',
      );
      this.load.image('sweep-atlas', '/assets/sect/sweep/sweep-atlas.webp');
      this.load.image(
        'sweep-obstacles',
        '/assets/sect/sweep/sweep-obstacles.webp',
      );
    }

    create() {
      moveScene = (direction) => this.enqueueDirection(direction);
      resetScene = () => this.resetGame();
      this.add
        .image(
          SWEEP_CANVAS.width / 2,
          SWEEP_CANVAS.height / 2,
          'sweep-background',
        )
        .setDisplaySize(SWEEP_CANVAS.width, SWEEP_CANVAS.height)
        .setDepth(0);
      this.registerSpriteFrames();
      this.drawBoard();
      this.createLeaves();
      this.createPlayer();
      this.bindKeyboard();
      this.bindPointerRelease();
      this.renderVisited();
      args.onState(sweepGameProgress(state));
      const canvas = this.game.canvas;
      canvas.setAttribute('aria-label', args.canvasLabel);
      canvas.setAttribute('role', 'application');
    }

    private enqueueDirection(direction: SweepDirection) {
      if (queuedState.phase !== 'playing') return;
      const result = stepSweepGame(queuedState, direction);
      if (!result.moved) {
        if (!this.animating && this.moveQueue.length === 0)
          this.blockedFeedback();
        return;
      }
      queuedState = result.state;
      this.moveQueue.push({ direction, state: queuedState });
      this.pumpQueue();
    }

    private enqueueCell(cell: SweepCell) {
      const direction = directionBetween(queuedState.player, cell);
      if (direction) this.enqueueDirection(direction);
    }

    private pumpQueue() {
      if (this.animating) return;
      const next = this.moveQueue.shift();
      if (!next) return;
      const previous = state.player;
      const target = sweepVisualCellCenter(next.state.player);
      this.animating = true;
      this.player?.setFlipX(next.state.player.x < previous.x);
      this.tweens.add({
        targets: this.playerShadow,
        x: target.x,
        y: target.y + 13,
        duration: MOVE_DURATION,
        ease: 'Sine.easeOut',
      });
      this.tweens.add({
        targets: this.player,
        x: target.x,
        y: target.y - 4,
        duration: MOVE_DURATION,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.animating = false;
          state = next.state;
          this.collectLeafAtPlayer();
          this.renderVisited();
          if (state.phase === 'failed') this.player?.setTint(0xa94032);
          args.onState(sweepGameProgress(state));
          if (state.phase === 'completed' && !this.reportedSuccess) {
            this.reportedSuccess = true;
            args.onSuccess([...state.moves]);
          }
          this.pumpQueue();
        },
      });
    }

    private resetGame() {
      this.tweens.killAll();
      this.moveQueue = [];
      this.animating = false;
      this.reportedSuccess = false;
      this.activePointerId = undefined;
      state = createSweepGameState(args.seed);
      queuedState = state;
      this.leaves.forEach((leaf) => leaf.destroy());
      this.leaves.clear();
      this.visitedMarks.forEach((mark) => mark.destroy());
      this.visitedMarks.clear();
      this.createLeaves();
      const start = sweepVisualCellCenter(state.player);
      this.playerShadow?.setPosition(start.x, start.y + 13).setAlpha(0.22);
      this.player
        ?.clearTint()
        .setPosition(start.x, start.y - 4)
        .setFlipX(false)
        .setAlpha(1);
      this.renderVisited();
      args.onState(sweepGameProgress(state));
    }

    private registerSpriteFrames() {
      const texture = this.textures.get('sweep-atlas');
      for (const [name, frame] of Object.entries(ATLAS_FRAMES)) {
        if (!texture.has(name))
          texture.add(
            name,
            0,
            frame.column * ATLAS_FRAME_SIZE,
            frame.row * ATLAS_FRAME_SIZE,
            ATLAS_FRAME_SIZE,
            ATLAS_FRAME_SIZE,
          );
      }

      const obstacleTexture = this.textures.get('sweep-obstacles');
      SWEEP_OBSTACLE_FRAMES.forEach((name, index) => {
        if (!obstacleTexture.has(name))
          obstacleTexture.add(
            name,
            0,
            (index % 2) * SWEEP_OBSTACLE_FRAME_SIZE,
            Math.floor(index / 2) * SWEEP_OBSTACLE_FRAME_SIZE,
            SWEEP_OBSTACLE_FRAME_SIZE,
            SWEEP_OBSTACLE_FRAME_SIZE,
          );
      });
    }

    private drawBoard() {
      this.drawStoneGrid();
      for (const cell of state.board.cells) {
        const center = sweepVisualCellCenter(cell);
        if (cell.kind === 'blocked') {
          this.add
            .image(
              center.x,
              center.y,
              'sweep-obstacles',
              sweepObstacleFrame(cell),
            )
            .setDisplaySize(86, 74)
            .setAngle(sweepObstacleAngle(cell))
            .setFlipX((cell.x + cell.y) % 2 === 1)
            .setAlpha(0.9)
            .setDepth(1.4);
          continue;
        }

        const tile = this.add
          .zone(center.x, center.y, SWEEP_CELL_WIDTH, SWEEP_CELL_HEIGHT)
          .setDepth(1)
          .setInteractive({ useHandCursor: true });
        tile.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.activePointerId = pointer.id;
          this.enqueueCell(cell);
        });
        tile.on('pointerover', (pointer: Phaser.Input.Pointer) => {
          if (pointer.isDown && this.activePointerId === pointer.id)
            this.enqueueCell(cell);
        });
      }

      this.drawMarker(state.board.start, 'startSeal');
      this.drawMarker(state.board.end, 'endSeal');
    }

    private drawStoneGrid() {
      const grid = this.add
        .graphics()
        .setDepth(0.8)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
      grid.lineStyle(1, 0x6e675a, 0.15);
      for (let column = 1; column < SWEEP_GRID_COLUMNS; column += 1) {
        const x = SWEEP_BOARD_LEFT + column * SWEEP_CELL_WIDTH;
        grid.lineBetween(
          x,
          SWEEP_BOARD_TOP + 4,
          x,
          SWEEP_BOARD_TOP + SWEEP_GRID_ROWS * SWEEP_CELL_HEIGHT - 4,
        );
      }
      for (let row = 1; row < SWEEP_GRID_ROWS; row += 1) {
        const y = SWEEP_BOARD_TOP + row * SWEEP_CELL_HEIGHT;
        grid.lineBetween(
          SWEEP_BOARD_LEFT + 4,
          y,
          SWEEP_BOARD_LEFT + SWEEP_BOARD_WIDTH - 4,
          y,
        );
      }
    }

    private drawMarker(cell: SweepCell, frame: 'startSeal' | 'endSeal') {
      const center = sweepVisualCellCenter(cell);
      const marker = this.add
        .image(center.x, center.y, 'sweep-atlas', frame)
        .setDisplaySize(50, 40)
        .setAlpha(frame === 'startSeal' ? 0.48 : 0.72)
        .setDepth(1.8);
      if (frame === 'startSeal')
        marker.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    private createLeaves() {
      state.board.leaves.forEach((leaf, index) => {
        const center = sweepVisualCellCenter(leaf);
        const shadow = this.add.ellipse(1, 5, 26, 10, 0x19201d, 0.2);
        const image = this.add
          .image(
            0,
            -2,
            'sweep-atlas',
            index % 2 === 0 ? 'leafYellow' : 'leafRed',
          )
          .setDisplaySize(36, 36);
        const cluster = this.add
          .container(center.x, center.y, [shadow, image])
          .setAngle((index * 47) % 360)
          .setDepth(2.8);
        this.leaves.set(cellKey(leaf), cluster);
      });
    }

    private createPlayer() {
      const start = sweepVisualCellCenter(state.player);
      this.playerShadow = this.add
        .ellipse(start.x, start.y + 13, 38, 15, 0x151b19, 0.22)
        .setDepth(3.6);
      this.player = this.add
        .image(start.x, start.y - 4, 'sweep-atlas', 'player')
        .setDisplaySize(66, 66)
        .setDepth(4);
    }

    private renderVisited() {
      for (const cell of state.visited) {
        const key = cellKey(cell);
        if (!this.visitedMarks.has(key)) {
          const center = sweepVisualCellCenter(cell);
          const frame = SWEEP_MARK_FRAMES[(cell.x * 17 + cell.y * 31) % 3];
          const mark = this.add
            .image(center.x, center.y, 'sweep-atlas', frame)
            .setDisplaySize(58, 48)
            .setTint(0x5f584d)
            .setAlpha(0.25)
            .setAngle(((cell.x * 11 + cell.y * 7) % 15) - 7)
            .setBlendMode(Phaser.BlendModes.MULTIPLY)
            .setDepth(2.1);
          this.visitedMarks.set(key, mark);
        }
      }
    }

    private collectLeafAtPlayer() {
      if (!state.collectedLeaves.some((leaf) => sameCell(leaf, state.player)))
        return;
      const cluster = this.leaves.get(cellKey(state.player));
      if (!cluster) return;
      this.leaves.delete(cellKey(state.player));
      this.tweens.add({
        targets: cluster,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        angle: cluster.angle + 80,
        duration: 150,
        onComplete: () => cluster.destroy(),
      });
    }

    private blockedFeedback() {
      if (!this.player) return;
      this.animating = true;
      this.tweens.add({
        targets: this.player,
        angle: { from: -4, to: 4 },
        duration: 45,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          this.player?.setAngle(0);
          this.animating = false;
          this.pumpQueue();
        },
      });
    }

    private bindKeyboard() {
      const keyboard = this.input.keyboard;
      if (!keyboard) return;
      const onKeyDown = (event: KeyboardEvent) => {
        const directions: Record<string, SweepDirection> = {
          ArrowUp: 'up',
          KeyW: 'up',
          ArrowRight: 'right',
          KeyD: 'right',
          ArrowDown: 'down',
          KeyS: 'down',
          ArrowLeft: 'left',
          KeyA: 'left',
        };
        const direction = directions[event.code];
        if (!direction || event.repeat) return;
        event.preventDefault();
        this.enqueueDirection(direction);
      };
      keyboard.on('keydown', onKeyDown);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        keyboard.off('keydown', onKeyDown);
      });
    }

    private bindPointerRelease() {
      const release = () => {
        this.activePointerId = undefined;
      };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.input.off('pointerup', release);
        this.input.off('pointerupoutside', release);
      });
    }
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: args.root,
    width: SWEEP_CANVAS.width,
    height: SWEEP_CANVAS.height,
    backgroundColor: '#171b1a',
    transparent: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: SWEEP_CANVAS.width,
      height: SWEEP_CANVAS.height,
    },
    scene: SweepScene,
  };
  const game = new Phaser.Game(config);

  return {
    move: (direction) => moveScene?.(direction),
    reset: () => resetScene?.(),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      moveScene = undefined;
      resetScene = undefined;
      game.destroy(true);
    },
  };
}
