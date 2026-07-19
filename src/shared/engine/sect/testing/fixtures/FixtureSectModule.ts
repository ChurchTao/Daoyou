import { AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import {
  AllowedRaceAdmissionPolicy,
  BaseSectModule,
  BaseSectPathModule,
  ConfiguredSectNodePlugin,
  StandardSectCapabilityPolicy,
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
  capabilities: new StandardSectCapabilityPolicy({
    'sect.hall.view': 'registered',
    'sect.tasks.use': 'registered',
    'sect.archive.use': 'registered',
    'sect.enlightenment.use': 'registered',
    'sect.arena.use': 'registered',
    'sect.shop.use': 'registered',
    'sect.construction.view': 'outer',
    'sect.construction.donate': 'outer',
    'sect.facility.cultivation.use': 'outer',
    'sect.facility.alchemy.use': 'inner',
    'sect.facility.refinery.use': 'inner',
    'sect.spirit_vein.view': 'registered',
    'sect.herb_garden.view': 'registered',
    'sect.cave.view': 'inner',
    'sect.gate.view': 'registered',
    'sect.formation.view': 'true',
  }),
  ranks: {
    nextRank: (rank) =>
      ({ registered: 'outer', outer: 'inner', inner: 'true', true: null } as const)[rank],
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
        kind: 'daily',
        requiredCapability: 'sect.tasks.use',
        contributionReward: 3,
        executorKey: 'fixture.battle',
        completion: [
          {
            strategy: 'fixture.settlement.contribution',
            input: { amount: 3, reason: 'fixture_task' },
          },
        ],
        presentation: {
          title: '夹具巡山',
          description: '仅用于验证内容模块替换。',
          rewardSummary: '3 宗门贡献',
          renderer: 'fixture.action.battle',
          actionLabel: '开始巡山',
        },
        target: 1,
      },
    ],
    listWeekly: () => [],
    listPromotion: () => [],
    get: (id) =>
      id === 'fixture_patrol'
        ? {
            id,
            kind: 'daily',
            requiredCapability: 'sect.tasks.use',
            contributionReward: 3,
            executorKey: 'fixture.battle',
            completion: [
              {
                strategy: 'fixture.settlement.contribution',
                input: { amount: 3, reason: 'fixture_task' },
              },
            ],
            presentation: {
              title: '夹具巡山',
              description: '仅用于验证内容模块替换。',
              rewardSummary: '3 宗门贡献',
              renderer: 'fixture.action.battle',
              actionLabel: '开始巡山',
            },
            target: 1,
          }
        : undefined,
    findByCompletionTag: () => undefined,
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
          kind: 'fixture.material',
          name: '夹具灵草',
          type: 'herb',
          quality: '凡品',
          description: '夹具商品',
        },
      },
    ],
    donationDemands: () => [
      {
        id: 'fixture_stones',
        name: '夹具星砂资粮',
        description: '提交一份灵石以校验可扩展捐献。',
        kind: 'fixture.spirit_stones',
        quantity: 1,
        contribution: 1,
        constructionPoints: 1,
      },
    ],
    stipendBase: () => 1,
    stipendRewards: () => [{
      quantity: 1,
      grant: {
        kind: 'fixture.material',
        name: '样例灵草',
        type: 'herb',
        quality: '凡品',
        description: '夹具周俸灵草',
      },
    }],
  },
  construction: {
    facilities: [
      { key: 'fixture_observatory', initialLevel: 1, maxLevel: 3, upgradeable: true },
    ],
    facilityPriority: ['fixture_observatory'] as const,
    projectBaseTarget: () => 1,
    nextProject: (levels) =>
      (levels.get('fixture_observatory') ?? 1) < 3
        ? {
            facilityKey: 'fixture_observatory',
            targetLevel: (levels.get('fixture_observatory') ?? 1) + 1,
          }
        : null,
  },
  battles: { get: () => undefined },
  benefits: {
    archiveLevel: (levels) => levels.get('fixture_observatory') ?? 1,
    methodLevelCap: () => 7,
    gardenLevel: (levels) => levels.get('herb_garden') ?? 1,
    retreatMultiplier: () => 1,
    craftDiscount: () => ({
      capability: 'sect.facility.alchemy.use',
      discount: 0,
    }),
    stipendMultiplier: () => 1,
  },
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
