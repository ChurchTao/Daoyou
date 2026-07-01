import {
  ATTRIBUTE_RESET_TALISMAN_NAME,
  ATTRIBUTE_RESET_TALISMAN_SCENARIO,
} from '@shared/config/attributeResetTalisman';
import {
  AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO,
  FRIEND_MAIL_TALISMAN_SCENARIO,
} from '@shared/config/socialConfig';
import type { Consumable } from '@shared/types/cultivator';
import {
  buildTalismanDetailText,
  getTalismanActionHref,
  getTalismanActionLabel,
  getTalismanUsageHint,
  isAttributeResetTalisman,
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

  it('renders attribute reset talismans as directly usable', () => {
    const item = {
      ...talisman(
        ATTRIBUTE_RESET_TALISMAN_SCENARIO,
        `${ATTRIBUTE_RESET_TALISMAN_NAME}启封后，可令五维归元。`,
      ),
      name: ATTRIBUTE_RESET_TALISMAN_NAME,
    };

    expect(isAttributeResetTalisman(item)).toBe(true);
    expect(getTalismanActionHref(item)).toBeUndefined();
    expect(getTalismanActionLabel(item)).toBe('使用');
    expect(getTalismanUsageHint(item)).toBe(
      '【可在背包中直接使用，重置五维自由分配并返还属性点】',
    );
    expect(buildTalismanDetailText(item)).toContain('用途：重置五维自由分配');
    expect(buildTalismanDetailText(item)).toContain('可在背包中直接使用');
    expect(buildTalismanDetailText(item)).not.toContain(
      ATTRIBUTE_RESET_TALISMAN_SCENARIO,
    );
  });

  it('routes friend mail talismans to the mail scene with a purchase hint', () => {
    const item = talisman(FRIEND_MAIL_TALISMAN_SCENARIO);

    expect(getTalismanActionHref(item)).toBe('/game/mail');
    expect(getTalismanActionLabel(item)).toBe('去传音');
    expect(getTalismanUsageHint(item)).toContain('传音玉简');
    expect(getTalismanUsageHint(item)).toContain('天骄宝阁');
    expect(buildTalismanDetailText(item)).toContain('传音玉简·好友传音');
    expect(buildTalismanDetailText(item)).not.toContain(
      FRIEND_MAIL_TALISMAN_SCENARIO,
    );
  });

  it('routes private auction talismans to the auction scene with a purchase hint', () => {
    const item = talisman(AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO);

    expect(getTalismanActionHref(item)).toBe('/game/auction');
    expect(getTalismanActionLabel(item)).toBe('去上架');
    expect(getTalismanUsageHint(item)).toContain('拍卖行');
    expect(getTalismanUsageHint(item)).toContain('天骄宝阁');
    expect(buildTalismanDetailText(item)).toContain('拍卖行·专属交易');
    expect(buildTalismanDetailText(item)).not.toContain(
      AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO,
    );
  });
});
