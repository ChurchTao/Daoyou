import { describe, expect, it } from '@jest/globals';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { AffixRegistry } from '@/engine/creation-v2/affixes/AffixRegistry';
import type { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import { BuffType, StackRule } from '@/engine/creation-v2/contracts/battle';
import { CreationTags, GameplayTags } from '@/engine/shared/tag-domain';

function buildAffix(overrides: Partial<AffixDefinition> = {}): AffixDefinition {
  return {
    id: 'test-affix',
    displayName: 'test',
    displayDescription: 'test',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME],
    weight: 1,
    energyCost: 1,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: 10,
        },
      },
    },
    ...overrides,
  };
}

describe('AffixRegistry tag validation', () => {
  it('应拒绝在 tagQuery 中使用运行时标签', () => {
    const registry = new AffixRegistry();

    expect(() =>
      registry.register([
        buildAffix({
          tagQuery: [GameplayTags.ABILITY.FUNCTION.DAMAGE],
        }),
      ]),
    ).toThrow('affix test-affix tagQuery');
  });

  it('应接受合法的作者侧与 runtimeSemantics 组合', () => {
    const registry = new AffixRegistry();

    expect(() =>
      registry.register([
        buildAffix({
          runtimeSemantics: { functions: ['damage'] },
        }),
      ]),
    ).not.toThrow();
  });

  it('默认词缀注册表不应再暴露 legacy inherentTags 字段', () => {
    const lingering = DEFAULT_AFFIX_REGISTRY.getAll().filter(
      (def) => 'inherentTags' in def,
    );

    expect(lingering).toEqual([]);
  });

  it('应拒绝在 buffConfig.tags 中使用 Status 标签', () => {
    const registry = new AffixRegistry();

    expect(() =>
      registry.register([
        buildAffix({
          effectTemplate: {
            type: 'apply_buff',
            params: {
              buffConfig: {
                id: 'test-buff',
                name: 'test-buff',
                type: BuffType.CONTROL,
                duration: 1,
                stackRule: StackRule.OVERRIDE,
                tags: [GameplayTags.STATUS.CONTROL.ROOT],
              },
            },
          },
        }),
      ]),
    ).toThrow('buffConfig.tags');
  });

  it('应拒绝在 buffConfig.statusTags 中使用 Buff 标签', () => {
    const registry = new AffixRegistry();

    expect(() =>
      registry.register([
        buildAffix({
          effectTemplate: {
            type: 'apply_buff',
            params: {
              buffConfig: {
                id: 'test-buff',
                name: 'test-buff',
                type: BuffType.CONTROL,
                duration: 1,
                stackRule: StackRule.OVERRIDE,
                statusTags: [GameplayTags.BUFF.TYPE.CONTROL],
              },
            },
          },
        }),
      ]),
    ).toThrow('buffConfig.statusTags');
  });

  it('应拒绝错层的 triggerTag / targetTag / ability_has_tag 引用', () => {
    const registry = new AffixRegistry();

    expect(() =>
      registry.register([
        buildAffix({
          effectTemplate: {
            type: 'tag_trigger',
            conditions: [
              {
                type: 'ability_has_tag',
                params: { tag: GameplayTags.STATUS.CONTROL.ROOT },
              },
            ],
            params: {
              triggerTag: GameplayTags.ABILITY.FUNCTION.DAMAGE,
              damageRatio: 0.4,
            },
          },
        }),
        buildAffix({
          id: 'test-dispel-affix',
          effectTemplate: {
            type: 'dispel',
            params: {
              targetTag: GameplayTags.STATUS.CATEGORY.DEBUFF,
              maxCount: 1,
            },
          },
        }),
      ]),
    ).toThrow();
  });

  it('应接受层级正确的 buff/status/ability 标签引用', () => {
    const registry = new AffixRegistry();

    expect(() =>
      registry.register([
        buildAffix({
          effectTemplate: {
            type: 'apply_buff',
            conditions: [
              {
                type: 'ability_has_tag',
                params: { tag: GameplayTags.ABILITY.FUNCTION.CONTROL },
              },
            ],
            params: {
              buffConfig: {
                id: 'test-buff',
                name: 'test-buff',
                type: BuffType.CONTROL,
                duration: 1,
                stackRule: StackRule.OVERRIDE,
                tags: [GameplayTags.BUFF.TYPE.CONTROL],
                statusTags: [GameplayTags.STATUS.CONTROL.ROOT],
              },
            },
          },
        }),
      ]),
    ).not.toThrow();
  });
});