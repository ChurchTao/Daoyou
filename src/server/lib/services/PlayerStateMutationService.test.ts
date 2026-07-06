import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  lockCultivatorForStateMutation: vi.fn(),
  getOrCreateStateVersion: vi.fn(),
  bumpStateVersions: vi.fn(),
  insertStateEvents: vi.fn(),
  publishPlayerStateEvents: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  db: () => ({
    transaction: mocks.transaction,
  }),
}));

vi.mock('@server/lib/repositories/playerStateRepository', () => ({
  lockCultivatorForStateMutation: mocks.lockCultivatorForStateMutation,
  getOrCreateStateVersion: mocks.getOrCreateStateVersion,
  bumpStateVersions: mocks.bumpStateVersions,
  insertStateEvents: mocks.insertStateEvents,
}));

vi.mock('@server/lib/services/playerStateBroadcaster', () => ({
  publishPlayerStateEvents: mocks.publishPlayerStateEvents,
}));

import { commitPlayerStateMutation } from './PlayerStateMutationService';

function createDomainVersions(overrides: Record<string, number> = {}) {
  return {
    profile: 0,
    condition: 0,
    progress: 0,
    currency: 0,
    loadout: 0,
    mail: 0,
    tasks: 0,
    ...overrides,
  };
}

describe('commitPlayerStateMutation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback({}));
    mocks.lockCultivatorForStateMutation.mockResolvedValue(undefined);
    mocks.getOrCreateStateVersion.mockResolvedValue({
      globalVersion: 4,
      domainVersions: createDomainVersions({ mail: 2 }),
    });
    mocks.bumpStateVersions.mockResolvedValue({
      globalVersion: 5,
      domainVersions: createDomainVersions({ mail: 3 }),
    });
    mocks.insertStateEvents.mockResolvedValue([
      {
        id: 10,
        cultivatorId: 'cultivator-1',
        globalVersion: 5,
        domainVersion: 3,
        domain: 'mail',
        eventType: 'mail.read',
        patch: { unreadMailCount: 0 },
        invalidates: ['mail'],
        source: 'mail_read',
        createdAt: '2026-07-06T00:00:00.000Z',
      },
    ]);
  });

  it('locks the cultivator before business writes, version bump, and event insert', async () => {
    const callOrder: string[] = [];
    const tx = { id: 'tx' };
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
    mocks.lockCultivatorForStateMutation.mockImplementationOnce(async () => {
      callOrder.push('lock');
    });
    mocks.bumpStateVersions.mockImplementationOnce(async () => {
      callOrder.push('bump');
      return {
        globalVersion: 5,
        domainVersions: createDomainVersions({ mail: 3 }),
      };
    });
    mocks.insertStateEvents.mockImplementationOnce(async () => {
      callOrder.push('insert');
      return [
        {
          id: 10,
          cultivatorId: 'cultivator-1',
          globalVersion: 5,
          domainVersion: 3,
          domain: 'mail',
          eventType: 'mail.read',
          patch: { unreadMailCount: 0 },
          invalidates: ['mail'],
          source: 'mail_read',
          createdAt: '2026-07-06T00:00:00.000Z',
        },
      ];
    });

    const committed = await commitPlayerStateMutation({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      source: 'mail_read',
      run: async (receivedTx) => {
        expect(receivedTx).toBe(tx);
        callOrder.push('run');
        return {
          result: { ok: true },
          changes: [
            {
              domain: 'mail',
              eventType: 'mail.read',
              patch: { unreadMailCount: 0 },
              invalidates: ['mail'],
            },
          ],
        };
      },
    });

    expect(callOrder).toEqual(['lock', 'run', 'bump', 'insert']);
    expect(mocks.lockCultivatorForStateMutation).toHaveBeenCalledWith(
      tx,
      'cultivator-1',
    );
    expect(committed.state.globalVersion).toBe(5);
    expect(committed.state.domainVersions).toEqual({ mail: 3 });
    expect(mocks.publishPlayerStateEvents).toHaveBeenCalledTimes(1);
  });

  it('locks before returning an allowEmpty mutation without events', async () => {
    const callOrder: string[] = [];
    mocks.lockCultivatorForStateMutation.mockImplementationOnce(async () => {
      callOrder.push('lock');
    });
    mocks.getOrCreateStateVersion.mockImplementationOnce(async () => {
      callOrder.push('version');
      return {
        globalVersion: 4,
        domainVersions: createDomainVersions({ mail: 2 }),
      };
    });

    const committed = await commitPlayerStateMutation({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      source: 'noop',
      allowEmpty: true,
      run: async () => {
        callOrder.push('run');
        return { result: null, changes: [] };
      },
    });

    expect(callOrder).toEqual(['lock', 'run', 'version']);
    expect(committed.state).toEqual({
      cultivatorId: 'cultivator-1',
      globalVersion: 4,
      domainVersions: {},
      events: [],
    });
    expect(mocks.publishPlayerStateEvents).not.toHaveBeenCalled();
  });

  it('retries a deadlocked transaction and publishes only after success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const deadlock = Object.assign(new Error('deadlock detected'), {
      code: '40P01',
    });
    mocks.transaction
      .mockRejectedValueOnce(deadlock)
      .mockImplementationOnce(async (callback) => callback({}));

    const committed = await commitPlayerStateMutation({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      source: 'mail_read',
      run: async () => ({
        result: { ok: true },
        changes: [
          {
            domain: 'mail',
            eventType: 'mail.read',
            patch: { unreadMailCount: 0 },
          },
        ],
      }),
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(committed.state.events).toHaveLength(1);
    expect(mocks.publishPlayerStateEvents).toHaveBeenCalledTimes(1);
  });

  it('does not retry business errors', async () => {
    const businessError = new Error('业务校验失败');
    await expect(
      commitPlayerStateMutation({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        source: 'business',
        run: async () => {
          throw businessError;
        },
      }),
    ).rejects.toThrow(businessError);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.publishPlayerStateEvents).not.toHaveBeenCalled();
  });
});
