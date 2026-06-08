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
import { QiInsufficientError, QiService } from './QiService';

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

  it('reports QI_MAX across a Shanghai natural day without mutating', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T01:00:00+08:00'));
    const { executor, updates } = createDbMock([
      [
        {
          qi: 40,
          qiLastRefreshedAt: new Date('2026-06-05T23:00:00+08:00'),
        },
      ],
    ]);

    const state = await QiService.getQiState('cultivator-1');

    expect(state).toEqual({
      current: 200,
      max: 200,
    });
    expect(executor.transaction).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('reserves qi once and writes a reserved log', async () => {
    const { updates, inserts } = createDbMock([
      [],
      [
        {
          id: 'cultivator-1',
          qi: 200,
          qiLastRefreshedAt: new Date(),
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
    expect(updates[0]?.values).toEqual({ qi: 150 });
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

  it('refunds the full reserved cost without applying the overflow cap', async () => {
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
          qiLastRefreshedAt: new Date(),
        },
      ],
    ]);

    await QiService.refundReservation({
      actionInstanceId: 'action-1',
      reason: 'generation_failed',
    });

    expect(updates[0]?.values).toEqual({ qi: 340 });
    expect(updates[1]?.values).toMatchObject({
      status: 'refunded',
      qiGain: 50,
      qiAfter: 340,
      metadata: {
        refundReason: 'generation_failed',
      },
    });
  });

  it('caps talisman restore at the overflow max', async () => {
    const { updates, inserts } = createDbMock([
      [],
      [{ uses: 2 }],
      [
        {
          id: 'cultivator-1',
          qi: 260,
          qiLastRefreshedAt: new Date(),
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
    expect(updates[0]?.values).toEqual({ qi: 300 });
    expect(inserts[0]?.values).toMatchObject({
      action: 'qi_restore_medium',
      status: 'restore_committed',
      qiGain: 40,
      qiBefore: 260,
      qiAfter: 300,
      source: 'talisman',
    });
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
