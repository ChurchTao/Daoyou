import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getExecutorMock } = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

import {
  RecipientResolveError,
  resolveGameMailRecipients,
} from './recipient-resolver';

function mockSelectRows(rows: unknown[]) {
  const whereMock = vi.fn().mockResolvedValue(rows);
  const fromMock = vi.fn().mockReturnValue({
    where: whereMock,
  });
  const selectMock = vi.fn().mockReturnValue({
    from: fromMock,
  });

  getExecutorMock.mockReturnValue({
    select: selectMock,
  });

  return { whereMock, fromMock, selectMock };
}

describe('resolveGameMailRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only the target cultivator in single-send mode', async () => {
    mockSelectRows([
      {
        id: 'cultivator-1',
        name: '韩立',
        realm: '筑基',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);

    const result = await resolveGameMailRecipients({
      targetCultivatorId: 'cultivator-1',
      cultivatorCreatedFrom: '2026-05-10',
      realmMin: '元婴',
    });

    expect(result).toEqual({
      totalCount: 1,
      recipients: [
        {
          recipientType: 'cultivator',
          recipientKey: 'cultivator-1',
          metadata: {
            cultivatorId: 'cultivator-1',
            cultivatorName: '韩立',
            realm: '筑基',
            createdAt: '2026-05-01T00:00:00.000Z',
          },
        },
      ],
      sampleRecipients: [
        {
          recipientType: 'cultivator',
          recipientKey: 'cultivator-1',
          metadata: {
            cultivatorId: 'cultivator-1',
            cultivatorName: '韩立',
            realm: '筑基',
            createdAt: '2026-05-01T00:00:00.000Z',
          },
        },
      ],
    });
  });

  it('throws when the target cultivator does not exist or is inactive', async () => {
    mockSelectRows([]);

    await expect(
      resolveGameMailRecipients({
        targetCultivatorId: 'missing-cultivator',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<RecipientResolveError>>({
        message: '目标角色不存在或未处于活跃状态',
        status: 404,
      }),
    );
  });
});
