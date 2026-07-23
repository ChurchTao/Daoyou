let ownsFullscreen = false;
let ownsOrientationLock = false;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

export function shouldBlockSweepForPortrait(input: {
  coarsePointer: boolean;
  landscape: boolean;
}): boolean {
  return input.coarsePointer && !input.landscape;
}

export function readSweepViewportState() {
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    landscape: window.matchMedia('(orientation: landscape)').matches,
  };
}

export async function requestSweepImmersiveMode(): Promise<void> {
  if (!readSweepViewportState().coarsePointer) return;
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
      ownsFullscreen = true;
    } catch {
      ownsFullscreen = false;
    }
  }
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (orientation?.lock) {
    try {
      await orientation.lock('landscape');
      ownsOrientationLock = true;
    } catch {
      ownsOrientationLock = false;
    }
  }
}

export async function releaseSweepImmersiveMode(): Promise<void> {
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (ownsOrientationLock) {
    orientation?.unlock();
    ownsOrientationLock = false;
  }
  if (ownsFullscreen && document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // The browser may already be leaving fullscreen as the route unmounts.
    }
  }
  ownsFullscreen = false;
}
