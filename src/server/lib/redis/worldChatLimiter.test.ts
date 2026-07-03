const { redisSetMock, redisTtlMock } = vi.hoisted(() => ({
  redisSetMock: vi.fn(),
  redisTtlMock: vi.fn(),
}));

vi.mock('./index', () => ({
  redis: {
    set: redisSetMock,
    ttl: redisTtlMock,
  },
}));

import {
  checkAndAcquireCooldown,
  getWorldChatCooldownSeconds,
} from './worldChatLimiter';

describe('worldChatLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scales cooldown from 60 seconds to 15 seconds by major realm', () => {
    expect(getWorldChatCooldownSeconds('炼气')).toBe(60);
    expect(getWorldChatCooldownSeconds('筑基')).toBeLessThan(60);
    expect(getWorldChatCooldownSeconds('渡劫')).toBe(15);
    expect(getWorldChatCooldownSeconds('unknown')).toBe(60);
  });

  it('uses the realm-scaled cooldown as the redis lock ttl', async () => {
    redisSetMock.mockResolvedValue('OK');

    await expect(
      checkAndAcquireCooldown('cultivator-1', '渡劫'),
    ).resolves.toEqual({
      allowed: true,
      remainingSeconds: 0,
    });

    expect(redisSetMock).toHaveBeenCalledWith(
      'world_chat:cooldown:cultivator-1',
      '1',
      'EX',
      15,
      'NX',
    );
  });

  it('falls back to the realm-scaled cooldown when redis ttl is unavailable', async () => {
    redisSetMock.mockResolvedValue(null);
    redisTtlMock.mockResolvedValue(-1);

    await expect(
      checkAndAcquireCooldown('cultivator-1', '炼气'),
    ).resolves.toEqual({
      allowed: false,
      remainingSeconds: 60,
    });
  });
});
