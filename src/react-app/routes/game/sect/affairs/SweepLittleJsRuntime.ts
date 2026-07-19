import {
  Color,
  Sound,
  engineInit,
  keyIsDown,
  mainCanvas,
  mainContext,
  setCanvasClearColor,
  setCanvasFixedSize,
  setCanvasMaxAspect,
  setCanvasMinAspect,
  setPaused,
  vec2,
} from 'littlejsengine';
import {
  appendSweepInput,
  createSweepGameState,
  stepSweepGame,
  SWEEP_BOARD,
  SWEEP_LEAF_COUNT,
  SWEEP_MAX_TICKS,
  SWEEP_OBSTACLES,
  type SweepGameState,
  type SweepInputSegment,
} from '@shared/engine/sect';

interface RuntimeSession {
  state: SweepGameState;
  trace: SweepInputSegment[];
  onState: (state: SweepGameState) => void;
  onSuccess: (trace: SweepInputSegment[]) => void;
  virtualDirection: number | null;
  virtualSweep: boolean;
  frameCounter: number;
  completed: boolean;
}

let background: HTMLImageElement | null = null;
let sprites: HTMLImageElement | null = null;
let active: RuntimeSession | null = null;
let initialized: Promise<void> | null = null;
let sweepSound: Sound | null = null;

function keyboardDirection(): number | null {
  const up = keyIsDown('KeyW') || keyIsDown('ArrowUp');
  const right = keyIsDown('KeyD') || keyIsDown('ArrowRight');
  const down = keyIsDown('KeyS') || keyIsDown('ArrowDown');
  const left = keyIsDown('KeyA') || keyIsDown('ArrowLeft');
  if (up && right) return 1;
  if (right && down) return 3;
  if (down && left) return 5;
  if (left && up) return 7;
  if (up) return 0;
  if (right) return 2;
  if (down) return 4;
  if (left) return 6;
  return null;
}

function update() {
  if (!active || active.completed) return;
  active.frameCounter = (active.frameCounter + 1) % 3;
  if (active.frameCounter !== 0) return;
  const direction = active.virtualDirection ?? keyboardDirection();
  const sweeping = active.virtualSweep || keyIsDown('Space');
  appendSweepInput(active.trace, { direction, sweeping });
  const previousCleared = active.state.cleared;
  active.state = stepSweepGame(active.state, { direction, sweeping });
  if (active.state.cleared > previousCleared) {
    sweepSound ??= new Sound([0.18, 0, 320, 0.01, 0.04, 0.08, 1, 1.7]);
    sweepSound.play(undefined, 0.35);
  }
  active.onState(active.state);
  if (active.state.cleared === SWEEP_LEAF_COUNT) {
    active.completed = true;
    active.onSuccess(active.trace.map((segment) => ({ ...segment })));
  }
}

function drawSprite(
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
) {
  if (!sprites?.complete) return;
  const sourceWidth = sprites.naturalWidth / 4;
  mainContext.save();
  mainContext.translate(x, y);
  mainContext.rotate(rotation);
  mainContext.drawImage(
    sprites,
    sourceWidth * index,
    0,
    sourceWidth,
    sprites.naturalHeight,
    -width / 2,
    -height / 2,
    width,
    height,
  );
  mainContext.restore();
}

function render() {
  mainContext.clearRect(0, 0, SWEEP_BOARD.width, SWEEP_BOARD.height);
  if (background?.complete)
    mainContext.drawImage(background, 0, 0, SWEEP_BOARD.width, SWEEP_BOARD.height);
  else {
    mainContext.fillStyle = '#e8e1cd';
    mainContext.fillRect(0, 0, SWEEP_BOARD.width, SWEEP_BOARD.height);
  }
  if (!active) return;
  for (const obstacle of SWEEP_OBSTACLES) {
    mainContext.fillStyle = 'rgba(35,45,42,.12)';
    mainContext.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  }
  active.state.leaves.forEach((leaf, index) => {
    if (!leaf.cleared)
      drawSprite(index % 2 === 0 ? 2 : 3, leaf.x, leaf.y, 34, 34, index * 0.7);
  });
  if (active.state.cooldown === 8) {
    const angle = active.state.facing * (Math.PI / 4) - Math.PI / 2;
    mainContext.save();
    mainContext.translate(active.state.player.x, active.state.player.y);
    mainContext.rotate(angle);
    mainContext.beginPath();
    mainContext.moveTo(0, 0);
    mainContext.arc(0, 0, 115, -0.95, 0.95);
    mainContext.closePath();
    mainContext.fillStyle = 'rgba(160,98,38,.18)';
    mainContext.fill();
    mainContext.restore();
  }
  drawSprite(
    0,
    active.state.player.x,
    active.state.player.y,
    74,
    92,
    active.state.facing * (Math.PI / 4),
  );
}

async function ensureEngine(root: HTMLElement) {
  if (!background) {
    background = new Image();
    background.src = '/assets/sect/sweep/cloud-stair-courtyard.webp';
  }
  if (!sprites) {
    sprites = new Image();
    sprites.src = '/assets/sect/sweep/sprites.webp';
  }
  if (!initialized) {
    initialized = engineInit(
      () => {
        setCanvasFixedSize(vec2(SWEEP_BOARD.width, SWEEP_BOARD.height));
        setCanvasMinAspect(SWEEP_BOARD.width / SWEEP_BOARD.height);
        setCanvasMaxAspect(SWEEP_BOARD.width / SWEEP_BOARD.height);
        setCanvasClearColor(new Color(0, 0, 0, 0));
      },
      update,
      () => undefined,
      render,
      () => undefined,
      [],
      root,
    );
    await initialized;
  } else {
    await initialized;
    root.appendChild(mainCanvas);
  }
  mainCanvas.className = 'h-full w-full object-contain';
  mainCanvas.style.position = 'relative';
  mainCanvas.style.inset = 'auto';
  setPaused(false);
}

export async function attachSweepLittleJs(args: {
  root: HTMLElement;
  seed: string;
  onState: (state: SweepGameState) => void;
  onSuccess: (trace: SweepInputSegment[]) => void;
}) {
  await ensureEngine(args.root);
  active = {
    state: createSweepGameState(args.seed),
    trace: [],
    onState: args.onState,
    onSuccess: args.onSuccess,
    virtualDirection: null,
    virtualSweep: false,
    frameCounter: 0,
    completed: false,
  };
  args.onState(active.state);
  return () => {
    if (mainCanvas.parentElement === args.root) mainCanvas.remove();
    active = null;
    setPaused(true);
  };
}

export function setSweepVirtualInput(direction: number | null, sweeping: boolean) {
  if (!active) return;
  active.virtualDirection = direction;
  active.virtualSweep = sweeping;
}

export function sweepRuntimeTimedOut(): boolean {
  return Boolean(active && active.state.tick >= SWEEP_MAX_TICKS);
}
