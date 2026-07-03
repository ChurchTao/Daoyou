import { Hono } from 'hono';

const { getOnlineUsersSnapshotMock } = vi.hoisted(() => ({
  getOnlineUsersSnapshotMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireAdmin: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', {
      id: 'admin-user-1',
      email: 'admin@example.com',
    });
    await next();
  },
}));

vi.mock('@server/lib/services/onlinePresenceService', () => ({
  getOnlineUsersSnapshot: getOnlineUsersSnapshotMock,
}));

import onlineUsersRouter from './online-users.router';

function createApp() {
  return new Hono().route('/api/admin/online-users', onlineUsersRouter);
}

describe('admin online users router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns online users snapshot for admins', async () => {
    getOnlineUsersSnapshotMock.mockResolvedValueOnce({
      source: 'redis',
      generatedAt: '2026-07-03T10:00:00.000Z',
      currentOnline: 12,
      todayPeakOnline: 18,
      allTimePeakOnline: 30,
      today: '2026-07-03',
    });

    const response = await createApp().request('/api/admin/online-users');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        source: 'redis',
        generatedAt: '2026-07-03T10:00:00.000Z',
        currentOnline: 12,
        todayPeakOnline: 18,
        allTimePeakOnline: 30,
        today: '2026-07-03',
      },
    });
  });
});
