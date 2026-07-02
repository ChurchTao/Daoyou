import { describe, expect, it } from 'vitest';
import {
  APP_TITLE,
  formatDocumentTitle,
  resolveGameScene,
  resolveRouteTitle,
} from './routeTitle';

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
    const scene = resolveGameScene([
      {
        params: {},
        handle: {
          gameScene: {
            id: 'cave',
            label: '洞府',
            group: 'cultivation',
            chrome: 'standard',
            dock: 'core',
            presentation: 'hub',
          },
        },
      },
      {
        params: {},
        handle: {
          gameScene: {
            id: 'retreat',
            label: '修炼室',
            group: 'cultivation',
            chrome: 'standard',
            dock: 'core',
            presentation: 'workflow',
          },
        },
      },
    ] as never);

    expect(scene?.id).toBe('retreat');
    expect(scene?.label).toBe('修炼室');
  });

  it('preserves representative standard scene metadata for migrated routes', () => {
    const scene = resolveGameScene([
      {
        params: {},
        handle: {
          gameScene: {
            id: 'cave',
            label: '洞府',
            group: 'cultivation',
            chrome: 'standard',
            dock: 'core',
            presentation: 'hub',
          },
        },
      },
      {
        params: {},
        handle: {
          gameScene: {
            id: 'rankings',
            label: '天骄榜',
            group: 'combat',
            chrome: 'standard',
            dock: 'core',
            presentation: 'service',
          },
        },
      },
    ] as never);

    expect(scene).toMatchObject({
      id: 'rankings',
      group: 'combat',
      chrome: 'standard',
      dock: 'core',
      presentation: 'service',
    });
  });

  it('uses standard dock metadata for the body cultivation detail route', () => {
    const scene = resolveGameScene([
      {
        params: {},
        handle: {
          gameScene: {
            id: 'body-cultivation',
            label: '肉身炼体',
            group: 'cultivation',
            chrome: 'standard',
            dock: 'core',
            presentation: 'workflow',
          },
        },
      },
    ] as never);

    expect(scene).toMatchObject({
      id: 'body-cultivation',
      group: 'cultivation',
      chrome: 'standard',
      dock: 'core',
      presentation: 'workflow',
    });
  });

  it('uses body cultivation scene metadata for the breakthrough route', () => {
    const matches = [
      {
        params: {},
        handle: {
          title: '肉身破限',
          gameScene: {
            id: 'body-cultivation',
            label: '肉身炼体',
            group: 'cultivation',
            chrome: 'standard',
            dock: 'core',
            presentation: 'workflow',
          },
        },
      },
    ] as never;

    expect(
      resolveRouteTitle(matches, {
        pathname: '/game/body-cultivation/breakthrough',
        search: '',
      }),
    ).toBe('肉身破限');
    expect(resolveGameScene(matches)).toMatchObject({
      id: 'body-cultivation',
      group: 'cultivation',
      chrome: 'standard',
      dock: 'core',
    });
  });

  it('uses standard dock metadata for the marrow wash route', () => {
    const matches = [
      {
        params: {},
        handle: {
          title: '洗髓池',
          gameScene: {
            id: 'marrow-wash',
            label: '洗髓池',
            group: 'cultivation',
            chrome: 'standard',
            dock: 'core',
            presentation: 'workflow',
          },
        },
      },
    ] as never;

    expect(
      resolveRouteTitle(matches, {
        pathname: '/game/marrow-wash',
        search: '',
      }),
    ).toBe('洗髓池');
    expect(resolveGameScene(matches)).toMatchObject({
      id: 'marrow-wash',
      group: 'cultivation',
      chrome: 'standard',
      dock: 'core',
    });
  });

  it('preserves immersive scene metadata when a special route opts out of the standard shell', () => {
    const scene = resolveGameScene([
      {
        params: {},
        handle: {
          gameScene: {
            id: 'dungeon',
            label: '云游探秘',
            group: 'craft',
            chrome: 'immersive',
            dock: 'hidden',
            presentation: 'immersive',
          },
        },
      },
    ] as never);

    expect(scene).toMatchObject({
      id: 'dungeon',
      chrome: 'immersive',
      dock: 'hidden',
      presentation: 'immersive',
    });
  });

  it('preserves battle-family immersive metadata for challenge and replay routes', () => {
    const challengeScene = resolveGameScene([
      {
        params: {},
        handle: {
          gameScene: {
            id: 'battle-challenge',
            label: '挑战天骄',
            group: 'combat',
            chrome: 'immersive',
            dock: 'hidden',
            presentation: 'immersive',
          },
        },
      },
    ] as never);

    const replayScene = resolveGameScene([
      {
        params: { id: 'battle-1' },
        handle: {
          gameScene: {
            id: 'battle-replay',
            label: '战斗回放',
            group: 'combat',
            chrome: 'immersive',
            dock: 'hidden',
            presentation: 'immersive',
          },
        },
      },
    ] as never);

    expect(challengeScene).toMatchObject({
      id: 'battle-challenge',
      chrome: 'immersive',
      dock: 'hidden',
      presentation: 'immersive',
    });
    expect(replayScene).toMatchObject({
      id: 'battle-replay',
      chrome: 'immersive',
      dock: 'hidden',
      presentation: 'immersive',
    });
  });

  it('preserves route metadata for bet-battle hall and map after layout split', () => {
    const mapScene = resolveGameScene([
      {
        params: {},
        handle: {
          gameScene: {
            id: 'map',
            label: '修仙界地图',
            group: 'craft',
            chrome: 'immersive',
            dock: 'hidden',
            presentation: 'immersive',
          },
        },
      },
    ] as never);

    const betBattleScene = resolveGameScene([
      {
        params: {},
        handle: {
          gameScene: {
            id: 'bet-battle',
            label: '赌战台',
            group: 'combat',
            chrome: 'standard',
            dock: 'core',
            presentation: 'workflow',
          },
        },
      },
    ] as never);

    expect(mapScene).toMatchObject({
      id: 'map',
      chrome: 'immersive',
      dock: 'hidden',
      presentation: 'immersive',
    });
    expect(betBattleScene).toMatchObject({
      id: 'bet-battle',
      chrome: 'standard',
      dock: 'core',
      presentation: 'workflow',
    });
  });
});
