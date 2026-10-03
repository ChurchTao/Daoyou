import { describe, expect, it } from 'vitest';
import { describeSectFacilityStatus } from './facilityDialogue.js';

const facility = (key: string, level: number) => ({
  key,
  level,
  progress: 0,
  target: level < 5 ? 250 : null,
  maxLevel: 5,
  upgradeable: true,
});

describe('sect facility dialogue projection', () => {
  it('formats facility level and semantic metrics as player-facing Chinese', () => {
    const segments = describeSectFacilityStatus({
      facilityLabel: '灵脉',
      facility: facility('spirit_vein', 3),
      effect: {
        renderer: 'sect.benefit.stipend',
        summary: '周俸灵石提高 15%',
        metrics: [
          {
            key: 'level',
            label: '灵脉等级',
            value: 3,
            format: 'number',
          },
          {
            key: 'stipend_bonus',
            label: '俸禄灵石加成',
            value: 0.15,
            format: 'percent',
          },
        ],
      },
    });
    const text = segments.map((segment) => segment.text).join('');

    expect(text).toContain('灵脉如今是3级');
    expect(text).toContain('俸禄灵石加成15%');
    expect(text).not.toMatch(/spirit_vein|stipend_bonus|renderer|_/u);
  });

  it('preserves zero benefits and falls back when the effect is absent', () => {
    const zeroText = describeSectFacilityStatus({
      facilityLabel: '修炼室',
      facility: facility('cultivation_room', 1),
      effect: {
        renderer: 'sect.benefit.retreat',
        summary: '闭关修为提高 0%',
        metrics: [
          {
            key: 'retreat_bonus',
            label: '闭关修为加成',
            value: 0,
            format: 'percent',
          },
        ],
      },
    })
      .map((segment) => segment.text)
      .join('');
    const fallbackText = describeSectFacilityStatus({
      facilityLabel: '药田',
      facility: facility('herb_garden', 2),
    })
      .map((segment) => segment.text)
      .join('');

    expect(zeroText).toContain('闭关修为加成0%');
    expect(fallbackText).toBe('药田如今是2级。');
  });

  it('drops internal identifiers and invalid metric values', () => {
    const text = describeSectFacilityStatus({
      facilityLabel: 'spirit_vein',
      facility: facility('spirit_vein', 3),
      effect: {
        renderer: 'sect.benefit.unknown',
        summary: 'internal_metric',
        metrics: [
          {
            key: 'internal_metric',
            label: 'internal_metric',
            value: 'unknown_renderer',
            format: 'text',
          },
          {
            key: 'invalid_number',
            label: '无效数值',
            value: Number.NaN,
            format: 'number',
          },
        ],
      },
    })
      .map((segment) => segment.text)
      .join('');

    expect(text).toBe('此处设施如今是3级。');
    expect(text).not.toMatch(
      /spirit_vein|internal_metric|unknown_renderer|renderer|NaN/u,
    );
  });
});
