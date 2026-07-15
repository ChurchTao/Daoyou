import { AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import {
  AllowedRaceAdmissionPolicy,
  BaseSectModule,
  BaseSectPathModule,
  ConfiguredSectNodePlugin,
  SectAbilityFactory,
  standardSectProgression,
  type CultivatorSectState,
  type SectBuildBuilder,
  type SectDefinitionWithoutPaths,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectProjectionContext,
  type SectTrialContext,
  type SectTrialScenarioFactory,
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
] as const;
const methods = Array.from({ length: 6 }, (_, index) => ({
  id: `fixture-method-${index + 1}`,
  slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
  name: `样例心法${index + 1}`,
  description: '扩展契约测试心法。',
  milestones: [
    {
      id: `fixture-milestone-${index + 1}`,
      level: 1,
      name: '初悟',
      description: '解锁法术',
      abilityId: `fixture-ability-${index + 1}`,
    },
  ],
}));
const abilities = methods.map((method, index) => ({
  id: `fixture-ability-${index + 1}`,
  methodId: method.id,
  baseName: `样例法术${index + 1}`,
  description: '扩展契约测试法术。',
  unlockLevel: 1,
  occupiesActiveSlot: index > 0,
  role: 'generator' as const,
  manaWeight: 0,
  cooldown: 0,
}));

const baseDefinition: SectDefinitionWithoutPaths = {
  id: 'fixture-sect',
  name: '样例宗门',
  description: '仅用于验证宗门横向扩展。',
  raceIds: ['human'],
  configVersion: 1,
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
    layers: layers.map((layer) => ({ ...layer })),
    defaultTacticId: 'fixture-first-tactic',
    tactics: [
      { id: 'fixture-first-tactic', name: '第一战术', description: '测试战术' },
    ],
  },
  'fixture-first-resource',
  '第一资源',
  'fixture-first',
);

const secondPath = new FixturePathModule(
  {
    id: 'fixture-second-path',
    name: '第二流派',
    description: '第二测试流派',
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
  'fixture-second-resource',
  '第二资源',
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
      'fixture-ability-1',
      new AllowedRaceAdmissionPolicy(['human'], '种族不符'),
      new FixtureTrialFactory(),
    );
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    const factory = new SectAbilityFactory(this.definition.id, context.realm);
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
  }
}

export const FIXTURE_SECT_MODULE = new FixtureSectModule();
export const FIXTURE_SECT_DEFINITION = FIXTURE_SECT_MODULE.definition;

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
