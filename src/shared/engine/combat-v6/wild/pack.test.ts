import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/wild.json';
import schema from './data/wild.schema.json';
import before from './fixtures/before-g6.json';
import { WildPackShape, loadWildPack } from './pack';
import { WILD_REGION, WILD_SPECIES, WILD_SKILLS, wildPanel } from './content';
import { generateWildEncounter } from './generator';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
describe('野外内容数据包', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(WildPackShape, { reused: 'ref' })).toEqual(schema));
  it('结构错误同时包含文件、物种ID和字段路径', () => {
    const data = structuredClone(raw);
    data.species[0].name = '';
    expect(() => loadWildPack(data)).toThrow(
      `wild/data/wild.json: species.0.name [${data.species[0].id}]`,
    );
  });
  it('活动次数与探索冷却独立配置并拒绝非法数值', () => {
    const data = structuredClone(raw);
    data.activity = { dailyLimit: 7, explorationCooldownMs: 5000 };
    expect(loadWildPack(data).activity).toEqual(data.activity);
    for (const key of ['dailyLimit', 'explorationCooldownMs'] as const) {
      const invalid = structuredClone(data);
      invalid.activity[key] = 0;
      expect(() => loadWildPack(invalid)).toThrow(key);
    }
  });
  it('物种技能、全部等级面板和512种子编组保持原基线', () => {
    const panels = WILD_SPECIES.flatMap(s => Array.from({ length: 11 }, (_, i) => wildPanel(s.id, i + 5)));
    const encounters = Array.from({ length: 512 }, (_, seed) => generateWildEncounter(WILD_REGION.nodeId, seed));
    expect({ content: hash({ region: WILD_REGION, species: WILD_SPECIES, skills: WILD_SKILLS }), panels: hash(panels), encounters: hash(encounters) }).toEqual(before);
  });
  it('配置变化影响生成数量、等级与实际面板', () => {
    const data = structuredClone(raw);
    data.encounter.minCount = data.encounter.maxCount = 4;
    data.region.minLevel = data.region.maxLevel = 10;
    for (const id of Object.keys(data.panels) as (keyof typeof data.panels)[]) data.panels[id] = data.panels[id].filter(p => p.level === 10);
    data.panels['combat.wild.species.spirit-fox'][0].maxHp = 999;
    const pack = loadWildPack(data);
    const encounter = generateWildEncounter(pack.region.nodeId, 1, pack);
    expect(encounter).toHaveLength(4);
    expect(encounter.every(c => c.level === 10)).toBe(true);
    expect(wildPanel('combat.wild.species.spirit-fox', 10, pack).maxHp).toBe(999);
  });
  it('拒绝缺失等级、未知技能、无效表达式和重复物种', () => {
    const missing = structuredClone(raw);
    missing.panels['combat.wild.species.spirit-fox'].pop();
    expect(() => loadWildPack(missing)).toThrow('完整连续区间');
    const skill = structuredClone(raw);
    skill.species[0].skillIds = ['combat.wild.skill.missing'];
    expect(() => loadWildPack(skill)).toThrow('技能引用');
    const expression = structuredClone(raw);
    expression.skills[0].effects[0].power = 'unknown + 1';
    expect(() => loadWildPack(expression)).toThrow('power');
    const duplicate = structuredClone(raw);
    duplicate.species[1].id = duplicate.species[0].id;
    expect(() => loadWildPack(duplicate)).toThrow('重复');
  });
});
