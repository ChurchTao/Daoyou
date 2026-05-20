import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChallengeDirectEntryCard } from './route';

describe('ChallengeDirectEntryCard', () => {
  it('renders the direct entry success branch without battle playback content', () => {
    const html = renderToStaticMarkup(
      <ChallengeDirectEntryCard rank={7} onBack={() => {}} />,
    );

    expect(html).toContain('成功上榜！');
    expect(html).toContain('万界金榜第 7 名');
    expect(html).not.toContain('战斗日志');
    expect(html).not.toContain('我的状态');
  });
});
