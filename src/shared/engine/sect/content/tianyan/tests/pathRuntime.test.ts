import { describe, expect, it } from 'vitest';
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

  it('洛书节点能按契约改变移宫费用、反应比例与控制命中', () => {
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
    expect(runtime?.modifiers).toContainEqual(
      expect.objectContaining({ value: 0.15 }),
    );
    expect(JSON.stringify(resolveSectAbility({
      sect, realm: '化神', abilityId: 'dark-water-return',
    }).config)).toContain('0.95');
  });
});
