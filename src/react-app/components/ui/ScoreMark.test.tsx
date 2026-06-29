import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScoreMark } from './ScoreMark';

describe('ScoreMark', () => {
  it('renders the shared score mark', () => {
    const html = renderToStaticMarkup(<ScoreMark score={1280} />);

    expect(html).toContain('data-score-mark');
    expect(html).toContain('评分 1280');
    expect(html).toContain('text-sm');
    expect(html).not.toContain('text-[');
  });
});
