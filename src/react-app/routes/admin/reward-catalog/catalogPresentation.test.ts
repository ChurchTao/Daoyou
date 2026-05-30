import { createEmptyDraftItem } from './catalogDraft';
import {
  applyTalismanQuickPreset,
  getTalismanScenarioAlias,
} from './catalogPresentation';

describe('reward catalog presentation helpers', () => {
  it('applies the legacy fate reshape talisman preset', () => {
    const item = createEmptyDraftItem('consumable');

    const next = applyTalismanQuickPreset(item, 'talisman_reshape_fate');

    expect(next).toMatchObject({
      id: 'talisman_reshape_fate',
      name: '天机逆命符',
      consumableType: '符箓',
      quality: '仙品',
      description:
        '以此符遮蔽天机，逆转先天之数。前往命格重塑页后，点击开启会直接消耗 1 张，并抽出新的命格候选。',
      spec: {
        kind: 'talisman',
        scenario: 'fate_reshape',
        sessionMode: 'consume_on_action',
        notes: '前往命格重塑页，点击开启后直接消耗。',
      },
    });
  });

  it('keeps an existing catalog id when applying a quick preset', () => {
    const item = createEmptyDraftItem('consumable');
    item.id = 'ops_custom_skill_talisman';

    const next = applyTalismanQuickPreset(item, 'talisman_draw_skill');

    expect(next.id).toBe('ops_custom_skill_talisman');
    expect(next.name).toBe('神通衍化符');
    expect(next.spec.kind).toBe('talisman');
    if (next.spec.kind !== 'talisman') {
      throw new Error('expected talisman draft');
    }
    expect(next.spec.scenario).toBe('draw_skill');
  });

  it('maps known talisman scenarios to readable labels', () => {
    expect(getTalismanScenarioAlias('draw_gongfa')).toBe('问法寻卷·功法抽取');
    expect(getTalismanScenarioAlias('fate_reshape')).toBe('命格重塑');
    expect(getTalismanScenarioAlias('custom_scene')).toBe('custom_scene');
  });
});
