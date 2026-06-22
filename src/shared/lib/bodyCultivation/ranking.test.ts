import { describe, expect, it } from 'vitest';
import type { CultivatorCondition } from '@shared/types/condition';
import { getBodyCultivationRankingTag } from './ranking';

describe('body cultivation ranking tag', () => {
  it('summarizes body realm and total level for public ranking display', () => {
    const condition = {
      tracks: {
        bodyCultivation: {
          version: 1,
          realm: 'iron_bone',
          milestones: {},
          tracks: {
            skin: { level: 6, progress: 0 },
            sinew_bone: { level: 8, progress: 0 },
            organs: { level: 5, progress: 0 },
            qi_blood: { level: 7, progress: 0 },
            primordial_spirit: { level: 4, progress: 0 },
          },
        },
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
    } as CultivatorCondition;

    expect(getBodyCultivationRankingTag(condition)).toEqual({
      realm: '铁骨',
      totalLevel: 30,
      label: '铁骨 · 肉身 Lv.30',
    });
  });
});
