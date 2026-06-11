import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

vi.mock('../drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

import { getExecutor } from '../drizzle/db';
import { QiInsufficientError, QiService, QiServiceError } from './QiService';

const getExecutorMock = getExecutor as unknown as Mock;

function createDbMock(selectResults: unknown[][]) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  const createSelectBuilder = () => {
    const builder = {
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      for: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(async () => selectResults.shift() ?? []),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(selectResults.shift() ?? []).then(resolve, reject),
    };
    return builder;
  };

  const tx = {
    select: vi.fn(() => createSelectBuilder()),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });
        return {
          where: vi.fn(async () => undefined),
        };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
      }),
    })),
  };

  const executor = {
    ...tx,
    transaction: vi.fn(async (callback: (innerTx: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  getExecutorMock.mockReturnValue(executor);

  return { executor, tx, updates, inserts };
}

describe('QiService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.QI_SYSTEM_ENABLED;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.QI_SYSTEM_ENABLED;
  });

  it('reports hourly restored qi without mutating', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T02:20:00+08:00'));
    const { executor, updates } = createDbMock([
      [
        {
          qi: 40,
          qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00'),
        },
      ],
    ]);

    const state = await QiService.getQiState('cultivator-1');

    expect(state).toEqual({
      current: 60,
      max: 200,
    });
    expect(executor.transaction).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('caps natural restore at QI_MAX and resets the settlement time', () => {
    const now = new Date('2026-06-06T05:00:00+08:00');

    const state = QiService.calculateNaturalQiState({
      qi: 190,
      qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00'),
      now,
    });

    expect(state).toEqual({
      qi: 200,
      qiLastRefreshedAt: now,
      restored: 10,
      shouldPersist: true,
    });
  });

  it('does not bank natural restore while qi is at or above QI_MAX', () => {
    const now = new Date('2026-06-06T05:00:00+08:00');

    const state = QiService.calculateNaturalQiState({
      qi: 260,
      qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00'),
      now,
    });

    expect(state).toEqual({
      qi: 260,
      qiLastRefreshedAt: now,
      restored: 0,
      shouldPersist: true,
    });
  });

  it('reserves qi once and writes a reserved log', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T10:00:00+08:00'));
    const { updates, inserts } = createDbMock([
      [],
      [
        {
          id: 'cultivator-1',
          qi: 200,
          qiLastRefreshedAt: new Date('2026-06-06T09:00:00+08:00'),
        },
      ],
    ]);

    const result = await QiService.reserveQi({
      cultivatorId: 'cultivator-1',
      action: 'dungeon_start',
      actionInstanceId: 'action-1',
      metadata: { mapNodeId: 'node-1' },
    });

    expect(result).toMatchObject({
      success: true,
      action: 'dungeon_start',
      actionInstanceId: 'action-1',
      qiBefore: 200,
      qiAfter: 150,
      consumed: 50,
    });
    expect(updates[0]?.values).toEqual({
      qi: 200,
      qiLastRefreshedAt: new Date('2026-06-06T10:00:00+08:00'),
    });
    expect(updates[1]?.values).toEqual({ qi: 150 });
    expect(inserts[0]?.values).toMatchObject({
      cultivatorId: 'cultivator-1',
      action: 'dungeon_start',
      actionInstanceId: 'action-1',
      status: 'reserved',
      qiCost: 50,
      qiBefore: 200,
      qiAfter: 150,
      metadata: { mapNodeId: 'node-1' },
    });
  });

  it('treats an existing reservation action id as idempotent', async () => {
    const { updates, inserts } = createDbMock([
      [
        {
          id: 'log-1',
          action: 'dungeon_start',
          actionInstanceId: 'action-1',
          status: 'reserved',
          qiCost: 50,
          qiBefore: 200,
          qiAfter: 150,
        },
      ],
    ]);

    const result = await QiService.reserveQi({
      cultivatorId: 'cultivator-1',
      action: 'dungeon_start',
      actionInstanceId: 'action-1',
    });

    expect(result.consumed).toBe(50);
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('throws QI_INSUFFICIENT before mutating when qi is too low', async () => {
    const { updates, inserts } = createDbMock([
      [],
      [
        {
          id: 'cultivator-1',
          qi: 30,
          qiLastRefreshedAt: new Date(),
        },
      ],
    ]);

    await expect(
      QiService.reserveQi({
        cultivatorId: 'cultivator-1',
        action: 'dungeon_start',
        actionInstanceId: 'action-1',
      }),
    ).rejects.toBeInstanceOf(QiInsufficientError);
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('uses settled qi in QI_INSUFFICIENT errors', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T02:00:00+08:00'));
    const { updates, inserts } = createDbMock([
      [],
      [
        {
          id: 'cultivator-1',
          qi: 30,
          qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00'),
        },
      ],
    ]);

    await expect(
      QiService.reserveQi({
        cultivatorId: 'cultivator-1',
        action: 'dungeon_start',
        actionInstanceId: 'action-1',
        cost: 80,
      }),
    ).rejects.toMatchObject({
      current: 50,
      required: 80,
    });
    expect(updates[0]?.values).toEqual({
      qi: 50,
      qiLastRefreshedAt: new Date('2026-06-06T02:00:00+08:00'),
    });
    expect(inserts).toHaveLength(0);
  });

  it('settles hourly restore before reserving qi', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T05:00:00+08:00'));
    const { updates, inserts } = createDbMock([
      [],
      [
        {
          id: 'cultivator-1',
          qi: 190,
          qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00'),
        },
      ],
    ]);

    const result = await QiService.reserveQi({
      cultivatorId: 'cultivator-1',
      action: 'dungeon_start',
      actionInstanceId: 'action-1',
    });

    expect(result).toMatchObject({
      qiBefore: 200,
      qiAfter: 150,
      consumed: 50,
    });
    expect(updates[0]?.values).toEqual({
      qi: 200,
      qiLastRefreshedAt: new Date('2026-06-06T05:00:00+08:00'),
    });
    expect(updates[1]?.values).toEqual({ qi: 150 });
    expect(inserts[0]?.values).toMatchObject({
      qiCost: 50,
      qiBefore: 200,
      qiAfter: 150,
    });
  });

  it('refunds the full reserved cost without applying the overflow cap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T10:00:00+08:00'));
    const { updates } = createDbMock([
      [
        {
          id: 'log-1',
          cultivatorId: 'cultivator-1',
          status: 'reserved',
          qiCost: 50,
          qiBefore: 200,
          qiAfter: 150,
          metadata: {},
        },
      ],
      [
        {
          id: 'cultivator-1',
          qi: 290,
          qiLastRefreshedAt: new Date('2026-06-06T09:00:00+08:00'),
        },
      ],
    ]);

    await QiService.refundReservation({
      actionInstanceId: 'action-1',
      reason: 'generation_failed',
    });

    expect(updates[0]?.values).toEqual({
      qi: 290,
      qiLastRefreshedAt: new Date('2026-06-06T10:00:00+08:00'),
    });
    expect(updates[1]?.values).toEqual({ qi: 340 });
    expect(updates[2]?.values).toMatchObject({
      status: 'refunded',
      qiGain: 50,
      qiAfter: 340,
      metadata: {
        refundReason: 'generation_failed',
      },
    });
  });

  it('caps talisman restore at the overflow max without natural overflow growth', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T05:00:00+08:00'));
    const { updates, inserts } = createDbMock([
      [],
      [{ uses: 2 }],
      [
        {
          id: 'cultivator-1',
          qi: 260,
          qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00'),
        },
      ],
    ]);

    const result = await QiService.restoreQi({
      cultivatorId: 'cultivator-1',
      amount: 100,
      source: 'talisman',
      actionInstanceId: 'restore-1',
      action: 'qi_restore_medium',
    });

    expect(result).toMatchObject({
      qiBefore: 260,
      qiAfter: 300,
      restored: 40,
      overflowMax: 300,
    });
    expect(updates[0]?.values).toEqual({
      qi: 260,
      qiLastRefreshedAt: new Date('2026-06-06T05:00:00+08:00'),
    });
    expect(updates[1]?.values).toEqual({ qi: 300 });
    expect(inserts[0]?.values).toMatchObject({
      action: 'qi_restore_medium',
      status: 'restore_committed',
      qiGain: 40,
      qiBefore: 260,
      qiAfter: 300,
      source: 'talisman',
    });
  });

  it('rejects talisman restore when the daily use limit is reached', async () => {
    const { updates, inserts } = createDbMock([
      [],
      [{ uses: 3 }],
    ]);

    await expect(
      QiService.restoreQi({
        cultivatorId: 'cultivator-1',
        amount: 50,
        source: 'talisman',
        actionInstanceId: 'restore-1',
        action: 'qi_restore_small',
      }),
    ).rejects.toBeInstanceOf(QiServiceError);
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('rejects talisman restore when qi is already at the overflow max', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T10:00:00+08:00'));
    const { updates, inserts } = createDbMock([
      [],
      [{ uses: 0 }],
      [
        {
          id: 'cultivator-1',
          qi: 300,
          qiLastRefreshedAt: new Date('2026-06-06T09:00:00+08:00'),
        },
      ],
    ]);

    await expect(
      QiService.restoreQi({
        cultivatorId: 'cultivator-1',
        amount: 50,
        source: 'talisman',
        actionInstanceId: 'restore-1',
        action: 'qi_restore_small',
      }),
    ).rejects.toBeInstanceOf(QiServiceError);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.values).toEqual({
      qi: 300,
      qiLastRefreshedAt: new Date('2026-06-06T10:00:00+08:00'),
    });
    expect(inserts).toHaveLength(0);
  });

  it('does not write a consume log or change qi when the system is disabled', async () => {
    process.env.QI_SYSTEM_ENABLED = 'false';
    const { executor, updates, inserts } = createDbMock([[{ qi: 75 }]]);

    const result = await QiService.reserveQi({
      cultivatorId: 'cultivator-1',
      action: 'dungeon_start',
      actionInstanceId: 'action-1',
    });

    expect(result).toMatchObject({
      qiBefore: 75,
      qiAfter: 75,
      consumed: 0,
    });
    expect(executor.transaction).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });
});
