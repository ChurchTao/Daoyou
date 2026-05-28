import { APP_SETTING_KEYS } from '@shared/lib/constants/appSettings';
import { Hono } from 'hono';

const { getAuthPageAnnouncementMock, upsertAppSettingMock } = vi.hoisted(
  () => ({
    getAuthPageAnnouncementMock: vi.fn(),
    upsertAppSettingMock: vi.fn(),
  }),
);

vi.mock('@server/lib/hono/middleware', () => ({
  requireAdmin: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', {
      id: 'admin-user-1',
      email: 'admin@example.com',
    });
    await next();
  },
}));

vi.mock('@server/lib/repositories/appSettingsRepository', () => ({
  getAuthPageAnnouncement: getAuthPageAnnouncementMock,
  upsertAppSetting: upsertAppSettingMock,
}));

import announcementRouter from './announcement.router';

function createApp() {
  return new Hono().route('/api/admin/announcement', announcementRouter);
}

describe('admin announcement router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the stored announcement text', async () => {
    getAuthPageAnnouncementMock.mockResolvedValueOnce(
      '今晚 23:00 维护，请提前下线。',
    );

    const response = await createApp().request('/api/admin/announcement');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      announcement: '今晚 23:00 维护，请提前下线。',
    });
  });

  it('trims and persists the announcement text', async () => {
    const response = await createApp().request('/api/admin/announcement', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcement: '  今晚 23:00 维护，请提前下线。  ',
      }),
    });

    expect(response.status).toBe(200);
    expect(upsertAppSettingMock).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.authPageAnnouncement,
      value: '今晚 23:00 维护，请提前下线。',
      updatedBy: 'admin-user-1',
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      announcement: '今晚 23:00 维护，请提前下线。',
    });
  });

  it('persists an empty string so the auth banner can be hidden', async () => {
    const response = await createApp().request('/api/admin/announcement', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcement: '   ',
      }),
    });

    expect(response.status).toBe(200);
    expect(upsertAppSettingMock).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.authPageAnnouncement,
      value: '',
      updatedBy: 'admin-user-1',
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      announcement: '',
    });
  });

  it('rejects invalid announcement payloads', async () => {
    const response = await createApp().request('/api/admin/announcement', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcement: 123,
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe('参数错误');
  });
});
