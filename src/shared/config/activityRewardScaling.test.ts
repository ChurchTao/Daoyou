import { REALM_VALUES } from '@shared/types/constants';
import {
  allowsActivityUniqueRewardUsageOverride,
  isActivityRewardQualityAllowed,
  resolveActivityRewardQualityCap,
} from './activityRewardScaling';

describe('activity reward quality scaling', () => {
  it.each([
    ['炼气', '玄品', '真品', '地品'],
    ['筑基', '真品', '地品', '天品'],
    ['金丹', '地品', '天品', '仙品'],
    ['元婴', '天品', '仙品', '神品'],
    ['化神', '仙品', '神品', '神品'],
    ['炼虚', '神品', '神品', '神品'],
    ['合体', '神品', '神品', '神品'],
    ['大乘', '神品', '神品', '神品'],
    ['渡劫', '神品', '神品', '神品'],
  ] as const)(
    '%s scales from %s to %s and unique %s',
    (realm, ordinary, interSect, unique) => {
      expect(
        resolveActivityRewardQualityCap({
          realm,
          activityTier: 'ordinary_dungeon',
        }),
      ).toBe(ordinary);
      expect(
        resolveActivityRewardQualityCap({
          realm,
          activityTier: 'inter_sect_tournament',
        }),
      ).toBe(interSect);
      expect(
        resolveActivityRewardQualityCap({
          realm,
          activityTier: 'inter_sect_grand_dungeon',
          slot: 'unique',
        }),
      ).toBe(unique);
    },
  );

  it('keeps ordinary dungeon caps valid for every realm', () => {
    for (const realm of REALM_VALUES) {
      const cap = resolveActivityRewardQualityCap({
        realm,
        activityTier: 'ordinary_dungeon',
      });
      expect(
        isActivityRewardQualityAllowed({
          realm,
          activityTier: 'ordinary_dungeon',
          quality: cap,
        }),
      ).toBe(true);
    }
  });

  it('allows the grand-dungeon usage override only for non-consumable unique rewards', () => {
    expect(
      allowsActivityUniqueRewardUsageOverride({
        activityTier: 'inter_sect_grand_dungeon',
        slot: 'unique',
        rewardKind: 'artifact',
      }),
    ).toBe(true);
    expect(
      allowsActivityUniqueRewardUsageOverride({
        activityTier: 'inter_sect_grand_dungeon',
        slot: 'unique',
        rewardKind: 'consumable',
      }),
    ).toBe(false);
  });
});
