import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useRetreatViewModel', () => ({
  useRetreatViewModel: vi.fn(),
}));

vi.mock('@app/components/feature/cultivator/LifespanStatusCard', () => ({
  useLifespanStatus: vi.fn(),
}));

vi.mock('@app/components/game-shell', () => ({
  GameSceneFrame: ({ title, headerMeta, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{headerMeta}</div>
      <div>{children}</div>
    </div>
  ),
  GameSceneNote: ({ children }: any) => <div>{children}</div>,
  GameSceneSection: ({ title, children }: any) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
}));

vi.mock('./BreakthroughConfirmModal', () => ({
  BreakthroughConfirmModal: () => <div data-testid="breakthrough-confirm" />,
}));

vi.mock('./RetreatResultSection', () => ({
  RetreatResultSection: () => <div data-testid="retreat-result" />,
}));

import { useLifespanStatus } from '@app/components/feature/cultivator/LifespanStatusCard';
import { useRetreatViewModel } from '../hooks/useRetreatViewModel';
import { RetreatView } from './RetreatView';

const mockedUseRetreatViewModel = vi.mocked(useRetreatViewModel);
const mockedUseLifespanStatus = vi.mocked(useLifespanStatus);

function createBaseViewModel() {
  return {
    cultivator: {
      id: 'cultivator-1',
      name: '韩立',
      realm: '筑基',
      realm_stage: '中期',
    },
    isLoading: false,
    note: '石门已合，香火正稳。',
    remainingLifespan: 128,
    cultivationProgress: {
      cultivation_exp: 720,
      exp_cap: 1000,
      comprehension_insight: 46,
      percent: 72,
      canBreakthrough: true,
      breakthroughType: 'forced' as const,
    },
    breakthroughPreview: {
      baseChance: 0.62,
      finalChance: 0.785,
      buffBonus: 0.05,
      recommendation: '成功率较高，值得一试。',
    },
    currentMajorTask: null,
    isMajorBreakthrough: false,
    majorBreakthroughBlocked: false,
    tasksLoading: false,
    taskError: undefined,
    retreatYears: '12',
    handleRetreatYearsChange: vi.fn(),
    retreatLoading: false,
    retreatResult: null,
    showBreakthroughConfirm: false,
    handleRetreat: vi.fn(),
    handleBreakthroughClick: vi.fn(),
    handleBreakthrough: vi.fn(),
    closeBreakthroughConfirm: vi.fn(),
    handleGoReincarnate: vi.fn(),
  };
}

describe('RetreatView', () => {
  it('renders a focused retreat scene without the old side rail and chance panel', () => {
    mockedUseRetreatViewModel.mockReturnValue(createBaseViewModel() as any);
    mockedUseLifespanStatus.mockReturnValue({
      status: {
        consumed: 3,
        dailyLimit: 10,
        remaining: 7,
      },
    } as any);

    const html = renderToStaticMarkup(<RetreatView />);

    expect(html).toContain('闭关年限');
    expect(html).toContain('闭关修炼');
    expect(html).toContain('尝试突破');
    expect(html).toContain('当前筹算');
    expect(html).toContain('今日尚余 7 年寿元可用');
    expect(html).toContain('成功率较高，值得一试。');
    expect(html).not.toContain('静室案头');
    expect(html).not.toContain('寿元账');
    expect(html).not.toContain('冲关火候');
    expect(html).not.toContain('当前成功率推演');
    expect(html).not.toContain('78.5%');
  });

  it('shows only a compact blocking summary when a major breakthrough is not ready', () => {
    mockedUseRetreatViewModel.mockReturnValue({
      ...createBaseViewModel(),
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        realm: '金丹',
        realm_stage: '圆满',
      },
      breakthroughPreview: null,
      currentMajorTask: {
        id: 'task-major',
        status: 'active',
        snapshot: {
          title: '结婴前置',
          summary: '丹田、识海与护持机缘都得先理顺，才好谈这一关。',
          fromRealm: '金丹圆满',
          toRealm: '元婴初期',
          missingRequirements: ['丹田稳固', '识海澄明', '再寻护道人'],
        },
      },
      isMajorBreakthrough: true,
      majorBreakthroughBlocked: true,
      tasksLoading: false,
    } as any);
    mockedUseLifespanStatus.mockReturnValue({
      status: {
        consumed: 4,
        dailyLimit: 12,
        remaining: 8,
      },
    } as any);

    const html = renderToStaticMarkup(<RetreatView />);

    expect(html).toContain('结婴前置');
    expect(html).toContain('丹田稳固');
    expect(html).toContain('识海澄明');
    expect(html).toContain('其余细项已归回卷宗');
    expect(html).not.toContain('再寻护道人');
    expect(html).not.toContain('尝试突破');
    expect(html).not.toContain('返回静室');
    expect(html).not.toContain('仍在筹备');
  });
});
