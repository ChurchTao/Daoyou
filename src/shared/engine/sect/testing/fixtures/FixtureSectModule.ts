import { AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import {
  AllowedRaceAdmissionPolicy,
  BaseSectModule,
  BaseSectPathModule,
  ConfiguredSectNodePlugin,
  StandardSectPermissionPolicy,
  SectAbilityFactory,
  standardSectProgression,
  type CultivatorSectState,
  type SectBuildBuilder,
  type SectDefinitionWithoutPaths,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectProjectionContext,
  type SectOrganizationModule,
  type SectTrialContext,
  type SectTrialScenarioFactory,
} from '../../core';

const fixtureOrganization: SectOrganizationModule = {
  permissions: new StandardSectPermissionPolicy({
    'scene.hall': 'registered',
    'scene.affairs': 'registered',
    'scene.archive': 'registered',
    'scene.enlightenment_cliff': 'registered',
    'scene.arena': 'registered',
    'scene.treasury': 'registered',
    'scene.industries': 'outer',
    'scene.cultivation_room': 'outer',
    'scene.alchemy': 'inner',
    'scene.refinery': 'inner',
    'scene.spirit_vein': 'registered',
    'scene.herb_garden': 'registered',
    'scene.cave': 'inner',
    'scene.gate': 'registered',
    'scene.formation': 'true',
    'task.pill_delivery': 'outer',
    'task.artifact_delivery': 'inner',
    'task.elder_trial': 'inner',
    'benefit.cultivation_room': 'outer',
    'benefit.workshop': 'inner',
  }),
  ranks: {
    stipendBase: () => 1,
    methodLevelCap: () => 7,
    requirement: (rank) => ({
      rank,
      minRealm: rank === 'true' ? '金丹' : rank === 'inner' ? '筑基' : '炼气',
      contribution: rank === 'true' ? 30 : rank === 'inner' ? 20 : 10,
    }),
  },
  tasks: {
    listDaily: () => [
      {
        id: 'fixture_patrol',
        name: '夹具巡山',
        description: '仅用于验证内容模块替换。',
        kind: 'daily',
        requiredRank: 'registered',
        contributionReward: 3,
        executor: 'battle',
        target: 1,
      },
    ],
    listWeekly: () => [],
    get: (id) =>
      id === 'fixture_patrol'
        ? {
            id,
            name: '夹具巡山',
            description: '仅用于验证内容模块替换。',
            kind: 'daily',
            requiredRank: 'registered',
            contributionReward: 3,
            executor: 'battle',
            target: 1,
          }
        : undefined,
    findByRole: () => undefined,
  },
  economy: {
    donationDailyCap: 1,
    shopItems: () => [
      {
        id: 'fixture_herb',
        requiredRank: 'registered',
        price: 1,
        stock: 1,
        rotating: false,
        grant: {
          kind: 'material',
          name: '夹具灵草',
          type: 'herb',
          quality: '凡品',
          description: '夹具商品',
        },
      },
    ],
    donationDemands: () => [],
    stipendBase: () => 1,
    stipendRewards: () => ({
      herbName: '样例灵草',
      herbQuality: '凡品',
      herbQuantity: 1,
      bonusRewards: [],
    }),
  },
  construction: {
    facilityPriority: ['archive'] as const,
    projectBaseTarget: () => 1,
  },
  battles: { get: () => undefined },
};

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
] as const;
const methods = Array.from({ length: 6 }, (_, index) => ({
  id: `fixture-method-${index + 1}`,
  slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
  name: `样例心法${index + 1}`,
  description: '扩展契约测试心法。',
}));
const abilities = methods.map((method, index) => ({
  id: `fixture-ability-${index + 1}`,
  methodId: method.id,
  baseName: `样例法术${index + 1}`,
  description: '扩展契约测试法术。',
  unlockLevel: 1,
  occupiesActiveSlot: index > 0,
  role: 'generator' as const,
  mpCost: 0,
  cooldown: 0,
}));

const baseDefinition: SectDefinitionWithoutPaths = {
  id: 'fixture-sect',
  name: '样例宗门',
  description: '仅用于验证宗门横向扩展。',
  raceIds: ['human'],
  configVersion: 1,
  combatResource: { id: 'fixture.resource', name: '专注', max: 18 },
  trial: { name: '样例试炼', description: '验证模块试炼场景。' },
  methods,
  abilities,
  onboarding: {
    initialContribution: 30,
    initialMethods: { 'fixture-method-1': 1, 'fixture-method-2': 1 },
    initialAbilityLoadout: ['fixture-ability-2', null, null, null],
  },
};

function createFixtureNodes(prefix: string, resourceId: string) {
  return layers.flatMap((layer) =>
    Array.from(
      { length: 3 },
      (_, index) =>
        new ConfiguredSectNodePlugin(
          {
            id: `${prefix}-${layer.id}-${index + 1}`,
            layerId: layer.id,
            name: `${prefix}节点${index + 1}`,
            description: '改变测试资源初始值。',
          },
          (context, builder) => {
            builder.updateResource(resourceId, (resource) => ({
              ...resource,
              initial: context.activeNodeIds.size,
            }));
          },
        ),
    ),
  );
}

class FixturePathModule extends BaseSectPathModule {
  constructor(
    definition: SectPathDefinitionWithoutNodes,
    private readonly resourceId: string,
    private readonly resourceName: string,
    prefix: string,
  ) {
    super(definition, createFixtureNodes(prefix, resourceId));
  }

  compileVariants(
    _context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    builder.clearResources().setResource({
      id: this.resourceId,
      name: this.resourceName,
      initial: 0,
      max: 18,
    });
  }

  createSelectionStrategy() {
    return { select: () => null };
  }
}

const firstPath = new FixturePathModule(
  {
    id: 'fixture-first-path',
    name: '第一流派',
    description: '第一测试流派',
    minRealm: '筑基',
    minRealmStage: '初期',
    layers: layers.map((layer) => ({ ...layer })),
    defaultTacticId: 'fixture-first-tactic',
    tactics: [
      { id: 'fixture-first-tactic', name: '第一战术', description: '测试战术' },
    ],
  },
  'fixture.resource',
  '专注',
  'fixture-first',
);

const secondPath = new FixturePathModule(
  {
    id: 'fixture-second-path',
    name: '第二流派',
    description: '第二测试流派',
    minRealm: '筑基',
    minRealmStage: '初期',
    layers: layers.map((layer) => ({ ...layer })),
    defaultTacticId: 'fixture-second-tactic',
    tactics: [
      {
        id: 'fixture-second-tactic',
        name: '第二战术',
        description: '测试战术',
      },
    ],
  },
  'fixture.resource',
  '专注',
  'fixture-second',
);

class FixtureTrialFactory implements SectTrialScenarioFactory {
  create({ cultivator }: SectTrialContext) {
    return {
      trainee: { ...cultivator, sect: fixtureSectState(), skills: [] },
      opponent: {
        ...cultivator,
        id: 'fixture-opponent',
        name: '样例木人',
        sect: undefined,
        skills: [],
      },
    };
  }
}

class FixtureSectModule extends BaseSectModule {
  constructor() {
    super(
      baseDefinition,
      [firstPath, secondPath],
      standardSectProgression,
      fixtureOrganization,
      'fixture-ability-1',
      new AllowedRaceAdmissionPolicy(['human'], '种族不符'),
      new FixtureTrialFactory(),
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    const factory = new SectAbilityFactory(this.definition.id);
    for (const definition of this.definition.abilities) {
      builder.setAbility(
        definition.id,
        factory.active({
          definition,
          detailRows: ['伤害：1.00物攻'],
          effects: [
            {
              type: 'damage',
              params: {
                value: { attribute: AttributeType.ATK, coefficient: 1 },
                damageType: DamageType.PHYSICAL,
              },
            },
          ],
        }),
      );
    }
    builder.setResource({
      id: this.definition.combatResource.id,
      name: this.definition.combatResource.name,
      initial: 0,
      max: this.definition.combatResource.max,
    });
  }
}

export const FIXTURE_SECT_MODULE = new FixtureSectModule();

export function fixtureSectState(): CultivatorSectState {
  return {
    membershipId: 'fixture-membership',
    sectId: 'fixture-sect',
    status: 'active',
    contribution: 30,
    configVersion: 1,
    methods: { 'fixture-method-1': 1, 'fixture-method-2': 1 },
    paths: [],
    abilityLoadout: ['fixture-ability-2', null, null, null],
  };
}
