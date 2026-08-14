import {
  RESOURCE_DATA_SCHEMAS,
  RESOURCE_TOPICS,
  RESOURCE_TOPIC_SCOPE_KIND,
  ResourceChangeSchema,
  advanceContiguousResourceCursor,
  canonicalizeResourceParams,
  createResourceCacheKey,
  getResourceScopeTransitionKinds,
  hasResourceVersionGap,
  orderResourceChanges,
  reduceInventoryResourcePage,
  reduceTaskResourceList,
  requiresResourceEventReload,
  type ResourceChange,
  type ResourceScope,
} from './resources';

const cultivatorScope: ResourceScope = {
  kind: 'cultivator',
  id: '894471ab-93f1-4575-bbb8-3c89f28a2512',
};
const materialOneId = '11111111-1111-4111-8111-111111111111';
const materialTwoId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';

const task = {
  id: taskId,
  definitionId: 'tutorial-test',
  category: 'tutorial' as const,
  status: 'active' as const,
  currentStage: 'start',
  objectives: [],
  metadata: {},
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z',
  snapshot: {
    title: '入门',
    summary: '测试',
    isCompleted: false,
    currentStageId: 'start',
    currentStageIndex: 0,
    totalStages: 1,
    missingRequirements: [],
    stages: [],
  },
};

function change(input: {
  scopeVersion: number;
  resourceVersion: number;
  operation: 'invalidate';
  mutationOrdinal?: number;
}): ResourceChange {
  return ResourceChangeSchema.parse({
    id: crypto.randomUUID(),
    mutationOrdinal: input.mutationOrdinal ?? 0,
    scope: cultivatorScope,
    resourceTopic: 'sect.tasks',
    resourceVersion: input.resourceVersion,
    scopeVersion: input.scopeVersion,
    eventType: 'test.change',
    source: 'test',
    createdAt: '2026-07-27T00:00:00.000Z',
    operation: input.operation,
  });
}

function inventoryChange(
  input:
    | {
        scopeVersion: number;
        operation: 'upsert-items';
        payload: { idKey: string; items: Array<Record<string, unknown>> };
      }
    | {
        scopeVersion: number;
        operation: 'remove-items';
        payload: { idKey: string; ids: string[] };
      },
): ResourceChange<'inventory.materials'> {
  return ResourceChangeSchema.parse({
    id: crypto.randomUUID(),
    mutationOrdinal: 0,
    scope: cultivatorScope,
    resourceTopic: 'inventory.materials',
    resourceVersion: input.scopeVersion,
    scopeVersion: input.scopeVersion,
    eventType: 'test.inventory.changed',
    source: 'test',
    createdAt: '2026-07-27T00:00:00.000Z',
    operation: input.operation,
    payload: input.payload,
  }) as ResourceChange<'inventory.materials'>;
}

describe('multi-scope resource contracts', () => {
  test('keeps interaction queries out of the persistent topic registry', () => {
    expect(RESOURCE_TOPICS).not.toContain('sect.stipend');
    expect(RESOURCE_TOPICS).not.toContain('sect.promotion-evaluation');
  });

  test('pairs every topic with one schema and one fixed scope kind', () => {
    expect(Object.keys(RESOURCE_DATA_SCHEMAS)).toEqual([...RESOURCE_TOPICS]);
    expect(Object.keys(RESOURCE_TOPIC_SCOPE_KIND)).toEqual([
      ...RESOURCE_TOPICS,
    ]);
    expect(new Set(RESOURCE_TOPICS).size).toBe(RESOURCE_TOPICS.length);
    expect(RESOURCE_TOPIC_SCOPE_KIND['player.session']).toBe('account');
    expect(RESOURCE_TOPIC_SCOPE_KIND['sect.infrastructure']).toBe('sect');
    expect(RESOURCE_TOPIC_SCOPE_KIND['sect.membership']).toBe('cultivator');
  });

  test('keeps infrastructure and daily construction status separate', () => {
    const infrastructure = { facilities: [] };
    const member = {
      dateKey: '2026-07-29',
      constructedToday: true,
      facilityKey: 'archive',
      spiritStones: 10_000,
      constructionPoints: 1,
      contribution: 10,
    };

    expect(
      RESOURCE_DATA_SCHEMAS['sect.infrastructure'].safeParse(infrastructure)
        .success,
    ).toBe(true);
    expect(
      RESOURCE_DATA_SCHEMAS['sect.construction-member'].safeParse(member)
        .success,
    ).toBe(true);
    expect(
      RESOURCE_DATA_SCHEMAS['sect.infrastructure'].safeParse(member).success,
    ).toBe(false);
  });

  test('keeps task summaries and filtered task DTOs separate', () => {
    expect(
      RESOURCE_DATA_SCHEMAS['player.task-summary'].safeParse({
        activeCount: 1,
        claimableCount: 0,
      }).success,
    ).toBe(true);
    expect(
      RESOURCE_DATA_SCHEMAS['player.tasks'].safeParse([task]).success,
    ).toBe(true);
    expect(
      RESOURCE_DATA_SCHEMAS['player.tasks'].safeParse({
        activeCount: 1,
        claimableCount: 0,
      }).success,
    ).toBe(false);
    expect(
      RESOURCE_DATA_SCHEMAS['player.task-summary'].safeParse([task]).success,
    ).toBe(false);
  });

  test('canonicalizes address params and includes scope in the cache key', () => {
    const left = canonicalizeResourceParams({
      page: 1,
      filters: { rank: ['玄品', '灵品'], element: undefined },
    });
    const right = canonicalizeResourceParams({
      filters: { rank: ['玄品', '灵品'] },
      page: 1,
    });
    expect(left).toBe(right);
    expect(
      createResourceCacheKey(cultivatorScope, 'inventory.materials', {
        page: 1,
      }),
    ).toBe(
      'cultivator:894471ab-93f1-4575-bbb8-3c89f28a2512:inventory.materials:{"page":1}',
    );
  });

  test('tracks gaps independently within a scope version stream', () => {
    expect(
      hasResourceVersionGap(
        [{ scopeVersion: 8 }, { scopeVersion: 8 }, { scopeVersion: 9 }],
        7,
      ),
    ).toBe(false);
    expect(
      hasResourceVersionGap([{ scopeVersion: 8 }, { scopeVersion: 10 }], 7),
    ).toBe(true);
    expect(
      hasResourceVersionGap([{ scopeVersion: 8 }, { scopeVersion: 8 }], 8),
    ).toBe(false);
    expect(
      advanceContiguousResourceCursor(7, [
        { scopeVersion: 8 },
        { scopeVersion: 8 },
        { scopeVersion: 9 },
      ]),
    ).toEqual({ cursor: 9, hasGap: false });
    expect(
      advanceContiguousResourceCursor(7, [
        { scopeVersion: 8 },
        { scopeVersion: 10 },
      ]),
    ).toEqual({ cursor: 7, hasGap: true });
    expect(
      advanceContiguousResourceCursor(9, [
        { scopeVersion: 8 },
        { scopeVersion: 9 },
      ]),
    ).toEqual({ cursor: 9, hasGap: false });
  });

  test('requires a scoped reload for retention and pagination gaps', () => {
    expect(
      requiresResourceEventReload(
        {
          changes: [],
          currentScopeVersion: 12,
          earliestAvailableVersion: 13,
        },
        10,
        200,
      ),
    ).toBe(true);
    expect(
      requiresResourceEventReload(
        {
          changes: [
            change({
              operation: 'invalidate',
              scopeVersion: 12,
              resourceVersion: 1,
            }),
          ],
          currentScopeVersion: 12,
          earliestAvailableVersion: 12,
        },
        11,
        200,
      ),
    ).toBe(false);
    expect(
      requiresResourceEventReload(
        {
          changes: [],
          currentScopeVersion: 12,
          earliestAvailableVersion: 13,
        },
        12,
        200,
      ),
    ).toBe(false);
    const continuous = Array.from({ length: 200 }, (_, index) =>
      change({
        operation: 'invalidate',
        scopeVersion: index + 1,
        resourceVersion: index + 1,
      }),
    );
    expect(
      requiresResourceEventReload(
        {
          changes: continuous,
          currentScopeVersion: 200,
          earliestAvailableVersion: 1,
        },
        0,
        200,
      ),
    ).toBe(false);
    expect(
      requiresResourceEventReload(
        {
          changes: [
            ...continuous,
            change({
              operation: 'invalidate',
              scopeVersion: 201,
              resourceVersion: 201,
            }),
          ],
          currentScopeVersion: 201,
          earliestAvailableVersion: 1,
        },
        0,
        200,
      ),
    ).toBe(true);
  });

  test('orders cross-scope events without losing transaction order', () => {
    const sectScope: ResourceScope = { kind: 'sect', id: 'lingxiao' };
    const changes = [
      change({
        operation: 'invalidate',
        scopeVersion: 9,
        resourceVersion: 2,
        mutationOrdinal: 1,
      }),
      {
        ...change({
          operation: 'invalidate',
          scopeVersion: 8,
          resourceVersion: 1,
          mutationOrdinal: 2,
        }),
        scope: sectScope,
        resourceTopic: 'sect.infrastructure',
      },
      change({
        operation: 'invalidate',
        scopeVersion: 8,
        resourceVersion: 1,
        mutationOrdinal: 0,
      }),
    ];
    const ordered = orderResourceChanges(changes);
    expect(
      ordered.map((item) => [
        item.scope.kind,
        item.scopeVersion,
        item.mutationOrdinal,
      ]),
    ).toEqual([
      ['cultivator', 8, 0],
      ['cultivator', 9, 1],
      ['sect', 8, 2],
    ]);
    expect(
      advanceContiguousResourceCursor(
        7,
        ordered.filter((item) => item.scope.kind === 'cultivator'),
      ),
    ).toEqual({ cursor: 9, hasGap: false });
  });

  test('validates scope and operation payload pairing', () => {
    const invalid = {
      id: crypto.randomUUID(),
      mutationOrdinal: 0,
      scope: cultivatorScope,
      resourceTopic: 'inventory.materials',
      resourceVersion: 1,
      scopeVersion: 1,
      eventType: 'test.invalid',
      source: 'test',
      createdAt: '2026-07-27T00:00:00.000Z',
      operation: 'remove-items',
      payload: { items: [] },
    };
    expect(ResourceChangeSchema.safeParse(invalid).success).toBe(false);
    expect(
      ResourceChangeSchema.safeParse({
        ...invalid,
        scope: { kind: 'sect', id: 'lingxiao' },
        operation: 'invalidate',
        payload: undefined,
      }).success,
    ).toBe(false);
  });

  test('accepts historical v3 and current v4 pills in inventory events', () => {
    const buildPillChange = (version: number) => ({
      id: crypto.randomUUID(),
      mutationOrdinal: 0,
      scope: cultivatorScope,
      resourceTopic: 'inventory.consumables',
      resourceVersion: 1,
      scopeVersion: 1,
      eventType: 'inventory.alchemy.changed',
      source: 'alchemy_improvised',
      createdAt: '2026-08-14T00:00:00.000Z',
      operation: 'upsert-items',
      payload: {
        idKey: 'id',
        items: [
          {
            id: crypto.randomUUID(),
            name: '测试丹',
            type: '丹药',
            quality: '玄品',
            quantity: 1,
            spec: {
              kind: 'pill',
              family: 'cultivation',
              operations: [
                {
                  type: 'gain_progress',
                  target: 'cultivation_exp',
                  value: 1,
                },
              ],
              consumeRules: {
                scene: 'out_of_battle_only',
                quotaCategory: 'cultivation',
              },
              alchemyMeta: {
                source: 'improvised',
                sourceMaterials: ['测试材料'],
                stability: 80,
                toxicityRating: 10,
                tags: [],
                version,
              },
            },
          },
        ],
      },
    });

    expect(ResourceChangeSchema.safeParse(buildPillChange(3)).success).toBe(
      true,
    );
    expect(ResourceChangeSchema.safeParse(buildPillChange(4)).success).toBe(
      true,
    );
    expect(ResourceChangeSchema.safeParse(buildPillChange(5)).success).toBe(
      false,
    );
  });

  test('rejects merge for replace-only topics and nested profile partials', () => {
    const base = {
      id: crypto.randomUUID(),
      mutationOrdinal: 0,
      scope: cultivatorScope,
      resourceVersion: 1,
      scopeVersion: 1,
      eventType: 'test.invalid_merge',
      source: 'test',
      createdAt: '2026-07-27T00:00:00.000Z',
      operation: 'merge',
    };
    expect(
      ResourceChangeSchema.safeParse({
        ...base,
        resourceTopic: 'player.condition',
        payload: {},
      }).success,
    ).toBe(false);
    expect(
      ResourceChangeSchema.safeParse({
        ...base,
        resourceTopic: 'player.profile',
        payload: { cultivator: { attributes: { vitality: 1 } } },
      }).success,
    ).toBe(false);
  });

  test('preserves cross-scope replay changes and transaction order in JSON', () => {
    const sectScope: ResourceScope = { kind: 'sect', id: 'lingxiao' };
    const original = orderResourceChanges([
      change({
        operation: 'invalidate',
        scopeVersion: 14,
        resourceVersion: 3,
        mutationOrdinal: 1,
      }),
      {
        ...change({
          operation: 'invalidate',
          scopeVersion: 9,
          resourceVersion: 2,
          mutationOrdinal: 0,
        }),
        scope: sectScope,
        resourceTopic: 'sect.infrastructure',
      },
    ]);
    const replayed = ResourceChangeSchema.array().parse(
      JSON.parse(JSON.stringify(original)),
    );
    expect(replayed).toEqual(original);
    expect(replayed.map((item) => item.mutationOrdinal)).toEqual([1, 0]);
  });

  test('limits scope transition cleanup to changed identities', () => {
    const initial = {
      accountId: 'account-a',
      cultivatorId: 'cultivator-a',
      sectId: 'sect-a',
    };
    expect(
      getResourceScopeTransitionKinds(initial, {
        ...initial,
        sectId: 'sect-b',
      }),
    ).toEqual(['sect']);
    expect(
      getResourceScopeTransitionKinds(initial, {
        ...initial,
        cultivatorId: 'cultivator-b',
      }),
    ).toEqual(['cultivator', 'sect']);
    expect(
      getResourceScopeTransitionKinds(initial, {
        accountId: 'account-b',
        cultivatorId: null,
        sectId: null,
      }),
    ).toEqual(['account', 'cultivator', 'sect', 'global']);
  });

  test('updates known inventory items and marks uncertain pages stale', () => {
    const current = {
      items: [{ id: materialOneId, name: '旧名', quantity: 3 }],
      pagination: {
        page: 2,
        pageSize: 30,
        total: 40,
        totalPages: 2,
        hasMore: false,
      },
    };
    const updated = reduceInventoryResourcePage(
      current as never,
      inventoryChange({
        operation: 'upsert-items',
        scopeVersion: 1,
        payload: {
          idKey: 'id',
          items: [
            {
              id: materialOneId,
              name: '新名',
              type: 'herb',
              rank: '凡品',
              quantity: 2,
            },
          ],
        },
      }),
    );
    expect(updated.status).toBe('applied');
    if (updated.status === 'applied') {
      expect(updated.data.items[0]).toMatchObject({
        name: '新名',
        quantity: 2,
      });
    }
    expect(
      reduceInventoryResourcePage(
        current as never,
        inventoryChange({
          operation: 'remove-items',
          scopeVersion: 2,
          payload: { idKey: 'id', ids: [materialOneId] },
        }),
      ).status,
    ).toBe('stale');
  });

  test('removes authoritatively from a complete first inventory page', () => {
    const current = {
      items: [
        { id: materialOneId, quantity: 3 },
        { id: materialTwoId, quantity: 1 },
      ],
      pagination: {
        page: 1,
        pageSize: 30,
        total: 2,
        totalPages: 1,
        hasMore: false,
      },
    };
    const removed = reduceInventoryResourcePage(
      current as never,
      inventoryChange({
        operation: 'remove-items',
        scopeVersion: 3,
        payload: { idKey: 'id', ids: [materialOneId] },
      }),
    );
    expect(removed.status).toBe('applied');
    if (removed.status === 'applied') {
      expect(removed.data.items).toEqual([{ id: materialTwoId, quantity: 1 }]);
      expect(removed.data.pagination).toMatchObject({
        total: 1,
        totalPages: 1,
      });
    }
  });

  test('ignores filtered-out inventory upserts and stales on sort changes', () => {
    const current = {
      items: [
        {
          id: materialOneId,
          name: '灵草',
          type: 'herb',
          rank: '凡品',
          quantity: 3,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 30,
        total: 1,
        totalPages: 1,
        hasMore: false,
      },
    };
    const filteredOut = reduceInventoryResourcePage(
      current as never,
      inventoryChange({
        operation: 'upsert-items',
        scopeVersion: 4,
        payload: {
          idKey: 'id',
          items: [
            {
              id: materialTwoId,
              name: '玄铁',
              type: 'ore',
              rank: '凡品',
              quantity: 1,
            },
          ],
        },
      }),
      { materialTypes: ['herb'] },
    );
    expect(filteredOut.status).toBe('ignored');

    const sortChanged = reduceInventoryResourcePage(
      current as never,
      inventoryChange({
        operation: 'upsert-items',
        scopeVersion: 5,
        payload: {
          idKey: 'id',
          items: [
            {
              id: materialOneId,
              name: '灵草',
              type: 'herb',
              rank: '凡品',
              quantity: 2,
            },
          ],
        },
      }),
      { materialTypes: ['herb'], materialSortBy: 'quantity' },
    );
    expect(sortChanged.status).toBe('stale');
  });

  test('applies, ignores and removes filtered task changes precisely', () => {
    const completed = { ...task, status: 'completed' as const };
    const upsertCompleted = ResourceChangeSchema.parse({
      id: crypto.randomUUID(),
      mutationOrdinal: 0,
      scope: cultivatorScope,
      resourceTopic: 'player.tasks',
      resourceVersion: 1,
      scopeVersion: 1,
      eventType: 'test.task.changed',
      source: 'test',
      createdAt: '2026-07-27T00:00:00.000Z',
      operation: 'upsert-items',
      payload: { idKey: 'id', items: [completed] },
    }) as ResourceChange<'player.tasks'>;
    expect(
      reduceTaskResourceList([], upsertCompleted, { status: 'active' }).status,
    ).toBe('ignored');
    const removed = reduceTaskResourceList([task], upsertCompleted, {
      status: 'active',
    });
    expect(removed).toEqual({ status: 'applied', data: [] });
    const replacement = reduceTaskResourceList(
      [task],
      {
        ...upsertCompleted,
        operation: 'replace',
        payload: [task, completed],
      },
      { status: 'completed' },
    );
    expect(replacement).toEqual({
      status: 'applied',
      data: [completed],
    });
  });
});
