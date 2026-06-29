import { describe, expect, it } from 'vitest';
import type { ItemRankingEntry } from '@shared/types/rankings';
import { toRankingDetailItem } from './rankingDetailItem';

function createRankingItem(
  itemType: ItemRankingEntry['itemType'],
): ItemRankingEntry {
  return {
    id: `${itemType}-1`,
    rank: 1,
    name: '榜上造物',
    itemType,
    quality: '玄品',
    ownerName: '道友',
    score: 1234,
    description: '榜上留名。',
    element: '火',
  };
}

describe('toRankingDetailItem', () => {
  it('preserves creation product scores for detail modals', () => {
    const artifact = toRankingDetailItem({
      ...createRankingItem('artifact'),
      slot: 'weapon',
    });
    const skill = toRankingDetailItem({
      ...createRankingItem('skill'),
      cooldown: 1,
    });
    const technique = toRankingDetailItem(createRankingItem('technique'));

    expect(artifact.kind).toBe('artifact');
    expect(artifact.item.score).toBe(1234);
    expect(skill.kind).toBe('skill');
    expect(skill.item.score).toBe(1234);
    expect(technique.kind).toBe('gongfa');
    expect(technique.item.score).toBe(1234);
  });
});
