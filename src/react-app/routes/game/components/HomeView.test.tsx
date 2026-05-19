import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HomeView } from './HomeView';

vi.mock('@app/components/feature/cultivator/LifespanStatusCard', () => ({
  useLifespanStatus: () => ({
    status: {
      dailyLimit: 200,
      consumed: 48,
      remaining: 152,
      isInRetreat: false,
    },
    loading: false,
    error: null,
  }),
}));

vi.mock('@app/components/feature/cultivator/YieldCard', () => ({
  YieldCard: () => <div>收益提醒</div>,
}));

vi.mock('@app/components/feature/home/CaveQuickGrid', () => ({
  CaveQuickGrid: () => <div>洞府各处入口</div>,
}));

vi.mock('@app/components/feature/home/HomeAside', () => ({
  HomeAside: () => <div>侧栏</div>,
}));

vi.mock('@app/components/game-shell', () => ({
  GameSceneFrame: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  GameSceneSection: ({
    title,
    children,
  }: {
    title?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section>
      <div>{title}</div>
      <div>{children}</div>
    </section>
  ),
}));

vi.mock('@app/components/ui', () => ({
  InkButton: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href?: string;
  }) => <a href={href}>{children}</a>,
  InkNotice: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@app/lib/contexts/CultivatorContext', () => ({
  useCultivator: () => ({
    cultivator: {
      id: 'cultivator-1',
      last_yield_at: null,
      condition: undefined,
      cultivation_progress: null,
    },
    isLoading: false,
    finalAttributes: {
      maxHp: 100,
      maxMp: 100,
    },
  }),
}));

describe('HomeView', () => {
  it('always shows the daily lifespan progress in urgent matters without the old alert copy', () => {
    const html = renderToStaticMarkup(<HomeView />);

    expect(html).toContain('当下要事');
    expect(html).toContain('⏳ 每日可用寿元');
    expect(html).toContain('今日闭关与冲关共用这一份寿元');
    expect(html).toContain('余 152/200');
    expect(html).toContain('◎ 今日安稳');
    expect(html).not.toContain('⏳ 寿元偏高');
  });
});
