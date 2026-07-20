import { describe, expect, it } from 'vitest';
import { projectSectCombat, PRODUCTION_SECT_IDS, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';
import { WUXIANG_MODULE, WUXIANG_TECHNIQUE_IDS } from '..';

function state(pathId: 'mirror-karma' | 'demon-crossing', nodes: string[] = []): CultivatorSectState {
  return {
    membershipId: 'w1', sectId: 'wuxiang', status: 'active', contribution: 0,
    configVersion: 1, activePathId: pathId,
    methods: {
      'wuxiang-canon': 100, 'blood-lotus': 100, 'white-bone': 100,
      'wrathful-ming': 100, 'six-senses': 100, 'reed-crossing-method': 100,
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

  it('36个节点都绑定运行时编译行为，且六门共享冷却不随形态改变', () => {
    const expectedCooldowns = new Map([
      ['flower-heart', 0], ['blood-tide', 3], ['three-knocks', 2],
      ['observe-calamity', 4], ['five-skandhas', 3], ['reed-crossing', 5],
    ]);
    for (const path of WUXIANG_MODULE.definition.paths) {
      const pathId = path.id as 'mirror-karma' | 'demon-crossing';
      const snapshot = (sect: CultivatorSectState) => JSON.stringify(
        [...WUXIANG_TECHNIQUE_IDS, 'turn-form', pathId === 'mirror-karma' ? 'mirror-core' : 'demon-core']
          .map((abilityId) => resolveSectAbility({ sect, realm: '化神', abilityId }).config),
      );
      const baseline = snapshot(state(pathId));
      for (const node of path.nodes) {
        const selected = snapshot(state(pathId, [node.id]));
        expect(
          selected,
          `${path.name}/${node.name}没有改变任何运行时配置`,
        ).not.toBe(baseline);
      }
      for (const [abilityId, cooldown] of expectedCooldowns) {
        expect(resolveSectAbility({ sect: state(pathId), realm: '化神', abilityId }).config.cooldown).toBe(cooldown);
      }
    }
  });
});
