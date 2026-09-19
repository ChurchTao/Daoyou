import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/training.json';
import schema from './data/training.schema.json';
import { TrainingPackShape, compileTrainingContent, loadTrainingPack } from './pack';
import { COMBAT_V6_TRAINING_CONTENT_V1 } from './content';

describe('训练遭遇配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TrainingPackShape, { reused: 'ref' })).toEqual(schema));
  it('全部21单位、六场景、技能状态保持迁移前内容与顺序', () => {
    expect(createHash('sha256').update(JSON.stringify(COMBAT_V6_TRAINING_CONTENT_V1)).digest('hex')).toBe('302834d0f108662aec1929cff94ec4c51f404f72b08eb1e026527db1e5459eaa');
  });
  it('基础面板和模板配方决定敌友实际输入', () => {
    const data = structuredClone(raw);
    data.tiers[0].attrs.hp = data.tiers[0].attrs.maxHp = 6001;
    data.templates[0].maxHpMultiplier = 3;
    data.templates[2].initialHpRatio = 0.3;
    data.templates[4].speedBonus = 50;
    const content = compileTrainingContent(loadTrainingPack(data));
    expect(content.combatants[0].attrs.maxHp).toBe(18003);
    expect(content.combatants[2].attrs.hp).toBe(1800);
    expect(content.combatants[4].attrs.speed).toBe(170);
    expect(content.combatants[7].attrs.maxHp).toBe(54000);
    expect(content.combatants[8]).toEqual(COMBAT_V6_TRAINING_CONTENT_V1.combatants[8]);
  });
  it('拒绝错误引用、玩家阵位冲突、缺失档位与无效表达式', () => {
    const ref = structuredClone(raw);
    ref.templates[0].skillIds = ['combat.training.skill.missing'];
    expect(() => loadTrainingPack(ref)).toThrow('技能引用');
    const slots = structuredClone(raw);
    slots.encounters[0].participants[0].side = 0;
    expect(() => loadTrainingPack(slots)).toThrow('玩家阵位');
    const tiers = structuredClone(raw);
    tiers.tiers[1].level = 60;
    expect(() => loadTrainingPack(tiers)).toThrow('完整配置');
    const expression = structuredClone(raw);
    expression.skills[3].effects[0].power = 'missing + 1';
    expect(() => loadTrainingPack(expression)).toThrow('power');
  });
  it('拒绝轮转未持有技能、冲突配方和非法初始资源', () => {
    const rotation = structuredClone(raw);
    rotation.templates[4].strategy.skillIds = ['combat.training.skill.execute'];
    expect(() => loadTrainingPack(rotation)).toThrow('轮转技能');
    const conflict = structuredClone(raw);
    conflict.templates[2].initialHpFromLevel = true;
    expect(() => loadTrainingPack(conflict)).toThrow('不可同时配置');
    const resource = structuredClone(raw);
    resource.tiers[0].attrs.hp = 100000;
    expect(() => loadTrainingPack(resource)).toThrow('资源超出上限');
  });
});
