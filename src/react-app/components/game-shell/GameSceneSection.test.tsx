import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameSceneSection } from './GameSceneSection';

describe('GameSceneSection', () => {
  it('renders body-scale title styling without font-heading', () => {
    const html = renderToStaticMarkup(
      <GameSceneSection title="当前火候">
        <p>只保留与眼前操作相关的内容。</p>
      </GameSceneSection>,
    );

    expect(html).toContain('当前火候');
    expect(html).toContain('font-sans');
    expect(html).not.toContain('font-heading');
  });
});
