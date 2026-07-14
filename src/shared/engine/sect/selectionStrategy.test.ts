import { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import type { AbilitySelectionCandidate } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { AttributeType, BuffType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { describe, expect, it } from 'vitest';
import {
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
  projectLingxiaoCombat,
} from './combatProjection';
import { createSectAbilitySelectionStrategy } from './selectionStrategy';
import type {
  CultivatorSectState,
  LingxiaoAbilityId,
  SectAbilitySlots,
  SectTacticId,
} from './types';

function state(
  tacticId: SectTacticId,
  abilityLoadout: SectAbilitySlots,
): CultivatorSectState {
  return {
    membershipId: 'm1',
    sectId: 'lingxiao',
    status: 'active',
    pathId: 'swift-sword',
    contribution: 0,
    tacticId,
    activeMeridianSlot: 1,
    configVersion: 1,
    methods: {
      'lingxiao-canon': 100,
      'sword-guidance': 100,
      'void-step': 100,
      'edge-cleansing': 100,
      'origin-returning': 100,
      'swift-sword-canon': 100,
    },
    meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }],
    abilityLoadout,
  };
}

function createUnit(id: string, speed: number): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.WILLPOWER]: 100,
    [AttributeType.SPEED]: speed,
  });
}

function select(args: {
  tacticId: SectTacticId;
  loadout: SectAbilitySlots;
  momentum: number;
  casterHp?: number;
  targetHp?: number;
  casterSpeed?: number;
  targetSpeed?: number;
  swordMark?: boolean;
  shield?: number;
  omit?: LingxiaoAbilityId[];
}) {
  const projection = projectLingxiaoCombat({
    sect: state(args.tacticId, args.loadout),
    realm: '化神',
  })!;
  const caster = createUnit('caster', args.casterSpeed ?? 120);
  const target = createUnit('target', args.targetSpeed ?? 100);
  caster.combatResources.define(projection.resources[0]);
  caster.combatResources.set(LINGXIAO_SWORD_MOMENTUM, args.momentum);
  caster.setHp(caster.getMaxHp() * (args.casterHp ?? 1));
  target.setHp(target.getMaxHp() * (args.targetHp ?? 1));
  caster.setShield(args.shield ?? 0);

  if (args.swordMark) {
    target.buffs.addBuff(
      BuffFactory.create({
        id: LINGXIAO_SWORD_MARK_BUFF,
        name: '剑痕',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
      }),
      caster,
    );
  }

  const omitted = new Set(args.omit ?? []);
  const candidates: AbilitySelectionCandidate[] = projection.abilities
    .filter((config) => !omitted.has(config.slug.split('.').at(-1) as LingxiaoAbilityId))
    .map((config) => AbilityFactory.create(config))
    .filter((ability): ability is ActiveSkill => ability instanceof ActiveSkill)
    .map((ability, order) => {
      ability.setOwner(caster);
      ability.setActive(true);
      return { ability, target, order };
    })
    .filter((candidate) =>
      candidate.ability.canTrigger({ caster, target: candidate.target }),
    );
  const strategy = createSectAbilitySelectionStrategy(projection)!;
  return {
    result: strategy.select({ caster, opponent: target, candidates }),
    caster,
  };
}

describe('凌霄剑宗确定性选技', () => {
  it('急攻先以流光铺垫，达到三势后使用一线天', () => {
    const loadout: SectAbilitySlots = [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      null,
    ];
    expect(select({ tacticId: 'aggressive', loadout, momentum: 0 }).result?.ability.id)
      .toBe('sect.lingxiao.linked-edge');
    expect(select({
      tacticId: 'aggressive', loadout, momentum: 2, swordMark: true,
    }).result?.ability.id).toBe('sect.lingxiao.guiding-sword');
    expect(select({ tacticId: 'aggressive', loadout, momentum: 3 }).result?.ability.id)
      .toBe('sect.lingxiao.breaking-edge');
  });

  it('稳势六势时按剑痕选择一线天或刹那无痕', () => {
    const loadout: SectAbilitySlots = [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      'instant-traceless',
    ];
    expect(select({ tacticId: 'steady', loadout, momentum: 6 }).result?.ability.id)
      .toBe('sect.lingxiao.instant-traceless');
    expect(select({ tacticId: 'steady', loadout, momentum: 6, swordMark: true }).result?.ability.id)
      .toBe('sect.lingxiao.breaking-edge');
  });

  it('回风优先紧急剑罡，其次在低血量进入回燕姿态', () => {
    const loadout: SectAbilitySlots = [
      'guiding-sword',
      'turning-body',
      'breaking-edge',
      'sword-aegis',
    ];
    expect(select({ tacticId: 'counter', loadout, momentum: 2, casterHp: 0.4 }).result?.ability.id)
      .toBe('sect.lingxiao.sword-aegis');
    expect(select({ tacticId: 'counter', loadout, momentum: 2, casterHp: 0.4, shield: 10 }).result?.ability.id)
      .toBe('sect.lingxiao.turning-body');
    expect(select({ tacticId: 'counter', loadout, momentum: 5 }).result?.ability.id)
      .toBe('sect.lingxiao.breaking-edge');
  });

  it('回风在较慢且低势时使用踏影，稳势优先追风补势', () => {
    const loadout: SectAbilitySlots = [
      'guiding-sword',
      'shadow-step',
      'breaking-edge',
      null,
    ];
    expect(select({
      tacticId: 'counter', loadout, momentum: 0, casterSpeed: 80, targetSpeed: 100,
    }).result?.ability.id).toBe('sect.lingxiao.shadow-step');
    expect(select({
      tacticId: 'steady', loadout, momentum: 2, casterSpeed: 80, targetSpeed: 100,
    }).result?.ability.id).toBe('sect.lingxiao.guiding-sword');
  });

  it('流光不可用时回退追风，仅装追风与一线天时保持合法循环', () => {
    const fullLoadout: SectAbilitySlots = [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      null,
    ];
    expect(select({
      tacticId: 'steady', loadout: fullLoadout, momentum: 2, omit: ['linked-edge'],
    }).result?.ability.id)
      .toBe('sect.lingxiao.guiding-sword');
    const compactLoadout: SectAbilitySlots = [
      'guiding-sword',
      null,
      'breaking-edge',
      null,
    ];
    expect(select({ tacticId: 'steady', loadout: compactLoadout, momentum: 6 }).result?.ability.id)
      .toBe('sect.lingxiao.breaking-edge');
  });

  it('踏影效果存在时不会重复准备踏影', () => {
    const loadout: SectAbilitySlots = [
      'guiding-sword',
      'shadow-step',
      'breaking-edge',
      null,
    ];
    const prepared = select({
      tacticId: 'counter', loadout, momentum: 0, casterSpeed: 80, targetSpeed: 100,
    });
    prepared.caster.buffs.addBuff(
      BuffFactory.create({
        id: LINGXIAO_SHADOW_STEP_BUFF,
        name: '踏影',
        type: BuffType.BUFF,
        duration: 2,
        stackRule: StackRule.REFRESH_DURATION,
      }),
      prepared.caster,
    );
    const projection = projectLingxiaoCombat({ sect: state('counter', loadout), realm: '化神' })!;
    const strategy = createSectAbilitySelectionStrategy(projection)!;
    const target = createUnit('second-target', 100);
    const candidates = projection.abilities.map((config, order) => {
      const ability = AbilityFactory.create(config) as ActiveSkill;
      ability.setOwner(prepared.caster);
      return { ability, target, order };
    });
    expect(strategy.select({ caster: prepared.caster, opponent: target, candidates })?.ability.id)
      .toBe('sect.lingxiao.guiding-sword');
  });
});
