import { DefaultAbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import {
  AttributeType,
  BuffType,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import {
  BaseSectPathModule,
  ConfiguredSectNodePlugin,
  SectAbilityFactory,
  StandardSectModule,
  type CultivatorSectState,
  type SectAbilityDefinition,
  type SectBuildBuilder,
  type SectDefinitionWithoutPaths,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectProjectionContext,
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
        unlock: { type: 'method', methodId: method.id, level: 1 },
        role: 'defensive',
      }
    : {
        id: `fixture-ability-${index + 1}`,
        kind: index === 0 ? 'default' : 'active',
        baseName: `样例法术${index + 1}`,
        description: '扩展契约测试法术。',
        unlock: { type: 'method', methodId: method.id, level: 1 },
        role: index === 2 ? 'defensive' : index === 3 ? 'utility' : 'generator',
        mpCost: index === 0 ? 0 : 10,
        cooldown: index === 0 ? 0 : 1,
      },
);

const baseDefinition: SectDefinitionWithoutPaths = {
  id: 'fixture-sect',
  name: '样例宗门',
  description: '仅用于验证宗门横向扩展。',
  raceIds: ['human'],
  configVersion: 1,
  combatResource: { id: 'fixture.resource', name: '专注', max: 18 },
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

  protected initializeBuild(
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

function compileFixtureBase(
  definitionRoot: SectDefinitionWithoutPaths & { paths?: never },
  _context: SectProjectionContext,
  builder: SectBuildBuilder,
): void {
  const factory = new SectAbilityFactory(definitionRoot.id);
  for (const definition of definitionRoot.abilities) {
    if (definition.kind === 'passive') {
      builder.setAbility(
        definition.id,
        factory.passive({
          definition,
          modifiers: [
            {
              attrType: AttributeType.MAGIC_DEF,
              type: ModifierType.ADD,
              value: 0.05,
            },
          ],
        }),
      );
      continue;
    }
    const idParts = definition.id.split('-');
    const index = Number(idParts[idParts.length - 1]);
    const effects =
      index === 2
        ? [
            {
              type: 'damage' as const,
              params: {
                value: { attribute: AttributeType.MAGIC_ATK, coefficient: 1 },
                damageType: DamageType.MAGICAL,
              },
            },
          ]
        : index === 3
          ? [
              {
                type: 'heal' as const,
                params: {
                  value: { targetMaxHpRatio: 0.1 },
                  target: 'hp' as const,
                  recipient: 'caster' as const,
                },
              },
            ]
          : index === 4
            ? [
                {
                  type: 'apply_buff' as const,
                  params: {
                    target: 'target' as const,
                    buffConfig: {
                      id: 'fixture.control',
                      name: '定身',
                      type: BuffType.CONTROL,
                      duration: 1,
                      stackRule: StackRule.REFRESH_DURATION,
                    },
                  },
                },
              ]
            : [
                {
                  type: 'damage' as const,
                  params: {
                    value: { attribute: AttributeType.ATK, coefficient: 1 },
                    damageType:
                      index === 5 ? DamageType.TRUE : DamageType.PHYSICAL,
                  },
                },
              ];
    builder.setAbility(
      definition.id,
      factory.active({
        definition,
        detailRows: ['伤害：1.00物攻'],
        targetPolicy:
          index === 2
            ? { team: 'enemy', scope: 'aoe', maxTargets: 3 }
            : index === 3
              ? { team: 'self', scope: 'single' }
              : { team: 'enemy', scope: 'single' },
        effects,
      }),
    );
  }
  builder.setResource({
    id: definitionRoot.combatResource.id,
    name: definitionRoot.combatResource.name,
    initial: 0,
    max: definitionRoot.combatResource.max,
  });
}

class FixtureSectModule extends StandardSectModule {
  constructor() {
    super(baseDefinition, [firstPath, secondPath]);
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void {
    compileFixtureBase(baseDefinition, context, builder);
  }

  createBaseSelectionStrategy() {
    return new DefaultAbilitySelectionStrategy();
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
