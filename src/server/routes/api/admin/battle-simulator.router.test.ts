import { Hono } from 'hono';

const { duelMock, monteCarloMock, requireAdminMock } = vi.hoisted(() => ({
  duelMock: vi.fn(),
  monteCarloMock: vi.fn(),
  requireAdminMock: vi.fn(
    () => async (_context: any, next: () => Promise<void>) => {
      await next();
    },
  ),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@server/lib/services/AdminBattleSimulatorService', () => {
  class AdminBattleSimulatorError extends Error {
    constructor(
      message: string,
      public readonly status = 400,
    ) {
      super(message);
    }
  }

  return {
    AdminBattleSimulatorError,
    adminBattleSimulatorService: {
      duel: duelMock,
      monteCarlo: monteCarloMock,
    },
  };
});

import battleSimulatorRouter from './battle-simulator.router';

function createApp() {
  return new Hono().route('/api/admin/battle-simulator', battleSimulatorRouter);
}

describe('admin battle simulator router', () => {
  beforeEach(() => {
    duelMock.mockClear();
    monteCarloMock.mockClear();
    duelMock.mockResolvedValue({
      winnerSide: 'A',
      turns: 3,
      logs: [],
    });
    monteCarloMock.mockResolvedValue({
      scenario: 'template_vs_template',
      sampleCount: 10,
      aWins: 5,
      bWins: 5,
    });
  });

  it('registers admin middleware on simulator routes', async () => {
    expect(requireAdminMock).toHaveBeenCalledTimes(2);
  });

  it('runs a valid duel request', async () => {
    const response = await createApp().request('/api/admin/battle-simulator/duel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerCultivatorId: '11111111-1111-4111-8111-111111111111',
        opponentCultivatorId: '22222222-2222-4222-8222-222222222222',
      }),
    });

    expect(response.status).toBe(200);
    expect(duelMock).toHaveBeenCalledWith({
      playerCultivatorId: '11111111-1111-4111-8111-111111111111',
      opponentCultivatorId: '22222222-2222-4222-8222-222222222222',
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { winnerSide: 'A' },
    });
  });

  it('rejects invalid duel bodies', async () => {
    const response = await createApp().request('/api/admin/battle-simulator/duel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerCultivatorId: 'bad',
        opponentCultivatorId: 'bad',
      }),
    });

    expect(response.status).toBe(400);
    expect(duelMock).not.toHaveBeenCalled();
  });

  it('runs a valid Monte Carlo request', async () => {
    const response = await createApp().request(
      '/api/admin/battle-simulator/monte-carlo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'fixed_vs_template',
          anchorCultivatorId: '11111111-1111-4111-8111-111111111111',
          sampleCount: 100,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(monteCarloMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: 'fixed_vs_template',
        anchorCultivatorId: '11111111-1111-4111-8111-111111111111',
        sampleCount: 100,
        sampleLogLimit: 3,
      }),
    );
  });

  it('rejects fixed Monte Carlo scenarios without an anchor', async () => {
    const response = await createApp().request(
      '/api/admin/battle-simulator/monte-carlo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'fixed_vs_template',
          sampleCount: 100,
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(monteCarloMock).not.toHaveBeenCalled();
  });

  it('rejects over-limit live sample Monte Carlo requests', async () => {
    const response = await createApp().request(
      '/api/admin/battle-simulator/monte-carlo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'live_sample_vs_live_sample',
          sampleCount: 101,
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(monteCarloMock).not.toHaveBeenCalled();
  });
});
