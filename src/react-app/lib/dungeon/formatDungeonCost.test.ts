import { describe, expect, it } from 'vitest';
import { formatDungeonCostName } from './formatDungeonCost';

describe('formatDungeonCostName', () => {
  it.each([
    ['tcdb', '灵品以上天材地宝'],
    ['gongfa_manual', '玄品以上功法典籍'],
    ['skill_manual', '真品以上神通秘术'],
  ] as const)('renders material type %s as player-facing text', (type, label) => {
    expect(
      formatDungeonCostName({
        type: 'material',
        value: 1,
        required_type: type,
        required_quality:
          type === 'tcdb' ? '灵品' : type === 'gongfa_manual' ? '玄品' : '真品',
      }),
    ).toBe(label);
  });
});
