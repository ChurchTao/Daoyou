import { describe, expect, it } from 'vitest';
import {
  formatDungeonCostBodyCultivationFeedback,
  formatDungeonCostName,
} from './formatDungeonCost';

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

describe('formatDungeonCostBodyCultivationFeedback', () => {
  it('renders body cultivation trigger text from resource loss metadata', () => {
    expect(
      formatDungeonCostBodyCultivationFeedback({
        type: 'hp_loss',
        value: 0.2,
        metadata: {
          bodyCultivation: {
            preventedLoss: 20,
            triggerText: '肉身炼体生效：已抵消 20 点气血损耗',
          },
        },
      }),
    ).toBe('肉身炼体生效：已抵消 20 点气血损耗');
  });

  it('falls back to prevented loss when trigger text is absent', () => {
    expect(
      formatDungeonCostBodyCultivationFeedback({
        type: 'mp_loss',
        value: 0.15,
        metadata: {
          bodyCultivation: {
            preventedLoss: 12,
          },
        },
      }),
    ).toBe('肉身炼体生效：已抵消 12 点损耗');
  });

  it('renders typed dungeon-event body cultivation feedback without extra UI text', () => {
    expect(
      formatDungeonCostBodyCultivationFeedback({
        type: 'hp_loss',
        value: 0.1,
        metadata: {
          bodyCultivation: {
            eventType: 'erosion',
            track: 'skin',
            trackLabel: '皮肤',
            preventedLoss: 10,
            triggerText: '皮肤生效：降低外邪侵蚀，已抵消 10 点气血损耗',
          },
        },
      }),
    ).toBe('皮肤生效：降低外邪侵蚀，已抵消 10 点气血损耗');
  });
});
