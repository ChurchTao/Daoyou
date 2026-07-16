import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RootRouteErrorView } from './App';

describe('RootRouteErrorView', () => {
  it('renders a friendly recovery action without exposing a stale chunk URL', () => {
    const html = renderToStaticMarkup(
      <RootRouteErrorView
        error={
          new Error(
            'Failed to fetch dynamically imported module: /assets/route-old.js',
          )
        }
      />,
    );

    expect(html).toContain('版本已更迭');
    expect(html).toContain('刷新进入新版本');
    expect(html).not.toContain('route-old.js');
  });
});
