import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

import { addFriendPair, FriendServiceError } from './FriendService';

function createFriendTx() {
  let selectCount = 0;
  const valuesMock = vi.fn(() => ({ onConflictDoNothing: vi.fn() }));
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            selectCount += 1;
            return [
              selectCount === 1
                ? {
                    id: 'cultivator-1',
                    name: '韩立',
                    title: null,
                    realm: '筑基',
                    realm_stage: '初期',
                    status: 'active',
                  }
                : {
                    id: 'cultivator-2',
                    name: '南宫婉',
                    title: null,
                    realm: '结丹',
                    realm_stage: '中期',
                    status: 'active',
                  },
            ];
          }),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: valuesMock })),
    valuesMock,
  };
}

describe('FriendService', () => {
  it('adds both directions for a friend pair', async () => {
    const tx = createFriendTx();

    await expect(
      addFriendPair('cultivator-1', 'cultivator-2', tx as any),
    ).resolves.toEqual(
      expect.objectContaining({ id: 'cultivator-2', name: '南宫婉' }),
    );

    expect(tx.valuesMock).toHaveBeenCalledWith([
      {
        cultivatorId: 'cultivator-1',
        friendCultivatorId: 'cultivator-2',
      },
      {
        cultivatorId: 'cultivator-2',
        friendCultivatorId: 'cultivator-1',
      },
    ]);
  });

  it('rejects adding self', async () => {
    await expect(addFriendPair('cultivator-1', 'cultivator-1')).rejects.toBeInstanceOf(
      FriendServiceError,
    );
  });
});
