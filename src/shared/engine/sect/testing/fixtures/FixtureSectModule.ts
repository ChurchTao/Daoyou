import {
  StandardSectModule,
  type CultivatorSectState,
  type SectAbilityDefinition,
  type SectDefinitionWithoutPaths,
  type SectPathDefinition,
} from '../../core';

const layers = [
  {
    id: 'foundation',
    order: 1,
    label: '根基层',
    minRealm: '筑基' as const,
    minRealmStage: '初期' as const,
    cost: { cultivationExp: 10, comprehensionInsight: 1, spiritStones: 20 },
  },
  {
    id: 'mastery',
    order: 2,
    label: '精通层',
    minRealm: '筑基' as const,
    minRealmStage: '中期' as const,
    cost: { cultivationExp: 20, comprehensionInsight: 2, spiritStones: 40 },
  },
  {
    id: 'refinement',
    order: 3,
    label: '精炼层',
    minRealm: '筑基' as const,
    minRealmStage: '初期' as const,
    cost: { cultivationExp: 30, comprehensionInsight: 3, spiritStones: 60 },
  },
  {
    id: 'resonance',
    order: 4,
    label: '共鸣层',
    minRealm: '筑基' as const,
    minRealmStage: '初期' as const,
    cost: { cultivationExp: 40, comprehensionInsight: 4, spiritStones: 80 },
  },
  {
    id: 'domain',
    order: 5,
    label: '领域层',
    minRealm: '筑基' as const,
    minRealmStage: '初期' as const,
    cost: { cultivationExp: 50, comprehensionInsight: 5, spiritStones: 100 },
  },
  {
    id: 'ascension',
    order: 6,
    label: '升华层',
    minRealm: '筑基' as const,
    minRealmStage: '初期' as const,
    cost: { cultivationExp: 60, comprehensionInsight: 6, spiritStones: 120 },
  },
  {
    id: 'transcendence',
    order: 7,
    label: '超越层',
    minRealm: '筑基' as const,
    minRealmStage: '初期' as const,
    cost: { cultivationExp: 70, comprehensionInsight: 7, spiritStones: 140 },
  },
] as const;
const methods = Array.from({ length: 6 }, (_, index) => ({
  id: `fixture-method-${index + 1}`,
  slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
  name: `样例心法${index + 1}`,
  description: '扩展契约测试心法。',
  isPrimary: index === 0,
}));
const abilities: SectAbilityDefinition[] = methods.map((method, index) =>
  index === 5
    ? {
        id: 'fixture-ability-6',
        kind: 'passive',
        baseName: '星辉护体',
        description: '常驻提升少量法术防御。',
        unlock: { type: 'always' },
        sourceMethodId: method.id,
        role: 'defensive',
        visibility: 'internal',
      }
    : {
        id: `fixture-ability-${index + 1}`,
        kind: index === 0 ? 'default' : 'active',
        baseName: `样例法术${index + 1}`,
        description: '扩展契约测试法术。',
        unlock: { type: 'method', methodId: method.id, level: 1 },
        role: index === 2 ? 'defensive' : index === 3 ? 'utility' : 'generator',
      },
);

const baseDefinition: SectDefinitionWithoutPaths = {
  id: 'fixture-sect',
  name: '样例宗门',
  description: '仅用于验证宗门横向扩展。',
  raceIds: ['human'],
  configVersion: 1,
  methods,
  abilities,
  onboarding: {
    initialContribution: 30,
    initialMethods: { 'fixture-method-1': 1, 'fixture-method-2': 1 },
    initialAbilityLoadout: ['fixture-ability-2', null, null, null],
  },
};

const paths: SectPathDefinition[] = ['first', 'second'].map((key) => ({
  id: `fixture-${key}-path`,
  name: key === 'first' ? '第一流派' : '第二流派',
  description: '历史迁移测试流派',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: layers.map((layer) => ({ ...layer })),
  defaultTacticId: `fixture-${key}-tactic`,
  tactics: [
    { id: `fixture-${key}-tactic`, name: '测试战术', description: '历史标识' },
  ],
  nodes: layers.flatMap((layer) =>
    Array.from({ length: 3 }, (_, index) => ({
      id: `fixture-${key}-${layer.id}-${index + 1}`,
      layerId: layer.id,
      name: '历史节点',
      description: '历史迁移标识',
    })),
  ),
}));
export const FIXTURE_SECT_MODULE = new StandardSectModule({
  ...baseDefinition,
  paths,
});

export function fixtureSectState(): CultivatorSectState {
  return {
    membershipId: 'fixture-membership',
    sectId: 'fixture-sect',
    status: 'active',
    contribution: 30,
    configVersion: 1,
  };
}
