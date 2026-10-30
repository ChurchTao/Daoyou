import { describe, expect, it } from 'vitest';
import { TOWER_ENCOUNTER_PACK } from '@daoyou/game-content/tower';
import { presetEnemyAttrs } from './preset-enemy.js';

describe('预设敌人预算', () => {
  it('金丹中期与蜃楼的整场气血和输出预算一致', () => {
    const base = TOWER_ENCOUNTER_PACK.baselines.金丹;
    const budgets = TOWER_ENCOUNTER_PACK.scaling.types;
    const normal = presetEnemyAttrs(50, 'normal');
    const elite = presetEnemyAttrs(50, 'elite', 2);
    const boss = presetEnemyAttrs(50, 'boss');
    expect(normal.maxHp).toBe(Math.round(base.damagePerRound * budgets.normal.rounds));
    expect(Math.abs(elite.maxHp * 2 - base.damagePerRound * budgets.elite.rounds)).toBeLessThanOrEqual(1);
    expect(boss.maxHp).toBe(Math.round(base.damagePerRound * budgets.boss.rounds));
    expect(normal.physicalAtk).toBe(base.physicalAtk);
    expect(Math.abs((elite.physicalAtk - base.referencePhysicalDef) * 2 -
      (base.physicalAtk - base.referencePhysicalDef) * budgets.elite.output)).toBeLessThanOrEqual(1);
    expect(Math.abs((elite.magicAtk - base.referenceMagicDef) * 2 -
      (base.magicAtk - base.referenceMagicDef) * budgets.elite.output)).toBeLessThanOrEqual(1);
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
