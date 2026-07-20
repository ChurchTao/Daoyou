import {
  BaseSectModule,
  StandardSectCapabilityPolicy,
  standardSectMethodGrowthPolicy,
  standardSectProgression,
  type SectBuildBuilder,
  type SectDefinition,
  type SectDefinitionWithoutPaths,
  type SectOrganizationModule,
  type SectProjectionContext,
} from '../../core';
import { FIXTURE_SECT_MODULE } from './FixtureSectModule';

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
      ({
        registered: 'outer',
        outer: 'inner',
        inner: 'true',
        true: null,
      } as const)[rank],
    methodLevelCap: () => 7,
    requirement: (rank) => ({
      rank,
      minRealm:
        rank === 'true' ? '金丹' : rank === 'inner' ? '筑基' : '炼气',
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
        executorKey: 'fixture-sect.battle',
        completion: [
          {
            strategy: 'fixture-sect.settlement.contribution',
            input: { amount: 3, reason: 'fixture_task' },
          },
        ],
        presentation: {
          title: '夹具巡山',
          description: '仅用于验证内容模块替换。',
          rewardSummary: '3 宗门贡献',
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
            executorKey: 'fixture-sect.battle',
            completion: [
              {
                strategy: 'fixture-sect.settlement.contribution',
                input: { amount: 3, reason: 'fixture_task' },
              },
            ],
            presentation: {
              title: '夹具巡山',
              description: '仅用于验证内容模块替换。',
              rewardSummary: '3 宗门贡献',
              actionLabel: '开始巡山',
            },
            target: 1,
          }
        : undefined,
    findByCompletionTag: () => undefined,
  },
  economy: {
    donationDailyCap: 1,
    rewardGrantKinds: [
      'sect.reward.spirit-stones',
      'fixture-sect.material',
    ] as const,
    donationKinds: ['fixture-sect.spirit-stones'] as const,
    shopItems: () => [
      {
        id: 'fixture_herb',
        requiredRank: 'registered',
        price: 1,
        stock: 1,
        rotating: false,
        grant: {
          kind: 'fixture-sect.material',
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
        kind: 'fixture-sect.spirit-stones',
        quantity: 1,
        contribution: 1,
        constructionPoints: 1,
      },
    ],
    stipendBase: () => 1,
    stipendRewards: () => [
      {
        quantity: 1,
        grant: {
          kind: 'fixture-sect.material',
          name: '样例灵草',
          type: 'herb',
          quality: '凡品',
          description: '夹具周俸灵草',
        },
      },
    ],
  },
  construction: {
    facilities: [
      {
        key: 'fixture_observatory',
        initialLevel: 1,
        maxLevel: 3,
        upgradeable: true,
      },
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
    snapshot: () => ({
      retreatMultiplier: 1,
      craftDiscounts: {
        'sect.craft.alchemy': 0,
        'sect.craft.refinery': 0,
      },
      facilityEffects: {},
    }),
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

function omitPaths(definition: SectDefinition): SectDefinitionWithoutPaths {
  const { paths, ...withoutPaths } = definition;
  void paths;
  return withoutPaths;
}

const fixtureDefinition = omitPaths(FIXTURE_SECT_MODULE.definition);

class CustomEconomyFixtureSectModule extends BaseSectModule {
  constructor() {
    super(
      fixtureDefinition,
      Array.from(FIXTURE_SECT_MODULE.paths.values()),
      standardSectProgression,
      standardSectMethodGrowthPolicy,
      fixtureOrganization,
      {
        check: (context) => FIXTURE_SECT_MODULE.checkAdmission(context),
      },
      {
        create: (context) => FIXTURE_SECT_MODULE.createTrialScenario(context),
      },
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    const build = FIXTURE_SECT_MODULE.createBaseBuilder(context).build();
    builder.replaceAbilities(build.abilities);
    for (const resource of build.resources) builder.setResource(resource);
    for (const modifier of build.abilityPresentationModifiers ?? []) {
      builder.addAbilityPresentationModifier(modifier);
    }
  }
}

/** 仅供验证自定义经济/服务端插件；标准宗门扩展测试不得使用。 */
export const CUSTOM_ECONOMY_FIXTURE_SECT_MODULE =
  new CustomEconomyFixtureSectModule();
