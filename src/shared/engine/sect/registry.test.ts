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

const definition: SectDefinition = {
  id: 'fixture-sect', name: '样例宗门', description: '仅测试使用', raceIds: ['human'], configVersion: 1,
  trial: { name: '样例试炼', description: '验证模块化试炼。' },
  methods, abilities,
  paths: [{ id: 'fixture-path', name: '样例流派', description: '样例', multiplierPerLevel: 0, defaultTacticId: 'fixture-tactic', nodes, tactics: [{ id: 'fixture-tactic', name: '样例战术', description: '样例' }] }],
  onboarding: { initialContribution: 1, initialMethods: { 'fixture-method-1': 1 }, initialAbilityLoadout: ['fixture-ability-2', null, null, null] },
};

const abilityConfig = {
  slug: 'sect.fixture-sect.fixture-ability-1', name: '样例法术', type: AbilityType.ACTIVE_SKILL,
  tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE, GameplayTags.ABILITY.CHANNEL.PHYSICAL, GameplayTags.ABILITY.KIND.SECT, GameplayTags.ABILITY.TARGET.SINGLE],
  effects: [{ type: 'damage' as const, params: { value: { attribute: AttributeType.ATK, coefficient: 1 }, damageType: DamageType.PHYSICAL } }],
};

const fixtureModule: SectModule = {
  definition,
  paths: { 'fixture-path': {
    definition: definition.paths[0], behaviorIds: nodes.map((node) => node.id),
    projectCombat: () => ({ defaultAttack: abilityConfig, abilities: [], methodModifiers: [], resources: [] }),
    resolveAbility: ({ abilityId }) => ({ id: abilityId, name: '样例法术', baseName: '样例法术', role: 'generator', summary: '样例', unlocked: true, unlockRequirements: [], manaCost: 0, cooldown: 0, detailRows: [], notes: [], config: abilityConfig }),
    createSelectionStrategy: () => ({ select: () => null }),
  } },
  trial: { methods: { 'fixture-method-1': 1 }, abilityLoadout: ['fixture-ability-2', null, null, null], opponentName: '样例木人' },
  projectCombat: () => ({ defaultAttack: abilityConfig, abilities: [], methodModifiers: [], resources: [] }),
  resolveAbility: ({ abilityId }) => ({ id: abilityId, name: '样例法术', baseName: '样例法术', role: 'generator', summary: '样例', unlocked: true, unlockRequirements: [], manaCost: 0, cooldown: 0, detailRows: [], notes: [], config: abilityConfig }),
};

describe('宗门模块扩展契约', () => {
  it('第二宗门只通过模块注册即可完成定义、流派与战斗投影', () => {
    const registry = createSectRegistry([fixtureModule]);
    expect(registry.require('fixture-sect').definition.methods).toHaveLength(6);
    const projection = registry.require('fixture-sect').projectCombat({
      sect: { membershipId: 'm', sectId: 'fixture-sect', status: 'active', contribution: 0, configVersion: 1, methods: { 'fixture-method-1': 1 }, paths: [], abilityLoadout: [null, null, null, null] },
      realm: '炼气',
    });
    expect(() => AbilityFactory.create(projection!.defaultAttack!)).not.toThrow();
  });

  it('拒绝有定义但没有行为的经脉节点', () => {
    const invalid: SectModule = { ...fixtureModule, paths: { 'fixture-path': { ...fixtureModule.paths['fixture-path'], behaviorIds: nodes.slice(1).map((node) => node.id) } } };
    expect(() => createSectRegistry([invalid])).toThrow('节点行为不完整');
  });
});
