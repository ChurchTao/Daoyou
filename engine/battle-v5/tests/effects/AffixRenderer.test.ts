import { renderAffixLine } from '@/engine/battle-v5/effects/affixText';
import {
  AffixEffectTranslator,
  DEFAULT_AFFIX_REGISTRY,
  type AffixDefinition,
} from '@/engine/creation-v2/affixes';
import type { RolledAffix } from '@/engine/creation-v2/types';
import type { AbilityConfig } from '@/engine/battle-v5/core/configs';
import {
  AbilityType,
  AttributeType,
  ModifierType,
} from '@/engine/battle-v5/core/types';
import { QUALITY_VALUES, type Quality } from '@/types/constants';

function toRolledAffix(
  def: AffixDefinition,
  overrides: Partial<RolledAffix> = {},
): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    description: def.displayDescription,
    category: def.category,
    match: def.match,
    tags: [],
    weight: def.weight,
    energyCost: def.energyCost,
    effectTemplate: def.effectTemplate,
    rollScore: 0,
    rollEfficiency: 0,
    finalMultiplier: 1,
    isPerfect: false,
    ...overrides,
  };
}

describe('renderAffixLine 快照：遍历 DEFAULT_AFFIX_REGISTRY', () => {
  const allDefs = DEFAULT_AFFIX_REGISTRY.getAll();
  const translator = new AffixEffectTranslator();

  it('每条词缀在每个品质下都能渲染出非空文本', () => {
    const empties: string[] = [];
    for (const def of allDefs) {
      for (const quality of QUALITY_VALUES as readonly Quality[]) {
        const rolled = toRolledAffix(def);
        const line = renderAffixLine(rolled, quality);

        expect(line.name).toBe(def.displayName);
        expect(line.rarity).toBe(def.rarity);
        if (
          def.effectTemplate.type !== 'attribute_modifier' &&
          def.effectTemplate.type !== 'random_attribute_modifier'
        ) {
          expect(() => translator.translate(rolled, quality)).not.toThrow();
        }
        if (line.bodyText.length === 0) {
          empties.push(`${def.id}@${quality} (type=${def.effectTemplate.type})`);
        }
      }
    }
    expect(empties).toEqual([]);
  });
});

describe('renderAffixLine 集成用例', () => {
  it('"混元" 在 DamageTakenEvent + owner_as_target 下保持受击主语', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-defense-crit-reflect');
    expect(def).toBeDefined();

    // 真品 qualityOrder=3：ratio = 0.15 + 3 * 0.04 = 0.27
    // 但用户示例想要 34%，那是 finalMultiplier=1.25 的情况；
    // 我们把 finalMultiplier 调到 1.0 先验证结构，再用指定 multiplier 验证 34%。
    const rolled = toRolledAffix(def!, { finalMultiplier: 1.25 });
    // base 0.15 + qualityOrder 5 (天品) * 0.04 = 0.35 ; *1.0 = 35%
    // 用真品 + multiplier 1.25: (0.15 + 3*0.04)=0.27 *1.25 = 0.3375 → 34%
    const line = renderAffixLine(rolled, '真品');

    expect(line.name).toBe('混元');
    expect(line.rarity).toBe('uncommon');
    expect(line.bodyText).toContain('受击后');
    expect(line.bodyText).toContain('被暴击时');
    expect(line.bodyText).toMatch(/反弹\s*34%\s*伤害/);
  });

  it('"噬血" 在 DamageTakenEvent + owner_as_caster 下使用自身主语', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-variant-heal-on-cast');
    expect(def).toBeDefined();

    const line = renderAffixLine(toRolledAffix(def!), '真品');

    expect(line.name).toBe('噬血');
    expect(line.bodyText).toContain('造成伤害后');
    expect(line.bodyText).toContain('转化为气血');
    expect(line.bodyText).not.toContain('受击');
  });

  it('caster/target 条件 scope 应渲染不同主语', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-variant-damage-boost');
    expect(def).toBeDefined();

    const casterScoped = renderAffixLine(
      toRolledAffix(def!, {
        effectTemplate: {
          ...def!.effectTemplate,
          conditions: [{ type: 'hp_below', params: { value: 0.3, scope: 'caster' } }],
        },
      }),
      '真品',
    );
    const targetScoped = renderAffixLine(
      toRolledAffix(def!, {
        effectTemplate: {
          ...def!.effectTemplate,
          conditions: [{ type: 'hp_below', params: { value: 0.3, scope: 'target' } }],
        },
      }),
      '真品',
    );

    expect(casterScoped.bodyText).toContain('自身气血低于30%');
    expect(targetScoped.bodyText).toContain('目标气血低于30%');
  });

  it('"重甲护体" + abilityConfig.modifiers：物防+10、法防+10', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-panel-armor-dual-def');
    expect(def).toBeDefined();

    const abilityConfig: AbilityConfig = {
      slug: 'test',
      name: '重甲护体',
      type: AbilityType.PASSIVE_SKILL,
      modifiers: [
        { attrType: AttributeType.DEF, type: ModifierType.FIXED, value: 10 },
        {
          attrType: AttributeType.MAGIC_DEF,
          type: ModifierType.FIXED,
          value: 10,
        },
      ],
    };

    const rolled = toRolledAffix(def!);
    const line = renderAffixLine(rolled, '真品', { abilityConfig });

    expect(line.name).toBe('重甲护体');
    expect(line.bodyText).toContain('物防 +10');
    expect(line.bodyText).toContain('法防 +10');
    // 属性类词缀不应带"受击时"等监听前缀
    expect(line.bodyText).not.toContain('受击后');
    expect(line.bodyText).not.toContain('被暴击时');
  });

  it('完美标记通过 isPerfect 字段透出', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-defense-crit-reflect');
    const line = renderAffixLine(toRolledAffix(def!, { isPerfect: true }), '真品');
    expect(line.isPerfect).toBe(true);
  });
});
