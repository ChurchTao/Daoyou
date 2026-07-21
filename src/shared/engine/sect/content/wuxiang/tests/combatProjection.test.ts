import { describe, expect, it } from 'vitest';
import { projectSectCombat, PRODUCTION_SECT_IDS, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';
import { WUXIANG_MODULE, WUXIANG_TECHNIQUE_IDS } from '..';

function containsSubset(value: unknown, subset: unknown): boolean {
  if (subset === null || typeof subset !== 'object') return Object.is(value, subset);
  if (Array.isArray(subset)) {
    return Array.isArray(value) && subset.every((expected) =>
      value.some((actual) => containsSubset(actual, expected)));
  }
  if (Array.isArray(value)) return value.some((child) => containsSubset(child, subset));
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const expected = subset as Record<string, unknown>;
  const direct = Object.entries(expected).every(([key, child]) =>
    key in record && containsSubset(record[key], child));
  if (direct) return true;
  return Object.values(record).some((child) => containsSubset(child, subset));
}

function state(pathId: 'mirror-karma' | 'demon-crossing', nodes: string[] = []): CultivatorSectState {
  return {
    membershipId: 'w1', sectId: 'wuxiang', status: 'active', contribution: 0,
    configVersion: 1, activePathId: pathId,
    methods: {
      'wuxiang-canon': 5, 'blood-lotus': 3, 'white-bone': 3,
      'wrathful-ming': 3, 'six-senses': 3, 'reed-crossing-method': 3,
    },
    paths: [{
      pathId, unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire',
      activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: nodes, version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['turn-form', 'blood-tide', 'three-knocks', 'observe-calamity'],
  };
}

describe('无相禅宗战斗投影', () => {
  it('作为独立宗门进入生产目录，并保持双道途各六层三选一', () => {
    expect(PRODUCTION_SECT_IDS).toContain('wuxiang');
    expect(WUXIANG_MODULE.definition.paths).toHaveLength(2);
    for (const path of WUXIANG_MODULE.definition.paths) {
      expect(path.layers).toHaveLength(6);
      expect(path.nodes).toHaveLength(18);
      expect(path.tactics).toHaveLength(3);
      for (const layer of path.layers) {
        expect(path.nodes.filter((node) => node.layerId === layer.id)).toHaveLength(3);
      }
    }
  });

  it.each(['mirror-karma', 'demon-crossing'] as const)(
    '%s的六门神通均编译出佛、魔一式、魔二式与无相式',
    (pathId) => {
      const sect = state(pathId);
      const projection = projectSectCombat({ sect, realm: '化神' })!;
      expect(projection.resources[0]).toMatchObject({ name: '战意', initial: 0, max: 6 });
      expect(projection.selectionStrategy).toBeDefined();
      for (const abilityId of WUXIANG_TECHNIQUE_IDS) {
        const detail = resolveSectAbility({ sect, realm: '化神', abilityId });
        const variants = detail.config.variants ?? [];
        expect(variants).toHaveLength(4);
        expect(variants.filter((variant) => variant.id.includes('formless'))).toHaveLength(1);
        expect(variants.filter((variant) =>
          variant.id.startsWith('mirror.demon.') ||
          variant.id.startsWith('demon.entry.') ||
          variant.id.startsWith('demon.finish.'),
        )).toHaveLength(2);
        for (const variant of variants) {
          expect(variant.costs?.[0]).toMatchObject({ resource: 'hp', mode: 'current_hp_ratio', retain: 1 });
        }
      }
    },
  );

  it.each([
    ['mirror-karma', 'flower-heart', ['拈花叩心', '花落问罪', '花落问罪', '心花两忘'], [0.05, 0.05, 0.05, 0.08]],
    ['mirror-karma', 'blood-tide', ['血海听潮', '血海回澜', '血海回澜', '海月同潮'], [0.08, 0.06, 0.06, 0.10]],
    ['mirror-karma', 'three-knocks', ['三叩业门', '业门倒叩', '业门倒叩', '门内无人'], [0.07, 0.07, 0.07, 0.11]],
    ['mirror-karma', 'observe-calamity', ['闭目观劫', '开眼见劫', '开眼见劫', '劫相俱寂'], [0.10, 0.06, 0.06, 0.12]],
    ['mirror-karma', 'five-skandhas', ['照见五蕴', '五蕴还照', '五蕴还照', '五蕴皆空'], [0.06, 0.06, 0.06, 0.09]],
    ['mirror-karma', 'reed-crossing', ['一苇横江', '一苇倒渡', '一苇倒渡', '此岸非岸'], [0.08, 0.07, 0.07, 0.11]],
    ['demon-crossing', 'flower-heart', ['拈花叩心', '摘心问魔', '摘心问魔', '心魔两忘'], [0.06, 0.05, 0.05, 0.09]],
    ['demon-crossing', 'blood-tide', ['血海听潮', '血海倒悬', '血海倒悬', '血海无涯'], [0.14, 0.07, 0.07, 0.16]],
    ['demon-crossing', 'three-knocks', ['三叩业门', '三叩魔关', '三叩魔关', '业门无生'], [0.09, 0.08, 0.08, 0.13]],
    ['demon-crossing', 'observe-calamity', ['闭目观劫', '开眼见魔', '开眼见魔', '劫火自明'], [0.11, 0.06, 0.06, 0.12]],
    ['demon-crossing', 'five-skandhas', ['照见五蕴', '焚尽五蕴', '焚尽五蕴', '蕴空身在'], [0.07, 0.06, 0.06, 0.10]],
    ['demon-crossing', 'reed-crossing', ['一苇横江', '一苇渡厄', '一苇渡厄', '苦海无舟'], [0.10, 0.06, 0.06, 0.12]],
  ] as const)(
    '%s/%s的四形名称与气血成本与设计表一致',
    (pathId, abilityId, names, costs) => {
      const variants = resolveSectAbility({ sect: state(pathId), realm: '化神', abilityId }).config.variants ?? [];
      const ordered = pathId === 'mirror-karma'
        ? [
            variants.find((variant) => variant.id === `mirror.buddha.${abilityId}`),
            variants.find((variant) => variant.id === `mirror.demon.1.${abilityId}`),
            variants.find((variant) => variant.id === `mirror.demon.2.${abilityId}`),
            variants.find((variant) => variant.id === `mirror.formless.${abilityId}`),
          ]
        : [
            variants.find((variant) => variant.id === `demon.buddha.${abilityId}`),
            variants.find((variant) => variant.id === `demon.entry.${abilityId}`),
            variants.find((variant) => variant.id === `demon.finish.${abilityId}`),
            variants.find((variant) => variant.id === `demon.formless.${abilityId}`),
          ];
      expect(ordered.map((variant) => variant?.name)).toEqual([...names]);
      expect(ordered.every((variant) => Boolean(variant?.description))).toBe(true);
      expect(ordered.map((variant) => variant?.costs?.[0]?.mode === 'current_hp_ratio'
        ? variant.costs[0].ratio
        : undefined)).toEqual([...costs]);
    },
  );

  it('魔心无相的数值条款默认80%，佛魔同炉恢复100%，离散状态操作不变', () => {
    const variant = (nodes: string[], abilityId: string) =>
      resolveSectAbility({ sect: state('demon-crossing', nodes), realm: '化神', abilityId })
        .config.variants!.find((entry) => entry.id === `demon.formless.${abilityId}`)!;
    const damageCoefficients = (effects: NonNullable<ReturnType<typeof variant>['effects']>) =>
      effects.filter((effect) => effect.type === 'damage').map((effect) =>
        effect.type === 'damage' ? effect.params.value.coefficient : undefined);

    expect(damageCoefficients(variant([], 'three-knocks').effects!)).toEqual([0.36, 0.36, 0.64]);
    expect(damageCoefficients(variant(['demon-one-furnace'], 'three-knocks').effects!)).toEqual([0.45, 0.45, 0.8]);
    expect(damageCoefficients(variant([], 'reed-crossing').effects!)).toEqual([0.8, 0.4]);
    expect(damageCoefficients(variant(['demon-one-furnace'], 'reed-crossing').effects!)).toEqual([1, 0.5]);

    const baselineSkandhas = variant([], 'five-skandhas').effects!;
    const completeSkandhas = variant(['demon-one-furnace'], 'five-skandhas').effects!;
    expect(baselineSkandhas.filter((effect) => effect.type === 'status_transfer')).toHaveLength(2);
    expect(completeSkandhas.filter((effect) => effect.type === 'status_transfer')).toHaveLength(2);
  });

  it('现报无迟同步强化无相式中的现报伤害组成', () => {
    const noform = (abilityId: string) => resolveSectAbility({
      sect: state('mirror-karma', ['mirror-fast-fruit']), realm: '化神', abilityId,
    }).config.variants!.find((entry) => entry.id === `mirror.formless.${abilityId}`)!;
    const directCoefficient = (abilityId: string) => {
      const damage = noform(abilityId).effects!.find((effect) => effect.type === 'damage');
      return damage?.type === 'damage' ? damage.params.value.coefficient : undefined;
    };
    const knocks = noform('three-knocks').effects!.find((effect) =>
      effect.type === 'consume_status_trigger');
    const observeDemon = resolveSectAbility({
      sect: state('mirror-karma', ['mirror-fast-fruit']),
      realm: '化神',
      abilityId: 'observe-calamity',
    }).config.variants!.find((entry) => entry.id === 'mirror.demon.1.observe-calamity')!;
    const observePresentSegments = observeDemon.effects!
      .filter((effect) => effect.type === 'consume_status_trigger')
      .flatMap((effect) => effect.type === 'consume_status_trigger'
        ? effect.params.effects.filter((child) => child.type === 'damage')
        : [])
      .map((effect) => effect.type === 'damage' ? effect.params.value.coefficient : undefined);

    expect(directCoefficient('flower-heart')).toBe(1.3);
    expect(directCoefficient('observe-calamity')).toBe(1.55);
    expect(knocks?.type === 'consume_status_trigger'
      ? knocks.params.effects[0]
      : undefined).toMatchObject({ type: 'damage', params: { value: { coefficient: 0.65 } } });
    expect(observePresentSegments).toEqual([0.42, 0.42, 0.42]);
  });

  it('转相在3至5战意显示魔相入身，6战意显示一念无间并占用行动', () => {
    const detail = resolveSectAbility({ sect: state('mirror-karma'), realm: '化神', abilityId: 'turn-form' });
    expect(detail.config.variants?.map((variant) => variant.name)).toEqual(['一念无间', '魔相入身']);
    expect(detail.config.variants?.map((variant) => variant.costs?.[0])).toEqual([
      expect.objectContaining({ ratio: 0.08 }),
      expect.objectContaining({ ratio: 0.04 }),
    ]);
    expect(detail.config.variants?.every((variant) => variant.castEffects?.some((effect) => effect.type === 'ability_mode'))).toBe(true);
  });

  it('节点改变循环规则投影，不改变固定冷却', () => {
    const selected = ['mirror-vow-body', 'mirror-fourth-knock', 'mirror-formless-two'];
    const sect = state('mirror-karma', selected);
    const flower = resolveSectAbility({ sect, realm: '化神', abilityId: 'flower-heart' });
    const knocks = resolveSectAbility({ sect, realm: '化神', abilityId: 'three-knocks' });
    expect(flower.config.cooldown).toBe(0);
    expect(knocks.config.cooldown).toBe(2);
    expect(flower.config.variants?.some((variant) => variant.id === 'mirror.buddha.first.flower-heart')).toBe(true);
    const noform = flower.config.variants?.find((variant) => variant.id === 'mirror.formless.flower-heart');
    expect(noform?.costs?.[0]).toMatchObject({ ratio: 0.1 });
  });

  it('36个节点逐项编译出对应循环行为，且六门共享冷却不随形态改变', () => {
    const expectedCooldowns = new Map([
      ['flower-heart', 0], ['blood-tide', 3], ['three-knocks', 2],
      ['observe-calamity', 4], ['five-skandhas', 3], ['reed-crossing', 5],
    ]);
    const signatures: Record<string, unknown[]> = {
      'mirror-vow-body': [{ id: 'mirror.buddha.first.flower-heart', costs: [{ ratio: 0.07 }] }, { key: 'sect.wuxiang.mirror.vow-round' }],
      'mirror-guest-in-mirror': [{ id: 'sect.wuxiang.mirror.guest-round', budget: { reset: 'round' } }],
      'mirror-fruit-in-time': [{ maxHpRatioPerAction: 0.16 }],
      'mirror-loud-flower': [{ id: 'sect.wuxiang.mirror.heart-vow.trigger', effects: [{ params: { value: 0.18 } }] }],
      'mirror-welcome-tide': [{ type: 'damage_defer', params: { ratio: 0.4 } }],
      'mirror-fourth-knock': [{ id: 'sect.wuxiang.mirror.karma-door', maxLayers: 4 }],
      'mirror-see-guest': [{ id: 'sect.wuxiang.mirror.observe.first', effects: [{ params: { value: 0.5 } }] }],
      'mirror-skandhas-mark': [{ id: 'mirror.buddha.five-skandhas', effects: [{ type: 'status_transfer', params: { effects: [{ type: 'apply_buff' }, { type: 'apply_buff' }] } }] }],
      'mirror-carry-karma': [{ type: 'damage_cap', params: { maxHpRatio: 0.25 } }],
      'mirror-form-beyond': [{ id: 'sect.wuxiang.mirror.stillness.reduce', effects: [{ params: { value: 0.35 } }] }],
      'mirror-back-demon': [{ id: 'mirror.demon.1.flower-heart', effects: [{ type: 'ability_lock' }] }],
      'mirror-formless-two': [{ id: 'mirror.formless.flower-heart', costs: [{ ratio: 0.1 }] }, { operation: 'set', layers: 2 }],
      'mirror-full-light': [{ id: 'sect.wuxiang.mirror.reflect', effects: [{ type: 'reflect', params: { ratio: 0.05 }, conditions: [{ type: 'buff_layer_at_least', params: { value: 3 } }] }] }],
      'mirror-fast-fruit': [{ id: 'mirror.demon.1.flower-heart', effects: [{ type: 'damage', params: { value: { coefficient: 0.55 } } }] }],
      'mirror-return-source': [{ type: 'consume_status_trigger', params: { effects: [{ type: 'heal', params: { value: { targetMaxHpRatio: 0.02 } } }] } }],
      'mirror-not-platform': [{ id: 'sect.wuxiang.mirror.full-reduce', effects: [{ params: { value: 0.1 } }] }],
      'mirror-all-karma': [{ type: 'consume_status_trigger', params: { consume: 2, scaleNumericEffectsByLayer: true } }],
      'mirror-return-thought': [{ id: 'mirror.buddha.return-thought.flower-heart', costs: [{ ratio: 0.08 }] }, { resourceId: 'sect.wuxiang.war-intent', amount: 2 }],
      'demon-blood-oil': [{ id: 'demon.buddha.first.flower-heart', costs: [{ ratio: 0.08 }] }, { key: 'sect.wuxiang.demon.oil-round' }],
      'demon-three-shores': [{ id: 'sect.wuxiang.demon.threshold.0.7', effects: [{ type: 'shield', params: { value: { targetMaxHpRatio: 0.02 } } }] }],
      'demon-bone-tide': [{ id: 'sect.wuxiang.demon.blood-store', effects: [{ type: 'damage_memory', params: { maxStoredValue: { coefficient: 0.22 } } }] }],
      'demon-flower-inward': [{ id: 'sect.wuxiang.demon.heart-gap.damage', effects: [{ params: { value: 0.25 } }] }],
      'demon-no-return-tide': [{ id: 'demon.entry.blood-tide', effects: [{ type: 'damage_memory', params: { ratio: 2.5 } }] }],
      'demon-third-outside': [{ id: 'demon.buddha.three-knocks', effects: [{ conditions: [{ params: { value: 0.55, timing: 'cast' } }] }] }],
      'demon-slow-fire': [{ id: 'demon.buddha.observe-calamity', effects: [{ type: 'apply_buff', params: { buffConfig: { listeners: [{ effects: [{ type: 'damage_defer', params: { ratio: 0.5 } }] }] } } }] }],
      'demon-skandhas-fuel': [{ id: 'demon.entry.five-skandhas', effects: [{ type: 'status_transfer', params: { maxCount: 3 } }] }],
      'demon-short-reed': [{ id: 'demon.buddha.reed-crossing', effects: [{ type: 'apply_buff', params: { buffConfig: { listeners: [{ effects: [{ type: 'damage_cap', params: { maxHpRatio: 0.3 } }] }] } } }] }],
      'demon-first-thought': [{ id: 'demon.entry.three-knocks', effects: [{ type: 'damage', params: { value: { coefficient: 0.5175 } } }] }],
      'demon-second-shore': [{ id: 'demon.finish.three-knocks', effects: [{ type: 'damage', params: { value: { coefficient: 0.96 } } }] }, { id: 'sect.wuxiang.demon.blood-finish-lifesteal', effects: [{ params: { ratio: 0.23 } }] }],
      'demon-two-gates': [{ id: 'demon.finish.flower-heart.different', costs: [{ ratio: 0.025 }] }],
      'demon-body-breaks': [{ id: 'sect.wuxiang.demon.body-breaks.hp', eventType: 'HpChangedEvent' }, { attrType: 'controlResistance', value: 0.3 }],
      'demon-blood-empty': [{ id: 'sect.wuxiang.demon.threshold.0.25', effects: [{ type: 'shield', params: { value: { targetMaxHpRatio: 0.06 } } }] }],
      'demon-leave-boat': [{ id: 'demon.buddha.leave-boat.flower-heart', costs: [{ ratio: 0.03 }] }],
      'demon-one-furnace': [{ id: 'demon.formless.three-knocks', effects: [{ type: 'damage', params: { value: { coefficient: 0.8 } } }] }],
      'demon-no-gap': [{ id: 'sect.wuxiang.demon.enter.reduce', effects: [{ params: { value: 0 } }] }, { maxHpRatioPerAction: 0.12 }],
      'demon-look-back': [{ id: 'demon.finish.flower-heart', effects: [{ type: 'heal', params: { value: { targetMaxHpRatio: 0.05 } } }] }, { id: 'demon.formless.flower-heart', effects: [{ type: 'heal', params: { value: { targetMaxHpRatio: 0.05 } } }] }],
    };
    for (const path of WUXIANG_MODULE.definition.paths) {
      const pathId = path.id as 'mirror-karma' | 'demon-crossing';
      for (const node of path.nodes) {
        const configs = [...WUXIANG_TECHNIQUE_IDS, 'turn-form', pathId === 'mirror-karma' ? 'mirror-core' : 'demon-core']
          .map((abilityId) => resolveSectAbility({ sect: state(pathId, [node.id]), realm: '化神', abilityId }).config);
        for (const signature of signatures[node.id] ?? []) {
          expect(
            containsSubset(configs, signature),
            `${path.name}/${node.name}缺少对应的行为契约 ${JSON.stringify(signature)}`,
          ).toBe(true);
        }
      }
      for (const [abilityId, cooldown] of expectedCooldowns) {
        expect(resolveSectAbility({ sect: state(pathId), realm: '化神', abilityId }).config.cooldown).toBe(cooldown);
      }
    }
  });
});
