let ownsFullscreen = false;
let ownsOrientationLock = false;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

export type ActivityFullscreenResult =
  | 'active'
  | 'standalone'
  | 'unsupported'
  | 'rejected'
  | 'skipped';

export type ActivityOrientationResult =
  | 'landscape'
  | 'locked'
  | 'unsupported'
  | 'rejected'
  | 'not-needed';

export interface ActivityImmersiveResult {
  fullscreen: ActivityFullscreenResult;
  orientation: ActivityOrientationResult;
}

export interface ActivityImmersiveNavigationState {
  activityImmersiveResult: ActivityImmersiveResult;
}

export interface ActivityViewportState {
  coarsePointer: boolean;
  landscape: boolean;
  fullscreenActive: boolean;
  fullscreenSupported: boolean;
  standalone: boolean;
}

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

export function isActivityStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((navigator as StandaloneNavigator).standalone)
  );
}

export function shouldBlockActivityForPortrait(input: {
  coarsePointer: boolean;
  landscape: boolean;
}): boolean {
  return input.coarsePointer && !input.landscape;
}

export function readActivityViewportState(): ActivityViewportState {
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    landscape: window.matchMedia('(orientation: landscape)').matches,
    fullscreenActive: Boolean(document.fullscreenElement),
    fullscreenSupported:
      document.fullscreenEnabled !== false &&
      typeof document.documentElement.requestFullscreen === 'function',
    standalone: isActivityStandalone(),
  };
}

async function requestLandscape(
  current: ActivityViewportState,
): Promise<ActivityOrientationResult> {
  if (current.landscape) return 'landscape';

  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation?.lock) return 'unsupported';

  try {
    await orientation.lock('landscape');
    ownsOrientationLock = true;
    return 'locked';
  } catch {
    ownsOrientationLock = false;
    return 'rejected';
  }
}

export async function requestActivityImmersiveMode(): Promise<ActivityImmersiveResult> {
  const initial = readActivityViewportState();
  if (!initial.coarsePointer) {
    return { fullscreen: 'skipped', orientation: 'not-needed' };
  }

  let fullscreen: ActivityFullscreenResult;
  if (initial.standalone) {
    fullscreen = 'standalone';
  } else if (initial.fullscreenActive) {
    fullscreen = 'active';
  } else if (!initial.fullscreenSupported) {
    fullscreen = 'unsupported';
  } else {
    try {
      await document.documentElement.requestFullscreen();
      ownsFullscreen = true;
      fullscreen = 'active';
    } catch {
      ownsFullscreen = false;
      fullscreen = 'rejected';
    }
  }

  const orientation = await requestLandscape(readActivityViewportState());
  return { fullscreen, orientation };
}

export async function releaseActivityImmersiveMode(): Promise<void> {
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

export function isActivityImmersiveResult(
  value: unknown,
): value is ActivityImmersiveResult {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ActivityImmersiveResult>;
  return (
    [
      'active',
      'standalone',
      'unsupported',
      'rejected',
      'skipped',
    ] satisfies ActivityFullscreenResult[]
  ).includes(candidate.fullscreen as ActivityFullscreenResult) &&
    (
      [
        'landscape',
        'locked',
        'unsupported',
        'rejected',
        'not-needed',
      ] satisfies ActivityOrientationResult[]
    ).includes(candidate.orientation as ActivityOrientationResult)
    ? true
    : false;
}

export function createActivityImmersiveNavigationState(
  result: ActivityImmersiveResult,
): ActivityImmersiveNavigationState {
  return { activityImmersiveResult: result };
}

export function readActivityImmersiveNavigationState(
  value: unknown,
): ActivityImmersiveResult | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result = (value as Partial<ActivityImmersiveNavigationState>)
    .activityImmersiveResult;
  return isActivityImmersiveResult(result) ? result : undefined;
}
