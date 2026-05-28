import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useRouteLoaderData: vi.fn(),
  };
});

import { useRouteLoaderData } from 'react-router';
import { AuthPageShell } from './AuthPageShell';

const mockedUseRouteLoaderData = vi.mocked(useRouteLoaderData);

describe('AuthPageShell announcement banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the announcement banner when auth loader data provides content', () => {
    mockedUseRouteLoaderData.mockReturnValue({
      announcement: '今晚 23:00 维护，请提前下线。',
    } as any);

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthPageShell title="【登录】" lead="选择一种登录方式。">
          <div>表单内容</div>
        </AuthPageShell>
      </MemoryRouter>,
    );

    expect(html).toContain('公告');
    expect(html).toContain('今晚 23:00 维护，请提前下线。');
    expect(html).toContain('auth-announcement-track');
  });

  it('renders no announcement banner when the auth loader data is empty', () => {
    mockedUseRouteLoaderData.mockReturnValue({
      announcement: null,
    } as any);

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthPageShell title="【注册】" lead="选择一种注册方式。">
          <div>表单内容</div>
        </AuthPageShell>
      </MemoryRouter>,
    );

    expect(html).not.toContain('auth-announcement-track');
  });
});
