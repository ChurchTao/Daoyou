import { describe, expect, it } from 'vitest';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { projectSectCombat, resolveSectAbility } from '../..';
import {
  TIANYAN_HETU_PATH_ID,
  TIANYAN_LUOSHU_PATH_ID,
  TIANYAN_MODULE,
} from '..';
import { tianyanState } from './testState';

describe('天衍双道途与36参悟节点', () => {
  it.each([TIANYAN_HETU_PATH_ID, TIANYAN_LUOSHU_PATH_ID])(
    '%s 的每个单节点都能独立完成标准编译',
    (pathId) => {
      const path = TIANYAN_MODULE.definition.paths.find((entry) => entry.id === pathId)!;
      for (const node of path.nodes) {
        expect(() => projectSectCombat({
          sect: tianyanState(pathId, [node.id]),
          realm: '化神',
        })).not.toThrow();
      }
    },
  );

  it('河图节点会改变初始衍数、法印时长和周天保留值配置', () => {
    const sect = tianyanState(TIANYAN_HETU_PATH_ID, [
      'hetu-first-number',
      'hetu-flow-refund',
      'hetu-verdant-endless',
      'hetu-generation-gate',
      'hetu-number-remains',
      'hetu-endless-life',
    ]);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    expect(projection.resources[0].initial).toBe(1);
    const fire = resolveSectAbility({
      sect, realm: '化神', abilityId: 'flowing-flame',
    }).config;
    expect(fire.effectPlans).toHaveLength(6);
    expect(JSON.stringify(fire)).toContain('河图周天');
  });

  it('洛书节点能按契约改变移宫费用、反应比例与指定控制命中', () => {
    const sect = tianyanState(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-observe-gap',
      'luoshu-fast-shift',
      'luoshu-flame-flow',
      'luoshu-lock-position',
      'luoshu-chain-control',
      'luoshu-nine-changes',
    ]);
    const shift = resolveSectAbility({
      sect, realm: '化神', abilityId: 'shift-palace',
    }).config;
    expect(shift.mpCost).toBe(10);
    expect(shift.cooldown).toBe(1);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    const runtime = projection.abilities.find(
      (ability) => ability.slug === 'sect.tianyan.luoshu-runtime',
    );
    expect(runtime?.modifiers ?? []).not.toContainEqual(
      expect.objectContaining({ attrType: AttributeType.CONTROL_HIT }),
    );
    const earth = resolveSectAbility({
      sect, realm: '化神', abilityId: 'earth-bearing-seal',
    }).config;
    const whiteStar = resolveSectAbility({
      sect, realm: '化神', abilityId: 'white-star-breaker',
    }).config;
    expect(JSON.stringify(earth)).toContain('"controlHitBonus":0.15');
    expect(JSON.stringify(whiteStar)).toContain('"controlHitBonus":0.15');
    expect(JSON.stringify(resolveSectAbility({
      sect, realm: '化神', abilityId: 'dark-water-return',
    }).config)).toContain('0.95');
  });

  it('同ID天衍削弱携带强度优先级，强效果可替换弱效果', () => {
    const sect = tianyanState(TIANYAN_LUOSHU_PATH_ID);
    const water = resolveSectAbility({
      sect,
      realm: '化神',
      abilityId: 'dark-water-return',
    }).config;
    const priorities = water.effectLayers
      ?.flatMap((layer) => layer.effects)
      .flatMap((effect) =>
        effect.type === 'apply_buff' &&
        effect.params.buffConfig.id === 'sect.tianyan.water-slow'
          ? [effect.params.buffConfig.stackPriority]
          : [],
      )
      .filter((value): value is number => value !== undefined) ?? [];

    expect(priorities).toContain(0.15);
    expect(Math.max(...priorities)).toBeGreaterThan(0.15);
  });
});
