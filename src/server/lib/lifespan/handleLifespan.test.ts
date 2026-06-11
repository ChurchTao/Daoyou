import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorBasicsByIdUnsafe: vi.fn(),
  getCultivatorOwnerId: vi.fn(),
  updateCultivator: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  invalidateActiveCultivatorRef: vi.fn(),
}));

import { invalidateActiveCultivatorRef } from '@server/lib/hono/middleware';
import {
  getCultivatorBasicsByIdUnsafe,
  getCultivatorOwnerId,
  updateCultivator,
} from '@server/lib/services/cultivatorService';
import { consumeLifespanAndHandleDepletion } from './handleLifespan';

const getCultivatorBasicsByIdUnsafeMock =
  getCultivatorBasicsByIdUnsafe as unknown as Mock;
const getCultivatorOwnerIdMock = getCultivatorOwnerId as unknown as Mock;
const updateCultivatorMock = updateCultivator as unknown as Mock;
const invalidateActiveCultivatorRefMock =
  invalidateActiveCultivatorRef as unknown as Mock;

describe('consumeLifespanAndHandleDepletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCultivatorBasicsByIdUnsafeMock.mockResolvedValue({
      id: 'cultivator-1',
      name: '韩立',
      realm: '筑基',
      realm_stage: '初期',
      age: 80,
      lifespan: 150,
      status: 'active',
    });
    getCultivatorOwnerIdMock.mockResolvedValue('user-1');
    updateCultivatorMock.mockImplementation(
      async (_id: string, patch: Record<string, unknown>) => ({
        id: 'cultivator-1',
        name: '韩立',
        realm: '筑基',
        realm_stage: '初期',
        age: patch.age,
        lifespan: 150,
        status: patch.status,
      }),
    );
  });

  it('does not double-count years when the caller passes the settled age', async () => {
    const result = await consumeLifespanAndHandleDepletion(
      'cultivator-1',
      50,
      {
        ageAfterConsumption: 130,
      },
    );

    expect(result.depleted).toBe(false);
    expect(updateCultivatorMock).not.toHaveBeenCalled();
    expect(invalidateActiveCultivatorRefMock).not.toHaveBeenCalled();
  });

  it('marks the cultivator dead when the settled age reaches lifespan', async () => {
    const result = await consumeLifespanAndHandleDepletion(
      'cultivator-1',
      70,
      {
        ageAfterConsumption: 150,
      },
    );

    expect(result.depleted).toBe(true);
    expect(updateCultivatorMock).toHaveBeenCalledWith(
      'cultivator-1',
      {
        age: 150,
        status: 'dead',
      },
      undefined,
    );
    expect(invalidateActiveCultivatorRefMock).toHaveBeenCalledWith('user-1');
  });
});
