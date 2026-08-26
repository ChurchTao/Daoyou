import { getRealmStageAttributeBudget } from '@shared/config/realmProgression';
import {
  createCombatUnitFromCultivator,
  type CultivatorCombatInput,
} from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_SECTS } from './productionRuntime';

const EXPECTED_PRESETS = {
  lingxiao: {
    name: '听剑老人·试炼化身',
    description: '执一柄旧剑立于场中，只问弟子的剑为何而出。',
    pathId: 'swift-sword',
    tacticId: 'aggressive',
    methodIds: [
      'lingxiao-canon',
      'sword-guidance',
      'void-step',
      'edge-cleansing',
      'origin-returning',
      'sword-nurturing',
    ],
    abilityLoadout: [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      'sect-ultimate',
    ],
    artifactNames: ['照尘古剑', '藏锋剑衣', '澄心剑珏'],
  },
  tianyan: {
    name: '观澜真人·试炼化身',
    description: '以河洛法印推演战局，步步逼问弟子的下一着。',
    pathId: 'hetu-evolution',
    tacticId: 'small-cycle',
    methodIds: [
      'tianyan-canon',
      'wood-vitality',
      'fire-illumination',
      'earth-bearing',
      'metal-severing',
      'water-flowing',
    ],
    abilityLoadout: [
      'verdant-pulse',
      'flowing-flame',
      'dark-water-return',
      'shift-palace',
    ],
    artifactNames: ['太白演星尺', '坤舆法袍', '河洛定盘'],
  },
  wuxiang: {
    name: '空慈方丈·试炼化身',
    description: '佛魔二相同现，以色身与业火检验来者道心。',
    pathId: 'mirror-karma',
    tacticId: 'guard',
    methodIds: [
      'wuxiang-canon',
      'blood-lotus',
      'white-bone',
      'wrathful-ming',
      'six-senses',
      'reed-crossing-method',
    ],
    abilityLoadout: [
      'turn-form',
      'blood-tide',
      'three-knocks',
      'observe-calamity',
    ],
    artifactNames: ['降魔金刚杵', '白骨莲衣', '明镜心珠'],
  },
  youdu: {
    name: '归魂婆婆·试炼化身',
    description: '携魂灯立于忘川影中，以蚀魂与镇魄逼人守住本心。',
    pathId: 'tide',
    tacticId: 'tide-cycle',
    methodIds: [
      'youdu-canon',
      'three-souls-separation',
      'forgetful-river-record',
      'seven-souls-seizure',
      'soul-pinning-ironbook',
      'dead-heart-living-spirit',
    ],
    abilityLoadout: [
      'soul-severing-call',
      'forgetful-river-tide',
      'pin-soul',
      'soul-shall-not-return',
    ],
    artifactNames: ['镇魂玄铁令', '忘川夜衣', '引魂灯佩'],
  },
  jiujie: {
    name: '九劫宫主·试炼化身',
    description: '执劫簿立于雷池中央，以行动问罪，以九霄清算。',
    pathId: 'calamity-eye',
    tacticId: 'bear-and-return',
    methodIds: ['jiujie-canon', 'calamity-eye', 'heavenly-record', 'thunder-prison', 'cause-judgment', 'crossing-calamity'],
    abilityLoadout: ['heaven-hearing', 'receive-calamity', 'thunder-prison-question', 'nine-sky-settlement'],
    artifactNames: ['劫簿天简', '渡厄雷环', '九门宫印'],
  },
} as const;

const ARTIFACT_AFFIX_IDS = [
  [
    'artifact-panel-weapon-dual-atk',
    'artifact-panel-spirit',
    'artifact-weapon-blood-drinker',
  ],
  [
    'artifact-panel-armor-dual-def',
    'artifact-panel-vitality',
    'artifact-defense-death-prevent',
  ],
  [
    'artifact-panel-accessory-utility',
    'artifact-panel-willpower',
    'artifact-accessory-clear-heart-pendant',
  ],
] as const;

function playerFixture(): CultivatorCombatInput {
  return {
    id: 'player',
    name: '玩家',
    realm: '元婴',
    realm_stage: '初期',
    attributes: {
      vitality: 1,
      strength: 1,
      spirit: 1,
      endurance: 1,
      speed: 1,
      willpower: 1,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: { artifacts: [] },
    equipped: { weapon: null, armor: null, accessory: null },
  };
}

describe('production sect elder trial presets', () => {
  it('projects every fixed elder through creation-v2 and battle-v5', () => {
    const expectedAttribute = Math.floor(
      getRealmStageAttributeBudget('元婴', '圆满') / 6,
    );

    for (const { module } of PRODUCTION_SECTS) {
      const sectId = module.definition.id as keyof typeof EXPECTED_PRESETS;
      const expected = EXPECTED_PRESETS[sectId];
      const scenario = module.organization.battles
        .get('elder_trial')
        ?.create({
          player: playerFixture(),
          target: null,
          sectId,
          opponentId: `elder-${sectId}`,
        });
      expect(scenario).toBeDefined();
      const opponent = scenario!.opponent;

      expect(scenario).toMatchObject({
        title: '长老试炼',
        presetId: `elder-trial-${sectId}-v1`,
        description: expected.description,
      });
      expect(opponent).toMatchObject({
        name: expected.name,
        realm: '元婴',
        realm_stage: '圆满',
        attributes: {
          vitality: expectedAttribute,
          strength: expectedAttribute,
          spirit: expectedAttribute,
          endurance: expectedAttribute,
          speed: expectedAttribute,
          willpower: expectedAttribute,
        },
      });
      expect(opponent.sect?.methods).toEqual(
        Object.fromEntries(expected.methodIds.map((methodId) => [methodId, 135])),
      );
      expect(opponent.sect).toMatchObject({
        activePathId: expected.pathId,
        abilityLoadout: expected.abilityLoadout,
      });
      expect(opponent.sect?.paths).toMatchObject([
        {
          pathId: expected.pathId,
          tacticId: expected.tacticId,
          unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
          meridianLoadouts: [
            { slot: 1, nodeIds: [] },
            { slot: 2, nodeIds: [] },
            { slot: 3, nodeIds: [] },
          ],
        },
      ]);
      expect(
        opponent.inventory.artifacts.map((artifact) => artifact.name),
      ).toEqual(expected.artifactNames);
      expect(
        opponent.inventory.artifacts.map((artifact) => ({
          quality: artifact.quality,
          anchorRealm: artifact.productModel?.metadata?.anchorRealm,
          anchorRealmStage: artifact.productModel?.metadata?.anchorRealmStage,
          affixIds: artifact.productModel?.affixes.map((affix) => affix.id),
        })),
      ).toEqual(
        ARTIFACT_AFFIX_IDS.map((affixIds) => ({
          quality: '地品',
          anchorRealm: '元婴',
          anchorRealmStage: '圆满',
          affixIds,
        })),
      );
      expect(opponent.inventory.artifacts.every((artifact) =>
        Boolean(artifact.description?.trim()),
      )).toBe(true);
      expect(() => createCombatUnitFromCultivator(opponent)).not.toThrow();
    }
  });
});
