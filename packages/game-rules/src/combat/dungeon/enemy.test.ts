import { REALM_VALUES } from '@daoyou/constants/realms';
import { COMBAT_DUNGEON_ENEMIES_SCHEMA as schema } from '@daoyou/game-content/authoring/combat';
import { DungeonEnemyPackShape } from '@daoyou/game-content/combat/dungeon';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dungeonEnemyAttrs } from './enemy-attrs.js';

describe('云游敌人预算', () => {
  it('编辑器 Schema 与加载结构一致', () => {
    expect(z.toJSONSchema(DungeonEnemyPackShape, { reused: 'ref' })).toEqual(
      schema,
    );
  });

  it('中期普通锚点使用本境配置，阶段和地图危险档各自加强', () => {
    const anchor = dungeonEnemyAttrs({
      realm: '金丹',
      stage: '中期',
      tier: 'normal',
      template: 'normal',
    });
    expect(anchor.maxHp).toBe(1718);
    expect(anchor.physicalAtk).toBe(561);
    const early = dungeonEnemyAttrs({
      realm: '金丹',
      stage: '初期',
      tier: 'normal',
      template: 'normal',
    });
    const late = dungeonEnemyAttrs({
      realm: '金丹',
      stage: '圆满',
      tier: 'normal',
      template: 'normal',
    });
    expect(early.maxHp).toBeLessThan(anchor.maxHp);
    expect(anchor.maxHp).toBeLessThan(late.maxHp);
    expect(early.physicalAtk).toBeLessThan(anchor.physicalAtk);
    expect(anchor.physicalAtk).toBeLessThan(late.physicalAtk);
    const easy = dungeonEnemyAttrs({
      realm: '金丹',
      stage: '中期',
      tier: 'easy',
      template: 'normal',
    });
    const boss = dungeonEnemyAttrs({
      realm: '金丹',
      stage: '中期',
      tier: 'boss',
      template: 'normal',
    });
    expect(easy.maxHp).toBeLessThan(anchor.maxHp);
    expect(anchor.maxHp).toBeLessThan(boss.maxHp);
    expect(easy.physicalAtk).toBeLessThan(anchor.physicalAtk);
    expect(anchor.physicalAtk).toBeLessThan(boss.physicalAtk);
  });

  it('精英平分气血和攻击差额，境界越高锚点越强', () => {
    const normal = dungeonEnemyAttrs({
      realm: '金丹',
      stage: '中期',
      tier: 'normal',
      template: 'normal',
    });
    const elite = dungeonEnemyAttrs({
      realm: '金丹',
      stage: '中期',
      tier: 'normal',
      template: 'elite',
    });
    expect(elite.maxHp).toBeLessThan(normal.maxHp);
    expect(elite.physicalAtk).toBeLessThan(normal.physicalAtk);
    expect(elite.maxHp * 2).toBeGreaterThan(normal.maxHp);
    let previousHp = 0;
    let previousAtk = 0;
    for (const realm of REALM_VALUES) {
      const attrs = dungeonEnemyAttrs({
        realm,
        stage: '中期',
        tier: 'normal',
        template: 'normal',
      });
      expect(attrs.maxHp).toBeGreaterThan(previousHp);
      expect(attrs.physicalAtk).toBeGreaterThan(previousAtk);
      previousHp = attrs.maxHp;
      previousAtk = attrs.physicalAtk;
    }
  });
});
