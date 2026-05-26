import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeUrgentRow } from './HomeUrgentRow';

describe('HomeUrgentRow', () => {
  it('uses a stable title-summary grid so wrapped copy stays aligned', () => {
    const html = renderToStaticMarkup(
      <HomeUrgentRow
        title={<span>🗺️ 外出历练</span>}
        summary="已历练 24/24 小时，当前文案允许换行后继续与标题列对齐。"
        action={<span>[领取]</span>}
      />,
    );

    expect(html).toContain('sm:grid-cols-[minmax(0,1fr)_auto]');
    expect(html).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(html).toContain('justify-self-end');
  });
});
