import { describe, expect, it, vi } from 'vitest';
import {
  fetchLatestBuildId,
  isDynamicImportError,
  isNewBuildAvailable,
  parseAppVersionManifest,
  recoverFromPreloadError,
} from './appVersion';

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('app version manifest', () => {
  it('accepts a non-empty build id', () => {
    expect(parseAppVersionManifest({ buildId: 'build-b' })).toEqual({
      buildId: 'build-b',
    });
  });

  it('rejects malformed manifests', () => {
    expect(parseAppVersionManifest(null)).toBeNull();
    expect(parseAppVersionManifest({})).toBeNull();
    expect(parseAppVersionManifest({ buildId: '  ' })).toBeNull();
  });

  it('fetches the latest build without using the browser cache', async () => {
    const request = vi.fn(async () => Response.json({ buildId: 'build-b' }));

    await expect(fetchLatestBuildId(request)).resolves.toBe('build-b');
    expect(request).toHaveBeenCalledWith('/version.json', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  });

  it('silently ignores failed and malformed version responses', async () => {
    const failedRequest = vi.fn(
      async () => new Response(null, { status: 503 }),
    );
    const malformedRequest = vi.fn(async () => Response.json({ version: 1 }));

    await expect(fetchLatestBuildId(failedRequest)).resolves.toBeNull();
    await expect(fetchLatestBuildId(malformedRequest)).resolves.toBeNull();
  });

  it('only reports a different non-empty build as available', () => {
    expect(isNewBuildAvailable('build-b', 'build-a')).toBe(true);
    expect(isNewBuildAvailable('build-a', 'build-a')).toBe(false);
    expect(isNewBuildAvailable(null, 'build-a')).toBe(false);
  });
});

describe('preload error recovery', () => {
  it('reloads once for the current build', () => {
    const storage = createStorage();
    const preventDefault = vi.fn();
    const reload = vi.fn();

    expect(
      recoverFromPreloadError(
        { preventDefault },
        { buildId: 'build-a', storage, reload },
      ),
    ).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();

    expect(
      recoverFromPreloadError(
        { preventDefault },
        { buildId: 'build-a', storage, reload },
      ),
    ).toBe(false);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('allows a later build to recover once again', () => {
    const storage = createStorage();
    const preventDefault = vi.fn();
    const reload = vi.fn();

    recoverFromPreloadError(
      { preventDefault },
      { buildId: 'build-a', storage, reload },
    );
    recoverFromPreloadError(
      { preventDefault },
      { buildId: 'build-b', storage, reload },
    );

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('falls back to the error boundary when session storage is unavailable', () => {
    const preventDefault = vi.fn();
    const reload = vi.fn();

    expect(
      recoverFromPreloadError(
        { preventDefault },
        {
          buildId: 'build-a',
          storage: {
            getItem: () => {
              throw new Error('storage blocked');
            },
            setItem: vi.fn(),
          },
          reload,
        },
      ),
    ).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('dynamic import errors', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/route-old.js',
    'ChunkLoadError: Loading chunk 42 failed',
    'Importing a module script failed',
    'Unable to preload CSS for /assets/route-old.css',
  ])('recognizes %s', (message) => {
    expect(isDynamicImportError(new Error(message))).toBe(true);
  });

  it('does not classify unrelated route errors as version drift', () => {
    expect(isDynamicImportError(new Error('Permission denied'))).toBe(false);
  });
});
