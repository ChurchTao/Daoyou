export interface AppVersionManifest {
  buildId: string;
}

export interface PreloadRecoveryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface PreloadRecoveryEvent {
  preventDefault: () => void;
}

export interface PreloadRecoveryDependencies {
  buildId: string;
  storage: PreloadRecoveryStorage;
  reload: () => void;
}

const PRELOAD_RECOVERY_BUILD_KEY = 'daoyou:preload-recovery-build';
const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk .+ failed/i,
  /unable to preload css/i,
];

export const CURRENT_BUILD_ID =
  typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'test';

export function parseAppVersionManifest(
  value: unknown,
): AppVersionManifest | null {
  if (!value || typeof value !== 'object' || !('buildId' in value)) {
    return null;
  }

  const buildId = value.buildId;
  if (typeof buildId !== 'string' || buildId.trim().length === 0) {
    return null;
  }

  return { buildId };
}

export async function fetchLatestBuildId(
  request: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await request('/version.json', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const manifest = parseAppVersionManifest(await response.json());
    return manifest?.buildId ?? null;
  } catch {
    return null;
  }
}

export function isNewBuildAvailable(
  latestBuildId: string | null,
  currentBuildId = CURRENT_BUILD_ID,
): latestBuildId is string {
  return latestBuildId !== null && latestBuildId !== currentBuildId;
}

export function isDynamicImportError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function reloadIntoLatestVersion() {
  window.location.reload();
}

export function recoverFromPreloadError(
  event: PreloadRecoveryEvent,
  dependencies: PreloadRecoveryDependencies,
): boolean {
  const { buildId, storage, reload } = dependencies;

  try {
    if (storage.getItem(PRELOAD_RECOVERY_BUILD_KEY) === buildId) {
      return false;
    }

    storage.setItem(PRELOAD_RECOVERY_BUILD_KEY, buildId);
  } catch {
    return false;
  }

  event.preventDefault();
  reload();
  return true;
}

export function registerPreloadErrorRecovery() {
  window.addEventListener('vite:preloadError', (event) => {
    try {
      recoverFromPreloadError(event, {
        buildId: CURRENT_BUILD_ID,
        storage: window.sessionStorage,
        reload: reloadIntoLatestVersion,
      });
    } catch {
      // Let the route error boundary handle the failure when storage is blocked.
    }
  });
}
