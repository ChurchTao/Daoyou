/**
 * AffixBoundaryValidation.test.ts
 *
 * 词缀边界规则校验测试（平衡三角论）。
 *
 * Part 1: 遍历 DEFAULT_AFFIX_REGISTRY 中的所有词缀，验证现有词缀全部合规。
 * Part 2: 注册违规 mock 词缀，验证 validateBoundary() 能正确拦截。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModifierType } from '../../contracts/battle';
import { GameplayTags } from '@/engine/shared/tag-domain';
import { DEFAULT_AFFIX_REGISTRY, AffixRegistry } from '../../affixes';
import type { AffixDefinition } from '../../affixes';
import { matchAll } from '../../affixes';

/** 构造最小可注册词缀的辅助工厂 */
function makeAffix(overrides: Partial<AffixDefinition>): AffixDefinition {
  return {
    id: 'test-affix',
    displayName: 'Test',
    displayDescription: 'Test affix',
    category: 'skill_core',
    rarity: 'common',
    match: matchAll([]),
    weight: 1,
    energyCost: 1,
    effectTemplate: { type: 'damage', params: { value: 10 } },
    applicableTo: ['skill'],
    ...overrides,
  } as AffixDefinition;
}

describe('AffixBoundaryValidation', () => {
  const allDefs = DEFAULT_AFFIX_REGISTRY.getAll();

  // ===== Part 1: 现有词缀合规性审计 =====

  it('gongfa 词缀禁止使用 OWNER_AS_TARGET scope', () => {
    const violations = allDefs.filter(
      (def) =>
        def.applicableTo.includes('gongfa') &&
        def.listenerSpec?.scope === GameplayTags.SCOPE.OWNER_AS_TARGET,
    );

    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('skill 词缀禁止使用 attribute_modifier effectType', () => {
    const violations = allDefs.filter(
      (def) =>
        def.applicableTo.includes('skill') &&
        def.effectTemplate.type === 'attribute_modifier',
    );

    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('artifact 词缀禁止使用 ADD 百分比 attribute_modifier', () => {
    const violations = allDefs.filter((def) => {
      if (!def.applicableTo.includes('artifact')) {
        return false;
      }

      if (def.effectTemplate.type !== 'attribute_modifier') {
        return false;
      }

      const params = def.effectTemplate.params;
      if ('modifiers' in params) {
        return params.modifiers.some((modifier) => modifier.modType === ModifierType.ADD);
      }

      return params.modType === ModifierType.ADD;
    });

    expect(violations.map((d) => d.id)).toEqual([]);
  });


  it('artifact 词缀禁止使用 OWNER_AS_CASTER scope', () => {
    const violations = allDefs.filter(
      (def) =>
        def.applicableTo.includes('artifact') &&
        def.listenerSpec?.scope === GameplayTags.SCOPE.OWNER_AS_CASTER,
    );

    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('DEFAULT_AFFIX_REGISTRY 应包含所有三种产物类型的词缀', () => {
    const hasArtifact = allDefs.some((d) => d.applicableTo.includes('artifact'));
    const hasGongfa = allDefs.some((d) => d.applicableTo.includes('gongfa'));
    const hasSkill = allDefs.some((d) => d.applicableTo.includes('skill'));
    expect(hasArtifact).toBe(true);
    expect(hasGongfa).toBe(true);
    expect(hasSkill).toBe(true);
  });

  it('no commonAffixes remain (applicableTo 中不再有跨产物类型的词缀)', () => {
    const crossProductAffixes = allDefs.filter(
      (def) =>
        def.applicableTo.includes('artifact') && def.applicableTo.includes('gongfa'),
    );
    expect(crossProductAffixes.map((d) => d.id)).toEqual([]);
  });

  it('池与产物类型强绑定: skill_* 池词缀仅适用于 skill', () => {
    const violations = allDefs.filter(
      (def) =>
        def.category.startsWith('skill_') &&
        def.applicableTo.some((t) => t !== 'skill'),
    );
    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('池与产物类型强绑定: gongfa_* 池词缀仅适用于 gongfa', () => {
    const violations = allDefs.filter(
      (def) =>
        def.category.startsWith('gongfa_') &&
        def.applicableTo.some((t) => t !== 'gongfa'),
    );
    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('池与产物类型强绑定: artifact_* 池词缀仅适用于 artifact', () => {
    const violations = allDefs.filter(
      (def) =>
        def.category.startsWith('artifact_') &&
        def.applicableTo.some((t) => t !== 'artifact'),
    );
    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('稀有池词缀的 rarity 必须为 rare 或 legendary', () => {
    const rarePools = ['skill_rare', 'gongfa_secret', 'artifact_treasure'];
    const violations = allDefs.filter(
      (def) =>
        rarePools.includes(def.category) &&
        def.rarity !== 'rare' &&
        def.rarity !== 'legendary',
    );
    expect(violations.map((d) => d.id)).toEqual([]);
  });

  // ===== Part 2: validateBoundary() 拦截测试 =====

  describe('validateBoundary() 拦截违规词缀', () => {
    it('拦截 pool-product binding 违规: skill_core 词缀不能 applicableTo gongfa', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-pool-binding',
            category: 'skill_core',
            applicableTo: ['gongfa'],
          }),
        ]),
      ).toThrow('pool-product binding violation');
    });

    it('拦截 pool-product binding 违规: artifact_panel 词缀不能 applicableTo skill', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-pool-binding-2',
            category: 'artifact_panel',
            applicableTo: ['skill'],
            effectTemplate: {
              type: 'attribute_modifier',
              params: { attrType: 'ATK' as any, modType: ModifierType.FIXED, value: 10 },
            },
          }),
        ]),
      ).toThrow('pool-product binding violation');
    });

    it('拦截稀有池 rarity 违规: skill_rare 不接受 common', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-rarity',
            category: 'skill_rare',
            rarity: 'common',
            applicableTo: ['skill'],
          }),
        ]),
      ).toThrow('rare pool rarity violation');
    });

    it('拦截稀有池 rarity 违规: gongfa_secret 不接受 uncommon', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-rarity-gongfa',
            category: 'gongfa_secret',
            rarity: 'uncommon',
            applicableTo: ['gongfa'],
          }),
        ]),
      ).toThrow('rare pool rarity violation');
    });

    it('拦截稀有池 rarity 违规: artifact_treasure 不接受 common', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-rarity-artifact',
            category: 'artifact_treasure',
            rarity: 'common',
            applicableTo: ['artifact'],
          }),
        ]),
      ).toThrow('rare pool rarity violation');
    });

    it('稀有池允许 rare rarity', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'ok-rare',
            category: 'skill_rare',
            rarity: 'rare',
            applicableTo: ['skill'],
          }),
        ]),
      ).not.toThrow();
    });

    it('稀有池允许 legendary rarity', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'ok-legendary',
            category: 'gongfa_secret',
            rarity: 'legendary',
            applicableTo: ['gongfa'],
          }),
        ]),
      ).not.toThrow();
    });

    it('拦截 artifact OWNER_AS_CASTER scope', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-artifact-scope',
            category: 'artifact_defense',
            rarity: 'common',
            applicableTo: ['artifact'],
            listenerSpec: {
              scope: GameplayTags.SCOPE.OWNER_AS_CASTER as any,
              trigger: 'ON_TURN_START' as any,
              priority: 50,
            },
          }),
        ]),
      ).toThrow('artifact affix must not use OWNER_AS_CASTER scope');
    });

    it('拦截 gongfa OWNER_AS_TARGET scope', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-gongfa-scope',
            category: 'gongfa_school',
            rarity: 'common',
            applicableTo: ['gongfa'],
            listenerSpec: {
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET as any,
              trigger: 'ON_BEING_HIT' as any,
              priority: 50,
            },
          }),
        ]),
      ).toThrow('gongfa affix must not use OWNER_AS_TARGET scope');
    });

    it('拦截 skill attribute_modifier effectType', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-skill-attr-mod',
            category: 'skill_core',
            applicableTo: ['skill'],
            effectTemplate: {
              type: 'attribute_modifier',
              params: { attrType: 'ATK' as any, modType: ModifierType.ADD, value: 10 },
            },
          }),
        ]),
      ).toThrow('skill affix must not use attribute_modifier effect type');
    });

    it('拦截 gongfa attribute_modifier FIXED modType', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-gongfa-fixed',
            category: 'gongfa_foundation',
            applicableTo: ['gongfa'],
            effectTemplate: {
              type: 'attribute_modifier',
              params: { attrType: 'ATK' as any, modType: ModifierType.FIXED, value: 100 },
            },
          }),
        ]),
      ).toThrow('gongfa affix must not use ModifierType.FIXED');
    });

    it('拦截 gongfa attribute_modifier FIXED modType (modifiers 数组形式)', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-gongfa-fixed-array',
            category: 'gongfa_foundation',
            applicableTo: ['gongfa'],
            effectTemplate: {
              type: 'attribute_modifier',
              params: {
                modifiers: [
                  { attrType: 'ATK' as any, modType: ModifierType.ADD, value: 10 },
                  { attrType: 'DEF' as any, modType: ModifierType.FIXED, value: 50 },
                ],
              },
            },
          }),
        ]),
      ).toThrow('gongfa affix must not use ModifierType.FIXED');
    });

    it('拦截 skill apply_buff 内嵌 OWNER_AS_CASTER listener 且 duration > 1', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'bad-skill-long-buff',
            category: 'skill_variant',
            applicableTo: ['skill'],
            effectTemplate: {
              type: 'apply_buff',
              params: {
                buffConfig: {
                  name: 'test',
                  duration: 3,
                  listeners: [
                    {
                      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
                      trigger: 'ON_TURN_START' as any,
                      effects: [],
                    },
                  ],
                } as any,
              },
            },
          }),
        ]),
      ).toThrow('skill affix must not use apply_buff with OWNER_AS_CASTER listener and duration > 1');
    });

    it('skill apply_buff OWNER_AS_TARGET listener + duration > 1 允许 (DOT/debuff)', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'ok-skill-dot-buff',
            category: 'skill_variant',
            applicableTo: ['skill'],
            effectTemplate: {
              type: 'apply_buff',
              params: {
                buffConfig: {
                  name: 'burn',
                  duration: 3,
                  listeners: [
                    {
                      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                      trigger: 'ON_TURN_START' as any,
                      effects: [],
                    },
                  ],
                } as any,
              },
            },
          }),
        ]),
      ).not.toThrow();
    });

    it('skill apply_buff duration=1 内嵌 listener 允许通过', () => {
      const registry = new AffixRegistry();
      expect(() =>
        registry.register([
          makeAffix({
            id: 'ok-skill-short-buff',
            category: 'skill_variant',
            applicableTo: ['skill'],
            effectTemplate: {
              type: 'apply_buff',
              params: {
                buffConfig: {
                  name: 'test',
                  duration: 1,
                  listeners: [
                    {
                      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
                      trigger: 'ON_TURN_START' as any,
                      effects: [],
                    },
                  ],
                } as any,
              },
            },
          }),
        ]),
      ).not.toThrow();
    });
  });
});
