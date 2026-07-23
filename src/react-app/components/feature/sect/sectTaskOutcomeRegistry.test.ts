import { describe, expect, it } from 'vitest';
import {
  decodeSectTaskOutcome,
  hasSectTaskOutcomeRenderer,
} from './sectTaskOutcomeRegistry';

describe('sect task outcome registry', () => {
  it('decodes registered outcomes without task id branches', () => {
    expect(hasSectTaskOutcomeRenderer('sect.outcome.sweep-session')).toBe(true);
    const decoded = decodeSectTaskOutcome({
      renderer: 'sect.outcome.sweep-session',
      data: {
        sessionId: 'session',
        seed: 'seed',
        rulesVersion: 2,
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(decoded).toMatchObject({
      ok: true,
      value: {
        renderer: 'sect.outcome.sweep-session',
        data: { sessionId: 'session', expiresAt: '2026-01-01T00:00:00.000Z' },
      },
    });
  });

  it('reports an unsupported renderer instead of crashing in a cast', () => {
    expect(
      decodeSectTaskOutcome({ renderer: 'fixture.outcome.unknown', data: {} }),
    ).toEqual({
      ok: false,
      error: '暂不支持此任务结果：fixture.outcome.unknown',
    });
  });

  it('reports malformed registered outcome data as a recoverable error', () => {
    expect(
      decodeSectTaskOutcome({
        renderer: 'sect.outcome.sweep-session',
        data: { sessionId: 'missing-required-fields' },
      }),
    ).toEqual({
      ok: false,
      error: '宗门任务结果格式无效：sect.outcome.sweep-session',
    });
    expect(
      decodeSectTaskOutcome({
        renderer: 'sect.outcome.battle',
        data: {
          battle: {},
          won: true,
          challengeTitle: '无效战局',
          rewardGranted: true,
        },
      }),
    ).toEqual({
      ok: false,
      error: '宗门任务结果格式无效：sect.outcome.battle',
    });
  });
});
