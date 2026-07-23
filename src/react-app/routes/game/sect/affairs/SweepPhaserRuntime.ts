import {
  createSweepGameState,
  stepSweepGame,
  SWEEP_BOARD,
  sweepGameProgress,
  type SweepCell,
  type SweepDirection,
  type SweepGameProgress,
} from '@shared/engine/sect';
import * as Phaser from 'phaser';

const CELL_SIZE = 48;
const MAZE_WIDTH = 13 * CELL_SIZE;
const MAZE_LEFT = (SWEEP_BOARD.width - MAZE_WIDTH) / 2;
const MAZE_TOP = 128;
const MOVE_DURATION = 120;
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
  onState: (state: SweepGameProgress) => void;
  onSuccess: (moves: SweepDirection[]) => void;
  onError: (message: string) => void;
}

function cellKey(cell: SweepCell): string {
  return `${cell.x}:${cell.y}`;
}

function cellCenter(cell: SweepCell) {
  return {
    x: MAZE_LEFT + cell.x * CELL_SIZE + CELL_SIZE / 2,
    y: MAZE_TOP + cell.y * CELL_SIZE + CELL_SIZE / 2,
  };
}

function sameCell(left: SweepCell, right: SweepCell) {
  return left.x === right.x && left.y === right.y;
}

export function attachSweepPhaser(
  args: SweepPhaserArguments,
): SweepPhaserController {
  let state = createSweepGameState(args.seed);
  let moveScene: ((direction: SweepDirection) => void) | undefined;
  let resetScene: (() => void) | undefined;
  let destroyed = false;

  class SweepScene extends Phaser.Scene {
    private player?: Phaser.GameObjects.Image;
    private leaves = new Map<string, Phaser.GameObjects.Image>();
    private visitedMarks = new Map<string, Phaser.GameObjects.Image>();
    private animating = false;
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
      moveScene = (direction) => this.move(direction);
      resetScene = () => this.resetGame();
      this.add
        .image(
          SWEEP_BOARD.width / 2,
          SWEEP_BOARD.height / 2,
          'sweep-background',
        )
        .setDisplaySize(SWEEP_BOARD.width, SWEEP_BOARD.height);
      this.registerSpriteFrames();
      this.drawMaze();
      this.createLeaves();
      this.createPlayer();
      this.bindKeyboard();
      this.renderVisited();
      args.onState(sweepGameProgress(state));
    }

    move(direction: SweepDirection) {
      if (this.animating || state.completed) return;
      const result = stepSweepGame(state, direction);
      if (!result.moved) {
        this.blockedFeedback();
        return;
      }

      const previous = state.player;
      state = result.state;
      const target = cellCenter(state.player);
      this.animating = true;
      this.player?.setFlipX(state.player.x < previous.x);
      this.tweens.add({
        targets: this.player,
        x: target.x,
        y: target.y,
        duration: MOVE_DURATION,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.animating = false;
          this.collectLeafAtPlayer();
          this.renderVisited();
          args.onState(sweepGameProgress(state));
          if (state.completed && !this.reportedSuccess) {
            this.reportedSuccess = true;
            args.onSuccess([...state.moves]);
          }
        },
      });
    }

    resetGame() {
      if (this.animating && this.player) this.tweens.killTweensOf(this.player);
      this.animating = false;
      this.reportedSuccess = false;
      state = createSweepGameState(args.seed);
      this.leaves.forEach((leaf) => leaf.destroy());
      this.leaves.clear();
      this.visitedMarks.forEach((mark) => mark.destroy());
      this.visitedMarks.clear();
      this.createLeaves();
      const start = cellCenter(state.player);
      this.player?.setPosition(start.x, start.y).setFlipX(false).setAlpha(1);
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

    private drawMaze() {
      const wallSegments: Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }> = [];
      for (const cell of state.maze.cells) {
        const left = MAZE_LEFT + cell.x * CELL_SIZE;
        const top = MAZE_TOP + cell.y * CELL_SIZE;
        if (!cell.passages.includes('up'))
          wallSegments.push({
            x1: left,
            y1: top,
            x2: left + CELL_SIZE,
            y2: top,
          });
        if (!cell.passages.includes('left'))
          wallSegments.push({
            x1: left,
            y1: top,
            x2: left,
            y2: top + CELL_SIZE,
          });
        if (cell.y === state.maze.rows - 1 && !cell.passages.includes('down'))
          wallSegments.push({
            x1: left,
            y1: top + CELL_SIZE,
            x2: left + CELL_SIZE,
            y2: top + CELL_SIZE,
          });
        if (
          cell.x === state.maze.columns - 1 &&
          !cell.passages.includes('right')
        )
          wallSegments.push({
            x1: left + CELL_SIZE,
            y1: top,
            x2: left + CELL_SIZE,
            y2: top + CELL_SIZE,
          });
      }

      const grooves = this.add.graphics().setDepth(2);
      grooves.lineStyle(2, 0x574f43, 0.46);
      wallSegments.forEach((wall) =>
        grooves.lineBetween(wall.x1, wall.y1, wall.x2, wall.y2),
      );

      const highlights = this.add.graphics().setDepth(2);
      highlights.lineStyle(1, 0xf8f2e7, 0.36);
      wallSegments.forEach((wall) => {
        const vertical = wall.x1 === wall.x2;
        highlights.lineBetween(
          wall.x1 + (vertical ? 1 : 0),
          wall.y1 + (vertical ? 0 : 1),
          wall.x2 + (vertical ? 1 : 0),
          wall.y2 + (vertical ? 0 : 1),
        );
      });

      this.drawMarker(state.maze.start, 'startSeal');
      this.drawMarker(state.maze.end, 'endSeal');
    }

    private drawMarker(cell: SweepCell, frame: 'startSeal' | 'endSeal') {
      const center = cellCenter(cell);
      this.add
        .image(center.x, center.y, 'sweep-atlas', frame)
        .setDisplaySize(40, 40)
        .setAlpha(0.88)
        .setDepth(2.5);
    }

    private createLeaves() {
      state.maze.leaves.forEach((leaf, index) => {
        const center = cellCenter(leaf);
        const image = this.add
          .image(
            center.x,
            center.y,
            'sweep-atlas',
            index % 2 === 0 ? 'leafYellow' : 'leafRed',
          )
          .setDisplaySize(31, 31)
          .setAngle((index * 47) % 360)
          .setDepth(3);
        this.leaves.set(cellKey(leaf), image);
      });
    }

    private createPlayer() {
      const start = cellCenter(state.player);
      this.player = this.add
        .image(start.x, start.y, 'sweep-atlas', 'player')
        .setDisplaySize(58, 58)
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
            .setDisplaySize(42, 42)
            .setTint(0x776f61)
            .setAlpha(0.25)
            .setAngle(((cell.x * 11 + cell.y * 7) % 15) - 7)
            .setDepth(1);
          this.visitedMarks.set(key, mark);
        }
      }
    }

    private collectLeafAtPlayer() {
      if (!state.collectedLeaves.some((leaf) => sameCell(leaf, state.player)))
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
        this.move(direction);
      };
      keyboard.on('keydown', onKeyDown);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        keyboard.off('keydown', onKeyDown);
      });
    }
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: args.root,
    width: SWEEP_BOARD.width,
    height: SWEEP_BOARD.height,
    backgroundColor: '#292524',
    transparent: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: SWEEP_BOARD.width,
      height: SWEEP_BOARD.height,
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
