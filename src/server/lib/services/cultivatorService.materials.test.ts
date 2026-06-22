const { getExecutorMock, hasCultivatorOwnershipMock } = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
  hasCultivatorOwnershipMock: vi.fn(),
}));

vi.mock('../drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('../repositories/cultivatorRepository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../repositories/cultivatorRepository')>();
  return {
    ...actual,
    hasCultivatorOwnership: hasCultivatorOwnershipMock,
  };
});

import {
  consumeMaterialById,
  hasMaterial,
  removeMaterialFromInventory,
} from './cultivatorService';

function createMaterialExecutor(
  materialRows: Array<{
    id: string;
    name: string;
    rank: string;
    quantity: number;
    createdAt: Date | null;
  }>,
) {
  const state = {
    deletedIds: [] as unknown[],
    updated: [] as Array<{ values: unknown; where: unknown }>,
  };

  const executor = {
    select() {
      return {
        from() {
          return {
            where: async () => materialRows,
          };
        },
      };
    },
    update() {
      return {
        set(values: unknown) {
          return {
            where: async (where: unknown) => {
              state.updated.push({ values, where });
            },
          };
        },
      };
    },
    delete() {
      return {
        where: async (where: unknown) => {
          state.deletedIds.push(where);
        },
      };
    },
  };

  return { executor, state };
}

function createMaterialByIdExecutor(
  materialRow:
    | {
        id: string;
        quantity: number;
      }
    | undefined,
) {
  const state = {
    deletedIds: [] as unknown[],
    updated: [] as Array<{ values: unknown; where: unknown }>,
  };

  const executor = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => (materialRow ? [materialRow] : []),
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: unknown) {
          return {
            where: async (where: unknown) => {
              state.updated.push({ values, where });
            },
          };
        },
      };
    },
    delete() {
      return {
        where: async (where: unknown) => {
          state.deletedIds.push(where);
        },
      };
    },
  };

  return { executor, state };
}

describe('cultivator material consumption', () => {
  beforeEach(() => {
    getExecutorMock.mockReset();
    hasCultivatorOwnershipMock.mockReset();
    hasCultivatorOwnershipMock.mockResolvedValue(true);
  });

  it('checks same-name material availability against the lowest quality stack', async () => {
    const { executor } = createMaterialExecutor([
      {
        id: 'high-material',
        name: '青露草',
        rank: '天品',
        quantity: 10,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: 'low-material',
        name: '青露草',
        rank: '灵品',
        quantity: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    getExecutorMock.mockReturnValue(executor);

    await expect(
      hasMaterial('user-1', 'cultivator-1', '青露草', 2),
    ).resolves.toBe(true);
  });

  it('removes same-name materials from low to high quality stacks', async () => {
    const { executor, state } = createMaterialExecutor([
      {
        id: 'high-material',
        name: '青露草',
        rank: '天品',
        quantity: 10,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: 'low-material',
        name: '青露草',
        rank: '灵品',
        quantity: 3,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    getExecutorMock.mockReturnValue(executor);

    await removeMaterialFromInventory('user-1', 'cultivator-1', '青露草', 5);

    expect(state.updated).toHaveLength(1);
    expect(state.updated[0]?.values).toEqual({ quantity: 8 });
    expect(state.deletedIds).toHaveLength(1);
  });

  it('consumes material by id without matching material name', async () => {
    const { executor, state } = createMaterialByIdExecutor({
      id: 'material-1',
      quantity: 3,
    });
    getExecutorMock.mockReturnValue(executor);

    await consumeMaterialById('user-1', 'cultivator-1', 'material-1', 2);

    expect(state.updated).toHaveLength(1);
    expect(state.updated[0]?.values).toEqual({ quantity: 1 });
    expect(state.deletedIds).toHaveLength(0);
  });

  it('rejects material by id consumption when quantity is insufficient', async () => {
    const { executor } = createMaterialByIdExecutor({
      id: 'material-1',
      quantity: 1,
    });
    getExecutorMock.mockReturnValue(executor);

    await expect(
      consumeMaterialById('user-1', 'cultivator-1', 'material-1', 2),
    ).rejects.toThrow('材料数量不足，当前仅有 1');
  });
});
