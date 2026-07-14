import { AbilityType, AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { CultivatorSectState, SectDefinition, SectModule, SectNodeBehavior } from '../types';

const layers = [1, 2, 3, 4, 5, 'ultimate'] as const;
const methods = Array.from({ length: 6 }, (_, index) => ({
  id: `fixture-method-${index + 1}`,
  slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
  name: `样例心法${index + 1}`,
  description: '扩展契约测试心法。',
  milestones: [{ id: `fixture-milestone-${index + 1}`, level: 1, name: '初悟', description: '解锁法术', abilityId: `fixture-ability-${index + 1}` }],
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

const makeNodes = (prefix: string) => layers.flatMap((layer) => Array.from({ length: 3 }, (_, index) => ({
  id: `${prefix}-${String(layer)}-${index + 1}`,
  layer,
  name: `${prefix}节点${index + 1}`,
  description: '改变测试资源初始值。',
})));
const firstNodes = makeNodes('fixture-first');
const secondNodes = makeNodes('fixture-second');

export const FIXTURE_SECT_DEFINITION: SectDefinition = {
  id: 'fixture-sect',
  name: '样例宗门',
  description: '仅用于验证宗门横向扩展。',
  raceIds: ['human'],
  configVersion: 1,
  trial: { name: '样例试炼', description: '验证模块试炼场景。' },
  methods,
  abilities,
  paths: [
    { id: 'fixture-first-path', name: '第一流派', description: '第一测试流派', levelBenefitDescription: '每级强化第一资源', defaultTacticId: 'fixture-first-tactic', nodes: firstNodes, tactics: [{ id: 'fixture-first-tactic', name: '第一战术', description: '测试战术' }] },
    { id: 'fixture-second-path', name: '第二流派', description: '第二测试流派', levelBenefitDescription: '每级强化第二资源', defaultTacticId: 'fixture-second-tactic', nodes: secondNodes, tactics: [{ id: 'fixture-second-tactic', name: '第二战术', description: '测试战术' }] },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: { 'fixture-method-1': 1, 'fixture-method-2': 1 },
    initialAbilityLoadout: ['fixture-ability-2', null, null, null],
  },
};

const compiledAbilities = Object.fromEntries(abilities.map((ability) => [ability.id, {
  config: {
    slug: `sect.fixture-sect.${ability.id}`,
    name: ability.baseName,
    type: AbilityType.ACTIVE_SKILL,
    tags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      GameplayTags.ABILITY.KIND.SECT,
      GameplayTags.ABILITY.SECT.namespace('fixture-sect'),
      GameplayTags.ABILITY.SECT.ability('fixture-sect', ability.id),
      GameplayTags.ABILITY.SECT.GENERATOR,
      GameplayTags.ABILITY.TARGET.SINGLE,
    ],
    targetPolicy: { team: 'enemy' as const, scope: 'single' as const },
    effects: [{ type: 'damage' as const, params: { value: { attribute: AttributeType.ATK, coefficient: 1 }, damageType: DamageType.PHYSICAL } }],
  },
  detailRows: ['伤害：1.00物攻'],
  notes: [],
}]));

const behavior = (resourceId: string, resourceName: string): SectNodeBehavior => ({
  contribute(context) {
    return { operations: [{
      type: 'set_resources',
      resources: [{ id: resourceId, name: resourceName, initial: context.activeNodeIds.size, max: 18 }],
    }] };
  },
});

const pathModule = (pathIndex: number, resourceId: string, resourceName: string) => ({
  definition: FIXTURE_SECT_DEFINITION.paths[pathIndex],
  compileVariants: (_context: unknown, base: ReturnType<SectModule['compileBase']>) => ({
    ...base,
    resources: [{ id: resourceId, name: resourceName, initial: 0, max: 18 }],
  }),
  nodeBehaviors: Object.fromEntries(FIXTURE_SECT_DEFINITION.paths[pathIndex].nodes.map((node) => [node.id, behavior(resourceId, resourceName)])),
  createSelectionStrategy: () => ({ select: () => null }),
});

export const FIXTURE_SECT_MODULE: SectModule = {
  definition: FIXTURE_SECT_DEFINITION,
  paths: {
    'fixture-first-path': pathModule(0, 'fixture-first-resource', '第一资源'),
    'fixture-second-path': pathModule(1, 'fixture-second-resource', '第二资源'),
  },
  compileBase: () => ({ defaultAbilityId: 'fixture-ability-1', abilities: compiledAbilities, resources: [], passives: [] }),
  checkAdmission: ({ playerRace }) => playerRace === 'human' ? { allowed: true } : { allowed: false, reason: '种族不符' },
  createTrialScenario: ({ cultivator }) => ({
    trainee: { ...cultivator, sect: fixtureSectState(), skills: [] },
    opponent: { ...cultivator, id: 'fixture-opponent', name: '样例木人', sect: undefined, skills: [] },
  }),
};

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
