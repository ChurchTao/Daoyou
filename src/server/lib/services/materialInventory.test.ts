const { getExecutorMock } = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

import { addMaterialStackToInventory } from './materialInventory';

function createMaterialExecutor(existing?: { id: string }) {
  const state = {
    inserts: [] as unknown[],
    updates: [] as unknown[],
  };

  const executor = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    limit: async () => (existing ? [existing] : []),
                  };
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: unknown) {
          state.updates.push(values);
          return {
            where: async () => undefined,
          };
        },
      };
    },
    insert() {
      return {
        values(values: unknown) {
          state.inserts.push(values);
          return {
            returning: async () => [{ id: 'inserted-material-1' }],
          };
        },
      };
    },
  };

  return { executor, state };
}

describe('materialInventory', () => {
  beforeEach(() => {
    getExecutorMock.mockReset();
  });

  it('stacks materials by cultivator, name, and rank instead of inserting a new row', async () => {
    const { executor, state } = createMaterialExecutor({ id: 'material-1' });
    getExecutorMock.mockReturnValue(executor);

    const result = await addMaterialStackToInventory('cultivator-1', {
      name: '青露草',
      type: 'herb',
      rank: '灵品',
      element: '木',
      description: '带露的灵草。',
      details: { origin: 'mail' },
      quantity: 3,
    });

    expect(result).toEqual({ id: 'material-1', stacked: true });
    expect(state.updates).toHaveLength(1);
    expect(state.inserts).toHaveLength(0);
  });

  it('inserts a new material row when no same-name same-rank stack exists', async () => {
    const { executor, state } = createMaterialExecutor();
    getExecutorMock.mockReturnValue(executor);

    const result = await addMaterialStackToInventory('cultivator-1', {
      name: '青露草',
      type: 'herb',
      rank: '灵品',
      quantity: 2,
    });

    expect(result).toEqual({ id: 'inserted-material-1', stacked: false });
    expect(state.updates).toHaveLength(0);
    expect(state.inserts).toEqual([
      expect.objectContaining({
        cultivatorId: 'cultivator-1',
        name: '青露草',
        type: 'herb',
        rank: '灵品',
        element: null,
        description: null,
        details: {},
        quantity: 2,
      }),
    ]);
  });

  it('rejects non-positive material quantities before writing', async () => {
    const { executor, state } = createMaterialExecutor();
    getExecutorMock.mockReturnValue(executor);

    await expect(
      addMaterialStackToInventory('cultivator-1', {
        name: '青露草',
        type: 'herb',
        rank: '灵品',
        quantity: 0,
      }),
    ).rejects.toThrow('材料数量必须为正整数');

    expect(getExecutorMock).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });
});
