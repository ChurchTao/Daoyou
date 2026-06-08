import type { Consumable } from '@shared/types/cultivator';

const {
  consumeConsumableByIdMock,
  getCultivatorByIdMock,
  restoreQiMock,
  selectLimitMock,
  transactionMock,
} = vi.hoisted(() => ({
  consumeConsumableByIdMock: vi.fn(),
  getCultivatorByIdMock: vi.fn(),
  restoreQiMock: vi.fn(),
  selectLimitMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: selectLimitMock,
        }),
      }),
    }),
    transaction: transactionMock,
  }),
}));

vi.mock('./cultivatorService', () => ({
  consumeConsumableById: consumeConsumableByIdMock,
  getCultivatorById: getCultivatorByIdMock,
  replaceSpiritualRoots: vi.fn(),
}));

vi.mock('./QiService', () => ({
  QiService: {
    restoreQi: restoreQiMock,
  },
}));

vi.mock('./consumablePersistence', () => ({
  mapConsumableRow: (row: unknown) => row,
}));

import { ConsumableUseEngine } from './ConsumableUseEngine';

function talisman(overrides: Partial<Consumable> = {}): Consumable {
  return {
    id: 'consumable-1',
    name: '小聚灵符',
    type: '符箓',
    quality: '仙品',
    quantity: 1,
    description: '',
    prompt: '',
    score: 0,
    spec: {
      kind: 'talisman',
      scenario: 'qi_restore_small',
      sessionMode: 'consume_on_action',
      notes: '',
    },
    ...overrides,
  };
}

describe('ConsumableUseEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCultivatorByIdMock.mockResolvedValue({
      id: 'cultivator-1',
      spiritual_roots: [],
    });
    transactionMock.mockImplementation(async (callback) => callback('tx'));
    restoreQiMock.mockResolvedValue({
      success: true,
      qiBefore: 100,
      qiAfter: 150,
      restored: 50,
      overflowMax: 300,
    });
  });

  it('restores qi and consumes the talisman through the unified consume path', async () => {
    selectLimitMock.mockResolvedValueOnce([talisman()]);

    const result = await ConsumableUseEngine.consume(
      'user-1',
      'cultivator-1',
      'consumable-1',
    );

    expect(restoreQiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cultivatorId: 'cultivator-1',
        amount: 50,
        source: 'talisman',
        action: 'qi_restore_small',
        tx: 'tx',
        metadata: {
          consumableId: 'consumable-1',
          consumableName: '小聚灵符',
          scenario: 'qi_restore_small',
        },
      }),
    );
    expect(consumeConsumableByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'consumable-1',
      1,
      'tx',
    );
    expect(result.message).toBe('已使用小聚灵符，天地灵气 +50。');
  });

  it('keeps non-qi talismans bound to their gameplay entry', async () => {
    selectLimitMock.mockResolvedValueOnce([
      talisman({
        name: '天机逆命符',
        spec: {
          kind: 'talisman',
          scenario: 'fate_reshape',
          sessionMode: 'consume_on_action',
        },
      }),
    ]);

    await expect(
      ConsumableUseEngine.consume('user-1', 'cultivator-1', 'consumable-1'),
    ).rejects.toThrow('符箓需在对应玩法入口校验并消耗');
    expect(restoreQiMock).not.toHaveBeenCalled();
    expect(consumeConsumableByIdMock).not.toHaveBeenCalled();
  });
});
