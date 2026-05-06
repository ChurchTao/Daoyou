import { describe, expect, it } from '@jest/globals';
import { toFateDisplayModel } from './FateDisplayAdapter';
import type { PreHeavenFate } from '@/types/cultivator';

describe('FateDisplayAdapter', () => {
  it('应生成摘要行与详情分组', () => {
    const fate: PreHeavenFate = {
      name: '剑锋命',
      quality: '天品',
      description: '锋芒入骨，偏于攻伐。',
      tags: ['Material.Semantic.Blade', 'Material.Semantic.Metal'],
      effects: [
        {
          id: '1',
          fragmentId: 'boon_blade_resonance',
          scope: 'creation',
          polarity: 'boon',
          effectType: 'creation_tag_bias',
          value: 0.8,
          tags: ['Material.Semantic.Blade'],
          label: '造物更易引出【锋刃】词缀（极）',
          description: '造物更易引出【锋刃】词缀（极）',
          extreme: 'extreme',
        },
        {
          id: '2',
          fragmentId: 'boon_breakthrough_drive',
          scope: 'breakthrough',
          polarity: 'boon',
          effectType: 'breakthrough_bonus',
          value: 0.05,
          label: '突破成功率 +5%',
          description: '突破成功率 +5%',
          extreme: 'strong',
        },
        {
          id: '3',
          fragmentId: 'burden_world_herb',
          scope: 'world',
          polarity: 'burden',
          effectType: 'reward_type_bias',
          value: 0.78,
          rewardTypes: ['herb'],
          label: '药材类机缘权重 -22%',
          description: '药材类机缘权重 -22%',
          extreme: 'strong',
        },
      ],
    };

    const model = toFateDisplayModel(fate);

    expect(model.previewLines).toContain('造物更易引出【锋刃】词缀（极）');
    expect(model.previewLines).toContain('药材类机缘权重 -22%');
    expect(model.detailGroups.map((group) => group.title)).toEqual(
      expect.arrayContaining(['造物偏置', '修炼收益', '代价反噬']),
    );
    expect(model.coreTags).toEqual(expect.arrayContaining(['锋刃', '金铁']));
  });
});
