import {
  APP_TITLE,
  formatDocumentTitle,
  resolveGameScene,
  resolveRouteTitle,
} from './routeTitle';
import { describe, expect, it } from 'vitest';

describe('route title helpers', () => {
  it('formats a regular page title with the app suffix', () => {
    expect(formatDocumentTitle('天骄榜')).toBe('天骄榜 | 万界道友');
  });

  it('falls back to the app title when the route title is empty', () => {
    expect(formatDocumentTitle('')).toBe(APP_TITLE);
    expect(formatDocumentTitle(APP_TITLE)).toBe(APP_TITLE);
  });

  it('resolves the deepest static title from route matches', () => {
    const title = resolveRouteTitle(
      [
        { params: {}, handle: { title: '万界司天台' } },
        { params: {}, handle: { title: '总览' } },
      ] as never,
      { pathname: '/admin', search: '' },
    );

    expect(title).toBe('总览');
  });

  it('falls back to the app title when no route title is present', () => {
    const title = resolveRouteTitle(
      [{ params: {}, handle: undefined }] as never,
      { pathname: '/missing', search: '' },
    );

    expect(title).toBe(APP_TITLE);
  });

  it('resolves query-sensitive titles such as the map intent', () => {
    const title = resolveRouteTitle(
      [
        {
          params: {},
          handle: {
            title: ({ searchParams }: { searchParams: URLSearchParams }) =>
              searchParams.get('intent') === 'market'
                ? '修仙界地图 · 坊市选址'
                : '修仙界地图 · 历练选址',
          },
        },
      ] as never,
      { pathname: '/game/map', search: '?intent=market' },
    );

    expect(title).toBe('修仙界地图 · 坊市选址');
  });

  it('uses the route handle title for 404 pages', () => {
    const title = resolveRouteTitle(
      [{ params: {}, handle: { title: '缘分未至' } }] as never,
      { pathname: '/missing', search: '' },
    );

    expect(title).toBe('缘分未至');
  });

  it('resolves the deepest game scene handle from route matches', () => {
    const scene = resolveGameScene(
      [
        {
          params: {},
          handle: {
            gameScene: {
              id: 'cave',
              label: '洞府',
              group: 'cultivation',
              chrome: 'standard',
              dock: 'core',
            },
          },
        },
        {
          params: {},
          handle: {
            gameScene: {
              id: 'retreat',
              label: '洞府修行',
              group: 'cultivation',
              chrome: 'standard',
              dock: 'core',
            },
          },
        },
      ] as never,
    );

    expect(scene?.id).toBe('retreat');
    expect(scene?.label).toBe('洞府修行');
  });

  it('preserves representative standard scene metadata for migrated routes', () => {
    const scene = resolveGameScene(
      [
        {
          params: {},
          handle: {
            gameScene: {
              id: 'cave',
              label: '洞府',
              group: 'cultivation',
              chrome: 'standard',
              dock: 'core',
            },
          },
        },
        {
          params: {},
          handle: {
            gameScene: {
              id: 'rankings',
              label: '天骄榜',
              group: 'travel',
              chrome: 'standard',
              dock: 'core',
            },
          },
        },
      ] as never,
    );

    expect(scene).toMatchObject({
      id: 'rankings',
      group: 'travel',
      chrome: 'standard',
      dock: 'core',
    });
  });

  it('preserves immersive scene metadata when a special route opts out of the standard shell', () => {
    const scene = resolveGameScene(
      [
        {
          params: {},
          handle: {
            gameScene: {
              id: 'dungeon',
              label: '云游探秘',
              group: 'travel',
              chrome: 'immersive',
              dock: 'hidden',
            },
          },
        },
      ] as never,
    );

    expect(scene).toMatchObject({
      id: 'dungeon',
      chrome: 'immersive',
      dock: 'hidden',
    });
  });

  it('preserves battle-family immersive metadata for challenge and replay routes', () => {
    const challengeScene = resolveGameScene(
      [
        {
          params: {},
          handle: {
            gameScene: {
              id: 'battle-challenge',
              label: '挑战天骄',
              group: 'travel',
              chrome: 'immersive',
              dock: 'hidden',
            },
          },
        },
      ] as never,
    );

    const replayScene = resolveGameScene(
      [
        {
          params: { id: 'battle-1' },
          handle: {
            gameScene: {
              id: 'battle-replay',
              label: '战斗回放',
              group: 'travel',
              chrome: 'immersive',
              dock: 'hidden',
            },
          },
        },
      ] as never,
    );

    expect(challengeScene).toMatchObject({
      id: 'battle-challenge',
      chrome: 'immersive',
      dock: 'hidden',
    });
    expect(replayScene).toMatchObject({
      id: 'battle-replay',
      chrome: 'immersive',
      dock: 'hidden',
    });
  });

  it('preserves immersive metadata for arena and map routes after special shells remove global dock chrome', () => {
    const mapScene = resolveGameScene(
      [
        {
          params: {},
          handle: {
            gameScene: {
              id: 'map',
              label: '修仙界地图',
              group: 'travel',
              chrome: 'immersive',
              dock: 'hidden',
            },
          },
        },
      ] as never,
    );

    const betBattleScene = resolveGameScene(
      [
        {
          params: {},
          handle: {
            gameScene: {
              id: 'bet-battle',
              label: '赌战台',
              group: 'travel',
              chrome: 'immersive',
              dock: 'hidden',
            },
          },
        },
      ] as never,
    );

    expect(mapScene).toMatchObject({
      id: 'map',
      chrome: 'immersive',
      dock: 'hidden',
    });
    expect(betBattleScene).toMatchObject({
      id: 'bet-battle',
      chrome: 'immersive',
      dock: 'hidden',
    });
  });
});
