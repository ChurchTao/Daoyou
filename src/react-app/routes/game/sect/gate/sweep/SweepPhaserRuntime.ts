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

const CELL_SIZE = 92;
const CELL_GAP = 7;
const BOARD_WIDTH = SWEEP_GRID_COLUMNS * CELL_SIZE;
const BOARD_HEIGHT = SWEEP_GRID_ROWS * CELL_SIZE;
const BOARD_LEFT = (SWEEP_CANVAS.width - BOARD_WIDTH) / 2;
const BOARD_TOP = (SWEEP_CANVAS.height - BOARD_HEIGHT) / 2;
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

function cellCenter(cell: SweepCell) {
  return {
    x: BOARD_LEFT + cell.x * CELL_SIZE + CELL_SIZE / 2,
    y: BOARD_TOP + cell.y * CELL_SIZE + CELL_SIZE / 2,
  };
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
    private leaves = new Map<string, Phaser.GameObjects.Image>();
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
        .setDisplaySize(SWEEP_CANVAS.width, SWEEP_CANVAS.height);
      this.add
        .rectangle(
          SWEEP_CANVAS.width / 2,
          SWEEP_CANVAS.height / 2,
          SWEEP_CANVAS.width,
          SWEEP_CANVAS.height,
          0x171b1a,
          0.22,
        )
        .setDepth(0.5);
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
      const target = cellCenter(next.state.player);
      this.animating = true;
      this.player?.setFlipX(next.state.player.x < previous.x);
      this.tweens.add({
        targets: this.player,
        x: target.x,
        y: target.y,
        duration: MOVE_DURATION,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.animating = false;
          state = next.state;
          this.collectLeafAtPlayer();
          this.renderVisited();
          if (state.phase === 'failed')
            this.player?.setTint(0xa94032);
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
      const start = cellCenter(state.player);
      this.player
        ?.clearTint()
        .setPosition(start.x, start.y)
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
    }

    private drawBoard() {
      for (const cell of state.board.cells) {
        const center = cellCenter(cell);
        const size = CELL_SIZE - CELL_GAP;
        const tile = this.add
          .rectangle(
            center.x,
            center.y,
            size,
            size,
            cell.kind === 'blocked' ? 0x17201f : 0xd9c9a2,
            cell.kind === 'blocked' ? 0.82 : 0.88,
          )
          .setStrokeStyle(
            cell.kind === 'blocked' ? 2 : 3,
            cell.kind === 'blocked' ? 0x31413d : 0xf4ead2,
            cell.kind === 'blocked' ? 0.8 : 0.72,
          )
          .setDepth(1);
        if (cell.kind === 'blocked') {
          const cross = this.add.graphics().setDepth(1.2);
          cross.lineStyle(7, 0x0b1110, 0.72);
          const inset = size * 0.26;
          cross.lineBetween(
            center.x - inset,
            center.y - inset,
            center.x + inset,
            center.y + inset,
          );
          cross.lineBetween(
            center.x + inset,
            center.y - inset,
            center.x - inset,
            center.y + inset,
          );
          continue;
        }
        tile.setInteractive({ useHandCursor: true });
        tile.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.activePointerId = pointer.id;
          this.enqueueCell(cell);
        });
        tile.on('pointerover', (pointer: Phaser.Input.Pointer) => {
          if (
            pointer.isDown &&
            this.activePointerId === pointer.id
          )
            this.enqueueCell(cell);
        });
      }

      this.drawMarker(state.board.start, 'startSeal');
      this.drawMarker(state.board.end, 'endSeal');
    }

    private drawMarker(cell: SweepCell, frame: 'startSeal' | 'endSeal') {
      const center = cellCenter(cell);
      this.add
        .image(center.x, center.y, 'sweep-atlas', frame)
        .setDisplaySize(70, 70)
        .setAlpha(0.92)
        .setDepth(2.6);
    }

    private createLeaves() {
      state.board.leaves.forEach((leaf, index) => {
        const center = cellCenter(leaf);
        const image = this.add
          .image(
            center.x,
            center.y,
            'sweep-atlas',
            index % 2 === 0 ? 'leafYellow' : 'leafRed',
          )
          .setDisplaySize(53, 53)
          .setAngle((index * 47) % 360)
          .setDepth(3);
        this.leaves.set(cellKey(leaf), image);
      });
    }

    private createPlayer() {
      const start = cellCenter(state.player);
      this.player = this.add
        .image(start.x, start.y, 'sweep-atlas', 'player')
        .setDisplaySize(84, 84)
        .setDepth(5);
    }

    private renderVisited() {
      for (const cell of state.visited) {
        const key = cellKey(cell);
        if (!this.visitedMarks.has(key)) {
          const center = cellCenter(cell);
          const frame = SWEEP_MARK_FRAMES[(cell.x * 17 + cell.y * 31) % 3];
          const mark = this.add
            .image(center.x, center.y, 'sweep-atlas', frame)
            .setDisplaySize(72, 72)
            .setTint(0x645b4d)
            .setAlpha(0.32)
            .setAngle(((cell.x * 11 + cell.y * 7) % 15) - 7)
            .setDepth(2);
          this.visitedMarks.set(key, mark);
        }
      }
    }

    private collectLeafAtPlayer() {
      if (
        !state.collectedLeaves.some((leaf) =>
          sameCell(leaf, state.player),
        )
      )
        return;
      const leaf = this.leaves.get(cellKey(state.player));
      if (!leaf) return;
      this.leaves.delete(cellKey(state.player));
      this.tweens.add({
        targets: leaf,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        angle: leaf.angle + 80,
        duration: 150,
        onComplete: () => leaf.destroy(),
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
