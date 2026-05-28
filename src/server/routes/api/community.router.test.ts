import { Hono } from 'hono';

const { getAuthPageAnnouncementMock, getResolvedCommunityQqGroupNumberMock } =
  vi.hoisted(() => ({
    getAuthPageAnnouncementMock: vi.fn(),
    getResolvedCommunityQqGroupNumberMock: vi.fn(),
  }));

vi.mock('@server/lib/repositories/appSettingsRepository', () => ({
  getAuthPageAnnouncement: getAuthPageAnnouncementMock,
  getResolvedCommunityQqGroupNumber: getResolvedCommunityQqGroupNumberMock,
}));

import communityRouter from './community.router';

function createApp() {
  return new Hono().route('/api/community', communityRouter);
}

describe('community router announcement route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current auth announcement payload', async () => {
    getAuthPageAnnouncementMock.mockResolvedValueOnce(
      '今晚 23:00 维护，请提前下线。',
    );

    const response = await createApp().request('/api/community/announcement');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      announcement: '今晚 23:00 维护，请提前下线。',
    });
  });

  it('returns null when the auth announcement is currently hidden', async () => {
    getAuthPageAnnouncementMock.mockResolvedValueOnce(null);

    const response = await createApp().request('/api/community/announcement');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      announcement: null,
    });
  });

  it('returns 503 when the auth announcement cannot be loaded', async () => {
    getAuthPageAnnouncementMock.mockRejectedValueOnce(new Error('db down'));

    const response = await createApp().request('/api/community/announcement');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: '公告配置暂不可用，请稍后重试',
    });
  });
});
