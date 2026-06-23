import { describe, expect, it } from 'vitest';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { matchAll } from '@shared/engine/creation-v2/affixes';
import { AffixPicker } from '@shared/engine/creation-v2/affixes/AffixPicker';
import { AffixRollEngine } from '@shared/engine/creation-v2/affixes/AffixRollEngine';
import { AffixSelector } from '@shared/engine/creation-v2/affixes/AffixSelector';
import type {
  AffixCandidate,
  AffixSlot,
  CreationIntent,
  EnergyBudget,
} from '@shared/engine/creation-v2/types';

function candidate(
  id: string,
  slot: AffixSlot,
  grantedAbilityTags: string[],
): AffixCandidate {
  return {
    id,
    name: id,
    slot,
    rarity: slot === 'core' ? 'common' : 'rare',
    match: matchAll([]),
    tags: [],
    weight: 10,
    energyCost: 5,
    grantedAbilityTags,
    effectTemplate: {
      type: 'damage',
      params: { value: { base: 10 } },
    },
  } as AffixCandidate;
}

function budget(): EnergyBudget {
  return {
    baseTotal: 60,
    effectiveTotal: 60,
    reserved: 0,
    spent: 0,
    remaining: 60,
    allocations: [],
    sources: [],
  };
}

const skillIntent: CreationIntent = {
  productType: 'skill',
  dominantTags: [],
};

describe('AffixSelector', () => {
  it('应过滤与已选技能主伤害频道冲突的后续词缀，但允许 TRUE 附加伤害', () => {
    const selector = new AffixSelector(
      undefined,
      new AffixPicker(() => 0),
      new AffixRollEngine(() => 0.5),
    );

    const audit = selector.select(
      [
        candidate('core-physical', 'core', [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ]),
        candidate('rare-magic', 'modifier', [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
        ]),
        candidate('rare-true', 'modifier', [GameplayTags.ABILITY.CHANNEL.TRUE]),
        candidate('rare-physical', 'modifier', [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ]),
      ],
      budget(),
      skillIntent,
      3,
    );

    expect(audit.affixes.map((affix) => affix.id)).toEqual([
      'core-physical',
      'rare-true',
      'rare-physical',
    ]);
    expect(audit.rounds[1].inputCandidates.map((affix) => affix.id)).toEqual([
      'rare-magic',
      'rare-true',
      'rare-physical',
    ]);
    expect(audit.rounds[1].decision.candidatePool.map((affix) => affix.id)).toEqual([
      'rare-true',
      'rare-physical',
    ]);
    expect(audit.rounds[1].decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'rare-magic',
          reason: 'ability_tag_conflict',
        }),
      ]),
    );
  });
});
