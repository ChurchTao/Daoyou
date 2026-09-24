import { describe, expect, it } from 'vitest';
import {
  matchSectDeliveryCandidate,
  matchSectDeliveryRequirement,
  matchSectMaterialDeliverySelection,
  projectSectPillTraits,
  type SectMaterialSubmissionFacts,
} from './taskRequirementMatcher';

describe('sect delivery requirement matcher', () => {
  it('matches pill operations projected as stable traits', () => {
    const result = matchSectDeliveryRequirement(
      {
        kind: 'pill',
        quantity: 1,
        minQuality: '灵品',
        family: 'longevity',
        trait: 'increase_lifespan',
        appearance: { mode: 'exact', grade: 'perfect' },
      },
      {
        kind: 'pill',
        id: 'pill-1',
        name: '寿元丹',
        quality: '玄品',
        quantity: 1,
        family: 'longevity',
        appearance: 'perfect',
        traits: ['increase_lifespan'],
      },
    );
    expect(result).toEqual({ eligible: true, violations: [] });
  });

  it('accepts a compound pill when its secondary effect satisfies the requested family trait', () => {
    const traits = projectSectPillTraits({
      operations: [
        {
          type: 'add_status',
          status: 'cultivation_boost',
          usesRemaining: 1,
        },
        {
          type: 'restore_resource',
          resource: 'mp',
          mode: 'percent',
          value: 1,
        },
      ],
    });
    const result = matchSectDeliveryRequirement(
      {
        kind: 'pill',
        quantity: 1,
        minQuality: '真品',
        family: 'mana',
        trait: 'restore_mp',
        appearance: { mode: 'at_least', grade: 'low' },
      },
      {
        kind: 'pill',
        id: 'compound-pill',
        name: '青藤养元丹',
        quality: '地品',
        quantity: 1,
        family: 'cultivation',
        appearance: 'middle',
        traits,
      },
    );

    expect(result).toEqual({ eligible: true, violations: [] });
    expect(traits).toEqual(['gain_cultivation', 'restore_mp']);
  });

  it('projects detox from a negative pill-toxicity operation, not wound removal', () => {
    expect(
      projectSectPillTraits({
        operations: [
          {
            type: 'change_gauge',
            gauge: 'pillToxicity',
            delta: -20,
          },
          { type: 'remove_status', status: 'minor_wound' },
        ],
      }),
    ).toEqual(['detox']);
  });

  it('does not accept high appearance for exact perfect', () => {
    expect(
      matchSectDeliveryRequirement(
        {
          kind: 'pill',
          quantity: 1,
          minQuality: '灵品',
          family: 'healing',
          trait: 'restore_hp',
          appearance: { mode: 'exact', grade: 'perfect' },
        },
        {
          kind: 'pill',
          id: 'pill-1',
          name: '丹药',
          quality: '灵品',
          quantity: 1,
          family: 'healing',
          appearance: 'high',
          traits: ['restore_hp'],
        },
      ).violations.map((item) => item.code),
    ).toContain('appearance_mismatch');
  });

  it('accepts equipment using only level, slot and unequipped state', () => {
    const requirement = {
      kind: 'equipment' as const,
      quantity: 1 as const,
      minEquipmentLevel: 30,
      slot: 'head' as const,
      mustBeUnequipped: true as const,
    };
    const item = {
      kind: 'equipment' as const,
      id: 'equipment-1',
      name: '法冠',
      quantity: 1 as const,
      slot: 'head' as const,
      equipmentLevel: 30,
      isEquipped: false,
    };
    expect(matchSectDeliveryRequirement(requirement, item)).toEqual({
      eligible: true,
      violations: [],
    });
    expect(
      matchSectDeliveryRequirement(requirement, {
        ...item,
        equipmentLevel: 20,
        isEquipped: true,
        slot: 'weapon',
      }).violations.map((v) => v.code),
    ).toEqual(['item_equipped', 'wrong_slot', 'level_too_low']);
  });

  it('allows multiple qualifying material stacks to satisfy one requirement', () => {
    const requirement = {
      kind: 'material' as const,
      quantity: 3,
      minQuality: '灵品' as const,
      materialType: 'ore' as const,
      element: '金' as const,
    };
    const first: SectMaterialSubmissionFacts = {
      kind: 'material',
      id: 'material-1',
      name: '赤铜',
      quality: '玄品',
      quantity: 1,
      materialType: 'ore',
      element: '金',
    };
    const second: SectMaterialSubmissionFacts = {
      kind: 'material',
      id: 'material-2',
      name: '玄铁',
      quality: '玄品',
      quantity: 2,
      materialType: 'ore',
      element: '金',
    };

    expect(matchSectDeliveryCandidate(requirement, first).eligible).toBe(true);
    expect(
      matchSectMaterialDeliverySelection(requirement, [
        { item: first, quantity: 1 },
        { item: second, quantity: 2 },
      ]),
    ).toEqual({ eligible: true, violations: [] });
  });

  it('rejects duplicate, mismatched, insufficient and incorrect-total material selections', () => {
    const requirement = {
      kind: 'material' as const,
      quantity: 3,
      minQuality: '玄品' as const,
      materialType: 'ore' as const,
    };
    const item: SectMaterialSubmissionFacts = {
      kind: 'material',
      id: 'material-1',
      name: '凡铁',
      quality: '灵品',
      quantity: 1,
      materialType: 'herb',
    };
    const codes = matchSectMaterialDeliverySelection(requirement, [
      { item, quantity: 2 },
      { item, quantity: 1 },
    ]).violations.map((violation) => violation.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'quantity_too_high',
        'quality_too_low',
        'wrong_material_type',
        'duplicate_item',
        'total_mismatch',
      ]),
    );
  });
});
