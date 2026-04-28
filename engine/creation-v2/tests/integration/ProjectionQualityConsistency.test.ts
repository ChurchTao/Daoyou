import { describe, expect, it } from '@jest/globals';
import { matchAll } from '@/engine/creation-v2/affixes';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import type { RolledAffix } from '@/engine/creation-v2/types';
import type { SkillProductModel } from '@/engine/creation-v2/models/types';
import type { CraftedOutcome } from '@/engine/creation-v2/types';
import { toRow } from '@/engine/creation-v2/persistence/ProductPersistenceMapper';
import { toProductDisplayModel } from '@/components/feature/products';

function toRolledAffix(id: string): RolledAffix {
  const def = DEFAULT_AFFIX_REGISTRY.queryById(id);
  expect(def).toBeDefined();
  return {
    id: def!.id,
    name: def!.displayName,
    category: def!.category,
    energyCost: def!.energyCost,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
    effectTemplate: def!.effectTemplate,
    weight: def!.weight,
    match: def!.match,
    tags: [],
    grantedAbilityTags: def!.grantedAbilityTags,
    exclusiveGroup: def!.exclusiveGroup,
  };
}

describe('ProjectionQuality consistency', () => {
  it('落库 quality 必须等于 productModel.projectionQuality（不受 PBU 反推影响）', () => {
    const affix = toRolledAffix('skill-core-damage');

    const model: SkillProductModel = {
      productType: 'skill',
      slug: 'test-skill',
      name: '测试神通',
      projectionQuality: '玄品',
      outcomeTags: ['Outcome.ActiveSkill'],
      affixes: [affix],
      // 故意制造“高 PBU”以模拟旧逻辑下会反推出更高品质的情况
      balanceMetrics: { pbu: 999, targetTtkBand: '4-10', channels: {
        damage: 0, sustain: 0, defense: 0, control: 0, resource: 0, utility: 0, modifier: 0,
      } },
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: [],
        mpCost: 80,
        cooldown: 2,
        priority: 10,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [],
      },
    };

    const outcome: CraftedOutcome = {
      blueprint: { productType: 'skill', productModel: model },
      // toRow 内不会读取 outcome.ability，这里给个空对象即可
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ability: {} as any,
    };

    const row = toRow(outcome, 'cultivator-1');
    expect(row.quality).toBe('玄品');
  });

  it('展示层应优先读取 productModel.projectionQuality，而非 record.quality', () => {
    const model: SkillProductModel = {
      productType: 'skill',
      slug: 'test-skill',
      name: '测试神通',
      projectionQuality: '真品',
      outcomeTags: ['Outcome.ActiveSkill'],
      affixes: [toRolledAffix('skill-core-damage')],
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: [],
        mpCost: 80,
        cooldown: 2,
        priority: 10,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [],
      },
    };

    const display = toProductDisplayModel({
      productType: 'skill',
      name: 'fallback-name',
      quality: '凡品',
      productModel: model,
    });

    expect(display.quality).toBe('真品');
  });
});

