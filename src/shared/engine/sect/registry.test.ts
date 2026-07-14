import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { AbilityType, AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { createSectRegistry } from './registry';
import type { SectDefinition, SectModule } from './types';

const layers = [1, 2, 3, 4, 5, 'ultimate'] as const;
const methods = Array.from({ length: 6 }, (_, index) => ({
  id: `fixture-method-${index + 1}`,
  slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
  name: `样例心法${index + 1}`,
  description: '用于验证横向扩展契约。',
  milestones: [{ id: `fixture-milestone-${index + 1}`, level: 1, name: '初悟', description: '解锁法术', abilityId: `fixture-ability-${index + 1}` }],
}));
const abilities = methods.map((method, index) => ({
  id: `fixture-ability-${index + 1}`, methodId: method.id, baseName: `样例法术${index + 1}`,
  description: '样例法术', unlockLevel: 1, occupiesActiveSlot: index > 0,
  role: 'generator' as const, manaWeight: 0, cooldown: 0,
}));
const nodes = layers.flatMap((layer) => Array.from({ length: 3 }, (_, index) => ({
  id: `fixture-${String(layer)}-${index + 1}`, layer, name: '样例节点', description: '样例节点行为',
})));
const alternateNodes = layers.flatMap((layer) => Array.from({ length: 3 }, (_, index) => ({
  id: `fixture-alternate-${String(layer)}-${index + 1}`, layer, name: '样例节点', description: '第二流派节点行为',
})));

const definition: SectDefinition = {
  id: 'fixture-sect', name: '样例宗门', description: '仅测试使用', raceIds: ['human'], configVersion: 1,
  trial: { name: '样例试炼', description: '验证模块化试炼。' },
  methods, abilities,
  paths: [
    { id: 'fixture-path', name: '样例流派', description: '样例', levelBenefitDescription: '样例成长', defaultTacticId: 'fixture-tactic', nodes, tactics: [{ id: 'fixture-tactic', name: '样例战术', description: '样例' }] },
    { id: 'fixture-alternate-path', name: '第二流派', description: '样例', levelBenefitDescription: '第二成长', defaultTacticId: 'fixture-alternate-tactic', nodes: alternateNodes, tactics: [{ id: 'fixture-alternate-tactic', name: '第二战术', description: '样例' }] },
  ],
  onboarding: { initialContribution: 1, initialMethods: { 'fixture-method-1': 1, 'fixture-method-2': 1 }, initialAbilityLoadout: ['fixture-ability-2', null, null, null] },
};

const abilityConfig = {
  slug: 'sect.fixture-sect.fixture-ability-1', name: '样例法术', type: AbilityType.ACTIVE_SKILL,
  tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE, GameplayTags.ABILITY.CHANNEL.PHYSICAL, GameplayTags.ABILITY.KIND.SECT, GameplayTags.ABILITY.TARGET.SINGLE],
  effects: [{ type: 'damage' as const, params: { value: { attribute: AttributeType.ATK, coefficient: 1 }, damageType: DamageType.PHYSICAL } }],
};

const compiledAbilities = Object.fromEntries(abilities.map((ability) => [ability.id, {
  config: { ...abilityConfig, slug: `sect.fixture-sect.${ability.id}`, name: ability.baseName },
  detailRows: ['样例伤害'],
  notes: [],
}]));

const nodeBehaviors = Object.fromEntries(nodes.map((node) => [node.id, {
  contribute: (context: { activeNodeIds: ReadonlySet<string> }) => ({ operations: [{
    type: 'set_resources' as const,
    resources: [{ id: 'fixture-resource', name: '样例资源', initial: context.activeNodeIds.size, max: 18 }],
  }] }),
}]));
const alternateNodeBehaviors = Object.fromEntries(alternateNodes.map((node) => [node.id, {
  contribute: (context: { activeNodeIds: ReadonlySet<string> }) => ({ operations: [{
    type: 'set_resources' as const,
    resources: [{ id: 'fixture-alternate-resource', name: '第二资源', initial: context.activeNodeIds.size, max: 18 }],
  }] }),
}]));

const fixtureModule: SectModule = {
  definition,
  paths: { 'fixture-path': {
    definition: definition.paths[0],
    compileVariants: (_context, base) => ({ ...base, resources: [{ id: 'fixture-resource', name: '样例资源', initial: 0, max: 18 }] }),
    nodeBehaviors,
    createSelectionStrategy: () => ({ select: () => null }),
  }, 'fixture-alternate-path': {
    definition: definition.paths[1],
    compileVariants: (_context, base) => ({ ...base, resources: [{ id: 'fixture-alternate-resource', name: '第二资源', initial: 0, max: 18 }] }),
    nodeBehaviors: alternateNodeBehaviors,
    createSelectionStrategy: () => ({ select: () => null }),
  } },
  compileBase: () => ({ defaultAbilityId: 'fixture-ability-1', abilities: compiledAbilities, resources: [], passives: [] }),
  checkAdmission: () => ({ allowed: true }),
  createTrialScenario: ({ cultivator }) => ({ trainee: cultivator, opponent: { ...cultivator, name: '样例木人' } }),
};

describe('宗门模块扩展契约', () => {
  it('第二宗门只通过模块注册即可完成定义、流派与战斗投影', () => {
    const registry = createSectRegistry([fixtureModule]);
    expect(registry.require('fixture-sect').definition.methods).toHaveLength(6);
    expect(registry.require('fixture-sect').definition.paths).toHaveLength(2);
    const projection = registry.require('fixture-sect').compileBase({
      sect: { membershipId: 'm', sectId: 'fixture-sect', status: 'active', contribution: 0, configVersion: 1, methods: { 'fixture-method-1': 1 }, paths: [], abilityLoadout: [null, null, null, null] },
      realm: '炼气',
    });
    expect(() => AbilityFactory.create(projection.abilities[projection.defaultAbilityId].config)).not.toThrow();
  });

  it('拒绝有定义但没有行为的经脉节点', () => {
    const invalid: SectModule = { ...fixtureModule, paths: { 'fixture-path': { ...fixtureModule.paths['fixture-path'], nodeBehaviors: Object.fromEntries(Object.entries(nodeBehaviors).slice(1)) } } };
    expect(() => createSectRegistry([invalid])).toThrow('节点行为不完整');
  });

  it('拒绝登记了节点ID但不改变编译结果的空实现', () => {
    const invalid: SectModule = {
      ...fixtureModule,
      paths: {
        ...fixtureModule.paths,
        'fixture-path': {
          ...fixtureModule.paths['fixture-path'],
          nodeBehaviors: { ...nodeBehaviors, [nodes[0].id]: { contribute: () => ({ operations: [] }) } },
        },
      },
    };
    expect(() => createSectRegistry([invalid])).toThrow('运行时贡献为空');
  });

  it('拒绝跨流派重复的节点和战术ID', () => {
    const duplicateNodeDefinition = structuredClone(definition);
    duplicateNodeDefinition.paths[1].nodes[0].id = duplicateNodeDefinition.paths[0].nodes[0].id;
    const duplicateNodeModule: SectModule = {
      ...fixtureModule,
      definition: duplicateNodeDefinition,
      paths: {
        ...fixtureModule.paths,
        'fixture-path': { ...fixtureModule.paths['fixture-path'], definition: duplicateNodeDefinition.paths[0] },
        'fixture-alternate-path': {
          ...fixtureModule.paths['fixture-alternate-path'],
          definition: duplicateNodeDefinition.paths[1],
          nodeBehaviors: {
            ...alternateNodeBehaviors,
            [duplicateNodeDefinition.paths[0].nodes[0].id]: alternateNodeBehaviors[alternateNodes[0].id],
          },
        },
      },
    };
    expect(() => createSectRegistry([duplicateNodeModule])).toThrow('跨流派重复节点ID');

    const duplicateTacticDefinition = structuredClone(definition);
    duplicateTacticDefinition.paths[1].tactics[0].id = duplicateTacticDefinition.paths[0].tactics[0].id;
    const duplicateTacticModule: SectModule = {
      ...fixtureModule,
      definition: duplicateTacticDefinition,
      paths: {
        ...fixtureModule.paths,
        'fixture-path': { ...fixtureModule.paths['fixture-path'], definition: duplicateTacticDefinition.paths[0] },
        'fixture-alternate-path': { ...fixtureModule.paths['fixture-alternate-path'], definition: duplicateTacticDefinition.paths[1] },
      },
    };
    expect(() => createSectRegistry([duplicateTacticModule])).toThrow('跨流派重复战术ID');
  });
});
