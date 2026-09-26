import { describe, expect, it } from 'vitest';
import { TOWER_ENCOUNTER_PACK } from '../../../lib/tower/encounter-pack';
import { presetEnemyAttrs } from './preset-enemy';

describe('预设敌人预算', () => {
  it('金丹中期与蜃楼的整场气血和输出预算一致', () => {
    const base = TOWER_ENCOUNTER_PACK.baselines.金丹;
    const normal = presetEnemyAttrs(50, 'normal');
    const elite = presetEnemyAttrs(50, 'elite', 2);
    const boss = presetEnemyAttrs(50, 'boss');
    expect(normal.maxHp).toBe(Math.round(base.damagePerRound * 2.5));
    expect(Math.abs(elite.maxHp * 2 - base.damagePerRound * 5.5)).toBeLessThanOrEqual(1);
    expect(boss.maxHp).toBe(Math.round(base.damagePerRound * 8));
    expect(normal.physicalAtk).toBe(base.physicalAtk);
    expect(boss.physicalAtk).toBeGreaterThan(normal.physicalAtk);
  });

  it('同类敌人随等级增强，低境界与高境界均有有效面板', () => {
    for (const level of [5, 25, 45, 70, 90, 110, 130, 150, 170]) {
      const attrs = presetEnemyAttrs(level, 'normal');
      expect(attrs.maxHp).toBeGreaterThan(0);
      expect(attrs.physicalAtk).toBeGreaterThan(0);
      expect(attrs.magicAtk).toBeGreaterThan(0);
    }
    expect(presetEnemyAttrs(30, 'normal').maxHp).toBeGreaterThan(presetEnemyAttrs(25, 'normal').maxHp);
    expect(presetEnemyAttrs(170, 'normal').maxHp).toBeGreaterThan(presetEnemyAttrs(150, 'normal').maxHp);
  });
});
