import { APP_TITLE, formatDocumentTitle, resolveRouteTitle } from './routeTitle';
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
});
