import {
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@daoyou/constants/realms';
import { COMBAT_DUNGEON_ENEMIES_SCHEMA as schema } from '@daoyou/game-content/authoring/combat';
import { DungeonEnemyPackShape } from '@daoyou/game-content/combat/dungeon';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dungeonEnemyAttrs } from './enemy-attrs.js';

/**
 * 中期普通构筑：自由点均分、普通品阶六件套、该境界野生普通灵兽，只算普攻。
 * 校准云游锚点时使用，运行时敌人不再读取这套人物。
 */
const ORDINARY: Record<RealmType, { hp: number; atk: number; def: number; beast: number }> = {
  炼气: { hp: 890, atk: 203, def: 137, beast: 62 },
  筑基: { hp: 1453, atk: 371, def: 286, beast: 164 },
  金丹: { hp: 2008, atk: 545, def: 432, beast: 261 },
  元婴: { hp: 2570, atk: 713, def: 579, beast: 407 },
  化神: { hp: 3133, atk: 881, def: 727, beast: 507 },
  炼虚: { hp: 3687, atk: 1055, def: 874, beast: 596 },
  合体: { hp: 4250, atk: 1223, def: 1021, beast: 745 },
  大乘: { hp: 4813, atk: 1391, def: 1169, beast: 894 },
  渡劫: { hp: 5367, atk: 1565, def: 1315, beast: 1047 },
};

function physicalHit(atk: number, def: number) {
  const raw = def >= atk * 0.9 ? atk * 0.1 : Math.max(0, atk - def);
  return Math.max(1, Math.floor(raw * 1.3));
}

function fight(
  realm: RealmType,
  stage: RealmStage,
  tier: 'easy' | 'normal' | 'hard' | 'elite' | 'boss',
  template: 'normal' | 'elite' | 'boss',
) {
  const ref = ORDINARY[realm];
  const enemy = dungeonEnemyAttrs({ realm, stage, tier, template });
  const count = template === 'elite' ? 2 : 1;
  const enemies = Array.from({ length: count }, () => ({ hp: enemy.maxHp }));
  let hp = ref.hp;
  let round = 0;
  const living = () => enemies.filter((unit) => unit.hp > 0);
  while (living().length > 0 && hp > 0 && round < 80) {
    round += 1;
    for (const _unit of living()) {
      hp -= physicalHit(enemy.physicalAtk, ref.def);
      if (hp <= 0) break;
    }
    if (hp <= 0) break;
    living()[0].hp -=
      physicalHit(ref.atk, enemy.physicalDef) +
      physicalHit(ref.beast, enemy.physicalDef);
  }
  return {
    win: hp > 0 && living().length === 0,
    ratio: hp / ref.hp,
  };
}

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

  it('前期三个大境界用普通装备和一只普通灵兽打得过，之后难度逐境升高', () => {
    for (const realm of ['炼气', '筑基', '金丹'] as const) {
      const hardest = fight(realm, '圆满', 'boss', 'boss');
      expect(hardest.win).toBe(true);
      expect(hardest.ratio).toBeGreaterThanOrEqual(0.3);
    }
    expect(fight('元婴', '中期', 'normal', 'normal').win).toBe(true);
    expect(fight('元婴', '圆满', 'boss', 'boss').win).toBe(false);
    expect(fight('化神', '中期', 'normal', 'normal').win).toBe(true);
    expect(fight('炼虚', '初期', 'easy', 'normal').win).toBe(true);
    expect(fight('炼虚', '中期', 'normal', 'normal').win).toBe(false);
    expect(fight('合体', '初期', 'easy', 'normal').win).toBe(false);
    expect(fight('渡劫', '中期', 'normal', 'normal').win).toBe(false);

    let previous = 0;
    for (const realm of REALM_VALUES) {
      const enemy = dungeonEnemyAttrs({
        realm,
        stage: '中期',
        tier: 'normal',
        template: 'normal',
      });
      const ref = ORDINARY[realm];
      const pressure =
        physicalHit(enemy.physicalAtk, ref.def) /
        (physicalHit(ref.atk, enemy.physicalDef) +
          physicalHit(ref.beast, enemy.physicalDef));
      expect(pressure).toBeGreaterThan(previous);
      previous = pressure;
    }
  });
});
