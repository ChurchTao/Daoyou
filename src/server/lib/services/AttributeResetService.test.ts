import { getExecutor } from '@server/lib/drizzle/db';
import { consumeConsumableById } from './cultivatorService';
import {
  AttributeResetService,
  AttributeResetServiceError,
} from './AttributeResetService';
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('./cultivatorService', () => ({
  consumeConsumableById: vi.fn(),
}));

const getExecutorMock = getExecutor as unknown as Mock;
const consumeConsumableByIdMock = consumeConsumableById as unknown as Mock;

function talismanRow() {
  return {
    id: 'talisman-1',
    cultivatorId: 'cultivator-1',
    name: '归元洗髓符',
    type: '符箓',
    prompt: '',
    quality: '仙品',
    spec: {
      kind: 'talisman',
      scenario: 'attribute_reset',
      sessionMode: 'consume_on_action',
    },
    quantity: 1,
    description: null,
    score: 0,
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
  };
}

function mockExecutor(args: {
  current: {
    realm: string;
    realmStage: string;
    vitality: number;
    spirit: number;
    wisdom: number;
    speed: number;
    willpower: number;
    unallocatedAttributePoints: number;
  };
  talismans?: ReturnType<typeof talismanRow>[];
}) {
  const currentLimit = vi.fn().mockResolvedValue([
    {
      id: 'cultivator-1',
      ...args.current,
    },
  ]);
  const currentWhere = vi.fn(() => ({ limit: currentLimit }));
  const currentFrom = vi.fn(() => ({ where: currentWhere }));

  const talismanLimit = vi.fn().mockResolvedValue(args.talismans ?? [talismanRow()]);
  const orderBy = vi.fn(() => ({ limit: talismanLimit }));
  const talismanWhere = vi.fn(() => ({ orderBy }));
  const talismanFrom = vi.fn(() => ({ where: talismanWhere }));

  const select = vi
    .fn()
    .mockReturnValueOnce({ from: currentFrom })
    .mockReturnValueOnce({ from: talismanFrom });

  const returning = vi.fn().mockResolvedValue([
    {
      vitality: 20,
      spirit: 20,
      wisdom: 20,
      speed: 20,
      willpower: 20,
      unallocatedAttributePoints:
        args.current.unallocatedAttributePoints +
        Math.max(
          0,
          args.current.vitality +
            args.current.spirit +
            args.current.wisdom +
            args.current.speed +
            args.current.willpower -
            20 * 5,
        ),
    },
  ]);
  const updateWhere = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  getExecutorMock.mockReturnValue({ select, update });
  return { set, update };
}

describe('AttributeResetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets attributes to natural realm values and refunds allocated points', async () => {
    const { set } = mockExecutor({
      current: {
        realm: '筑基',
        realmStage: '初期',
        vitality: 32,
        spirit: 20,
        wisdom: 25,
        speed: 20,
        willpower: 20,
        unallocatedAttributePoints: 7,
      },
    });

    const result = await AttributeResetService.resetAttributesWithTalisman({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      consumableId: 'talisman-1',
    });

    expect(set).toHaveBeenCalledWith({
      vitality: 20,
      spirit: 20,
      wisdom: 20,
      speed: 20,
      willpower: 20,
      unallocatedAttributePoints: 24,
    });
    expect(consumeConsumableByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'talisman-1',
      1,
      undefined,
    );
    expect(result).toEqual({
      attributes: {
        vitality: 20,
        spirit: 20,
        wisdom: 20,
        speed: 20,
        willpower: 20,
      },
      unallocated_attribute_points: 24,
      refunded_attribute_points: 17,
      consumed_talisman_name: '归元洗髓符',
    });
  });

  it('does not consume talisman when no points have been allocated', async () => {
    mockExecutor({
      current: {
        realm: '筑基',
        realmStage: '初期',
        vitality: 20,
        spirit: 20,
        wisdom: 20,
        speed: 20,
        willpower: 20,
        unallocatedAttributePoints: 50,
      },
    });

    await expect(
      AttributeResetService.resetAttributesWithTalisman({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
      }),
    ).rejects.toThrow(
      new AttributeResetServiceError(400, '当前没有已分配的属性点可重置'),
    );
    expect(consumeConsumableByIdMock).not.toHaveBeenCalled();
  });
});
