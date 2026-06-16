import type { Consumable } from '@shared/types/cultivator';
import {
  buildTalismanDetailText,
  getTalismanUsageHint,
  isQiRestoreTalisman,
} from './talismanDisplay';

function talisman(scenario: string, description?: string): Consumable {
  return {
    id: 'talisman-1',
    name: '中聚灵符',
    type: '符箓',
    quality: '仙品',
    quantity: 1,
    description,
    spec: {
      kind: 'talisman',
      scenario,
      sessionMode: 'consume_on_action',
      notes: '',
    },
  };
}

describe('talisman display helpers', () => {
  it('marks qi restore talismans as directly usable', () => {
    expect(isQiRestoreTalisman(talisman('qi_restore_medium'))).toBe(true);
    expect(isQiRestoreTalisman(talisman('fate_reshape'))).toBe(false);
  });

  it('renders qi restore talismans without internal scenario codes', () => {
    const item = talisman(
      'qi_restore_medium',
      '符中汇聚一团天地元息，使用后可恢复 100 点天地灵气。',
    );

    expect(getTalismanUsageHint(item)).toBe(
      '【可在背包中直接使用，恢复 100 点天地灵气】',
    );
    expect(buildTalismanDetailText(item)).toBe(
      [
        '用途：恢复 100 点天地灵气',
        '使用方式：可在背包中直接使用',
        '符中汇聚一团天地元息，使用后可恢复 100 点天地灵气。',
      ].join('\n'),
    );
    expect(buildTalismanDetailText(item)).not.toContain('qi_restore_medium');
    expect(buildTalismanDetailText(item)).not.toContain('consume_on_action');
  });
});
