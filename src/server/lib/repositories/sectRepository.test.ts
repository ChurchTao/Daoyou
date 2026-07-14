import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  sectAbilityLoadouts,
  sectMemberships,
  sectMeridianLoadouts,
  sectMethodProgress,
  sectPathProgress,
} from '@server/lib/drizzle/schema';
import { createSectRuntime } from '@shared/engine/sect';
import { FIXTURE_SECT_MODULE } from '@shared/engine/sect/testing/fixtureSect';
import { describe, expect, it, vi } from 'vitest';
import {
  hydrateSectAbilitySlots,
  loadCultivatorSectState,
  replaceAbilityLoadout,
} from './sectRepository';

describe('loadCultivatorSectState', () => {
  it('serializes related reads for transaction-backed executors', async () => {
    let activeQueries = 0;
    let maxActiveQueries = 0;

    const rowsByTable = new Map<unknown, unknown[]>([
      [
        sectMemberships,
        [
          {
            id: 'membership-1',
            cultivatorId: 'cultivator-1',
            sectId: 'lingxiao',
            status: 'active',
            experiencedAt: new Date('2026-07-13T00:00:00.000Z'),
            joinedAt: null,
            activePathId: null,
            contribution: 0,
            configVersion: 2,
          },
        ],
      ],
      [sectMethodProgress, []],
      [sectPathProgress, []],
      [sectMeridianLoadouts, []],
      [sectAbilityLoadouts, []],
    ]);

    const tx = {
      select: () => ({
        from: (table: unknown) => {
          const query = {
            where: () => query,
            limit: () => query,
            then: <TResult1 = unknown[], TResult2 = never>(
              onFulfilled?:
                ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
              onRejected?:
                ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ) => {
              activeQueries += 1;
              maxActiveQueries = Math.max(maxActiveQueries, activeQueries);
              return new Promise<unknown[]>((resolve) => {
                setTimeout(() => {
                  activeQueries -= 1;
                  resolve(rowsByTable.get(table) ?? []);
                }, 0);
              }).then(onFulfilled, onRejected);
            },
          };
          return query;
        },
      }),
    } as unknown as DbTransaction;

    await expect(
      loadCultivatorSectState('cultivator-1', tx),
    ).resolves.toMatchObject({
      membershipId: 'membership-1',
      experiencedAt: '2026-07-13T00:00:00.000Z',
    });
    expect(maxActiveQueries).toBe(1);
  });

  it('hydrates an isolated second sect through its injected runtime validator', async () => {
    const rowsByTable = new Map<unknown, unknown[]>([
      [
        sectMemberships,
        [
          {
            id: 'fixture-membership',
            cultivatorId: 'cultivator-1',
            sectId: 'fixture-sect',
            status: 'active',
            experiencedAt: null,
            joinedAt: null,
            activePathId: null,
            contribution: 30,
            configVersion: 1,
          },
        ],
      ],
      [
        sectMethodProgress,
        [
          { methodId: 'fixture-method-1', level: 1 },
          { methodId: 'fixture-method-2', level: 1 },
        ],
      ],
      [sectPathProgress, []],
      [sectMeridianLoadouts, []],
      [sectAbilityLoadouts, [{ slot: 1, abilityId: 'fixture-ability-2' }]],
    ]);
    const tx = {
      select: () => ({
        from: (table: unknown) => {
          const query = {
            where: () => query,
            limit: () => query,
            then: (resolve: (value: unknown[]) => unknown) =>
              Promise.resolve(rowsByTable.get(table) ?? []).then(resolve),
          };
          return query;
        },
      }),
    } as unknown as DbTransaction;

    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    await expect(
      loadCultivatorSectState('cultivator-1', tx, runtime),
    ).resolves.toMatchObject({
      sectId: 'fixture-sect',
      abilityLoadout: ['fixture-ability-2', null, null, null],
    });
  });
});

describe('宗门神通稀疏槽位', () => {
  it('按真实槽号补齐旧数据与中间空槽', () => {
    expect(
      hydrateSectAbilitySlots([
        { slot: 1, abilityId: 'guiding-sword' },
        { slot: 3, abilityId: 'turning-body' },
      ]),
    ).toEqual(['guiding-sword', null, 'turning-body', null]);
  });

  it('写入时只保存非空槽且不重排槽号', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const tx = {
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      insert: vi.fn(() => ({ values })),
    } as unknown as DbTransaction;

    await replaceAbilityLoadout(
      'membership-1',
      ['guiding-sword', null, 'turning-body', null],
      tx,
    );

    expect(values).toHaveBeenCalledWith([
      { membershipId: 'membership-1', slot: 1, abilityId: 'guiding-sword' },
      { membershipId: 'membership-1', slot: 3, abilityId: 'turning-body' },
    ]);
  });
});
