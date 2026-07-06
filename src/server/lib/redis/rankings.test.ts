import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sortedSets, strings, redisMock } = vi.hoisted(() => {
  const sortedSets = new Map<string, Map<string, number>>();
  const strings = new Map<string, string>();
  const redisMock = {
    zrange: vi.fn(async (key: string, start: number, stop: number) => {
      const records = [...(sortedSets.get(key) ?? new Map()).entries()]
        .sort((left, right) => left[1] - right[1])
        .map(([member]) => member);
      const end = stop < 0 ? records.length : stop + 1;
      return records.slice(start, end);
    }),
    zrank: vi.fn(async (key: string, member: string) => {
      const records = await redisMock.zrange(key, 0, -1);
      const index = records.indexOf(member);
      return index >= 0 ? index : null;
    }),
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      const bucket = sortedSets.get(key) ?? new Map<string, number>();
      bucket.set(member, Number(score));
      sortedSets.set(key, bucket);
      return 1;
    }),
    zcard: vi.fn(async (key: string) => sortedSets.get(key)?.size ?? 0),
    zrem: vi.fn(async (key: string, member: string) => {
      const bucket = sortedSets.get(key);
      return bucket?.delete(member) ? 1 : 0;
    }),
    zremrangebyrank: vi.fn(async (key: string, start: number, stop: number) => {
      const records = await redisMock.zrange(key, 0, -1);
      const end = stop < 0 ? records.length : stop + 1;
      const removed = records.slice(start, end);
      const bucket = sortedSets.get(key);
      for (const member of removed) {
        bucket?.delete(member);
      }
      return removed.length;
    }),
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      strings.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      const existed = strings.delete(key);
      return existed ? 1 : 0;
    }),
    exists: vi.fn(async (key: string) => (strings.has(key) ? 1 : 0)),
    pipeline: vi.fn(() => {
      const commands: Array<() => Promise<unknown>> = [];
      const pipeline = {
        zadd: (key: string, score: number, member: string) => {
          commands.push(() => redisMock.zadd(key, score, member));
          return pipeline;
        },
        zrem: (key: string, member: string) => {
          commands.push(() => redisMock.zrem(key, member));
          return pipeline;
        },
        del: (key: string) => {
          commands.push(() => redisMock.del(key));
          return pipeline;
        },
        exec: vi.fn(async () =>
          Promise.all(commands.map((command) => command())),
        ),
      };
      return pipeline;
    }),
  };
  return { sortedSets, strings, redisMock };
});

vi.mock('./index', () => ({
  redis: redisMock,
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorBasicsByIdsUnsafe: vi.fn(async (ids: string[]) =>
    ids
      .filter((id) => id !== 'missing-1')
      .map((id) => ({
        id,
        name: id,
        title: null,
        age: 30,
        lifespan: 120,
        realm: id.startsWith('qi-')
          ? '炼气'
          : id.startsWith('golden-') || id === 'cultivator-1'
            ? '金丹'
            : '筑基',
        realm_stage: '初期',
        origin: '散修',
        gender: '男',
        personality: null,
        background: null,
        updatedAt: new Date('2026-06-10T00:00:00.000Z'),
      })),
  ),
}));

import {
  addToRanking,
  addToRankingTailIfVacant,
  getCultivatorRank,
  getRankingList,
  getTopRankingCultivatorIds,
  removeFromAllRankingRealmsExcept,
} from './rankings';

describe('ranking redis helpers', () => {
  beforeEach(() => {
    sortedSets.clear();
    strings.clear();
    vi.clearAllMocks();
  });

  it('keeps battle rankings isolated by realm bucket', async () => {
    await addToRanking('炼气', 'qi-1', 'user-1', 1);
    await addToRanking('筑基', 'foundation-1', 'user-2', 1);

    await expect(getTopRankingCultivatorIds('炼气')).resolves.toEqual(['qi-1']);
    await expect(getTopRankingCultivatorIds('筑基')).resolves.toEqual([
      'foundation-1',
    ]);
    await expect(getCultivatorRank('炼气', 'foundation-1')).resolves.toBeNull();
    await expect(getCultivatorRank('筑基', 'foundation-1')).resolves.toBe(1);
  });

  it('hydrates ranking lists from the requested realm only', async () => {
    await addToRanking('炼气', 'qi-1', 'user-1', 1);
    await addToRanking('筑基', 'foundation-1', 'user-2', 1);

    const list = await getRankingList('筑基');

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 'foundation-1',
      rank: 1,
      realm: '筑基',
    });
  });

  it('removes a cultivator from old realm buckets after breakthrough', async () => {
    await addToRanking('炼气', 'cultivator-1', 'user-1', 1);
    await addToRanking('筑基', 'cultivator-1', 'user-1', 1);
    await addToRanking('金丹', 'cultivator-1', 'user-1', 1);

    await removeFromAllRankingRealmsExcept('cultivator-1', '金丹');

    await expect(getCultivatorRank('炼气', 'cultivator-1')).resolves.toBeNull();
    await expect(getCultivatorRank('筑基', 'cultivator-1')).resolves.toBeNull();
    await expect(getCultivatorRank('金丹', 'cultivator-1')).resolves.toBe(1);
  });

  it('compacts old realm scores after breakthrough removal', async () => {
    await addToRanking('炼气', 'qi-1', 'user-1', 1);
    await addToRanking('炼气', 'qi-2', 'user-2', 2);
    await addToRanking('炼气', 'qi-3', 'user-3', 3);

    await removeFromAllRankingRealmsExcept('qi-1', '筑基');

    expect([...(sortedSets.get('golden_rank:list:炼气') ?? new Map())]).toEqual([
      ['qi-2', 1],
      ['qi-3', 2],
    ]);
    await expect(getRankingList('炼气')).resolves.toMatchObject([
      { id: 'qi-2', rank: 1 },
      { id: 'qi-3', rank: 2 },
    ]);
  });

  it('prunes stale members before displaying or settling rankings', async () => {
    await addToRanking('炼气', 'qi-1', 'user-1', 1);
    await addToRanking('炼气', 'foundation-1', 'user-2', 2);
    await addToRanking('炼气', 'missing-1', 'user-3', 3);
    await addToRanking('炼气', 'qi-2', 'user-4', 4);

    await expect(getRankingList('炼气')).resolves.toMatchObject([
      { id: 'qi-1', rank: 1 },
      { id: 'qi-2', rank: 2 },
    ]);
    await expect(getTopRankingCultivatorIds('炼气')).resolves.toEqual([
      'qi-1',
      'qi-2',
    ]);
    await expect(getCultivatorRank('炼气', 'foundation-1')).resolves.toBeNull();
  });

  it('adds an unranked cultivator to the tail when the ranking has vacancies', async () => {
    await addToRanking('筑基', 'foundation-1', 'user-1', 1);
    await addToRanking('筑基', 'foundation-2', 'user-2', 2);

    await expect(
      addToRankingTailIfVacant('筑基', 'foundation-3'),
    ).resolves.toBe(3);
    await expect(getTopRankingCultivatorIds('筑基')).resolves.toEqual([
      'foundation-1',
      'foundation-2',
      'foundation-3',
    ]);
  });

  it('does not add an unranked cultivator to the tail when the ranking is full', async () => {
    for (let index = 1; index <= 100; index++) {
      await addToRanking('筑基', `foundation-${index}`, `user-${index}`, index);
    }

    await expect(
      addToRankingTailIfVacant('筑基', 'foundation-101'),
    ).resolves.toBeNull();
    await expect(getCultivatorRank('筑基', 'foundation-101')).resolves.toBeNull();
  });
});
