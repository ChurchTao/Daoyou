import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/blessings.json';
import schema from './data/blessings.schema.json';
import before from './fixtures/before-blessings.json';
import { TOWER_BLESSING_DEFINITIONS, TOWER_BLESSING_IDS, compileTowerBlessingDefinitions } from './blessings';
import { TowerBlessingsPackShape, loadTowerBlessingsPack, towerBlessingResourceRatio } from './blessing-pack';
import { buildTowerBlessingChoices } from './helpers';
import { getTowerBlessingEffectPreview } from './presentation';
import { projectTowerPlayer } from '@shared/engine/combat-v6/tower/host';
import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';

const input: CombatV6TrainingPlayerInput = {
  cultivator: { id: 'player', name: '基线', realm: '金丹', realm_stage: '初期', attributes: { vitality: 54, strength: 53, spirit: 52, endurance: 51, speed: 50, willpower: 49 } },
  equipment: {}, manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
};
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
describe('幻境祝福内容包', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TowerBlessingsPackShape, { reused: 'ref' })).toEqual(schema));
  it('定义、抽取和预览保持基线，人物投影采用当前六维公式', () => {
    const states = [{}, ...TOWER_BLESSING_IDS.flatMap(id => [1, 3, 5].map(n => ({ [id]: n }))), Object.fromEntries(TOWER_BLESSING_IDS.map(id => [id, TOWER_BLESSING_DEFINITIONS[id].maxStacks]))];
    const projections = states.map(s => projectTowerPlayer(input, s));
    const choices = Array.from({ length: 128 }, (_, i) => buildTowerBlessingChoices({ runId: 'baseline-' + i, clearedFloor: i % 20 + 1, blessings: states[i % states.length], currentHp: i % 2 ? 20 : 90, maxHp: 100, currentMp: i % 3 ? 10 : 90, maxMp: 100 }));
    const previews = TOWER_BLESSING_IDS.flatMap(blessingId => Array.from({ length: 6 }, (_, currentStacks) => getTowerBlessingEffectPreview({ blessingId, currentStacks, nextStacks: currentStacks + 1, currentHp: 120, maxHp: 320, currentMp: 40, maxMp: 240 })));
    expect({ definitions: hash(TOWER_BLESSING_DEFINITIONS), projections: hash(projections), choices: hash(choices), previews: hash(previews) }).toEqual(before);
  });
  it('配置变化同时作用于说明、预览、实际投影与战前回复比例', () => {
    const data = structuredClone(raw);
    data.blessings[0].effect.perStack = 0.2;
    data.blessings[8].effect.perStack = 0.2;
    const pack = loadTowerBlessingsPack(data);
    expect(compileTowerBlessingDefinitions(pack).vitality_surge.description).toContain('20%');
    expect(getTowerBlessingEffectPreview({ blessingId: 'vitality_surge', currentStacks: 2 }, pack).currentLabel).toBe('体魄 +40%');
    expect(projectTowerPlayer(input, { vitality_surge: 1 }, pack).unit.attrs!.maxHp).toBeGreaterThan(projectTowerPlayer(input, { vitality_surge: 1 }).unit.attrs!.maxHp!);
    expect(towerBlessingResourceRatio({ breathing_technique: 2 }, 'recovery', 'hp', pack)).toBe(0.4);
    expect(getTowerBlessingEffectPreview({ blessingId: 'breathing_technique', currentStacks: 2, maxHp: 100, currentHp: 20 }, pack).currentLabel).toBe('战前回复 40% 缺失气血（约 32 点）');
  });
  it('配置候选数和低资源阈值控制抽取', () => {
    const data = structuredClone(raw);
    data.choices.count = 2;
    data.choices.forced[0].atOrBelow = 0.9;
    const choices = buildTowerBlessingChoices({ runId: 'changed', clearedFloor: 1, blessings: {}, currentHp: 80, maxHp: 100, currentMp: 20, maxMp: 100 }, loadTowerBlessingsPack(data));
    expect(choices.map(c => c.id)).toEqual(['breathing_technique', 'meridian_cycle']);
  });
  it('拒绝重复身份、不匹配推荐和过量回复', () => {
    const duplicate = structuredClone(raw);
    duplicate.blessings[1].id = duplicate.blessings[0].id;
    expect(() => loadTowerBlessingsPack(duplicate)).toThrow('唯一');
    const forced = structuredClone(raw);
    forced.choices.forced[0].id = 'vitality_surge';
    expect(() => loadTowerBlessingsPack(forced)).toThrow('回复祝福');
    const recovery = structuredClone(raw);
    recovery.blessings[8].effect.perStack = 0.5;
    expect(() => loadTowerBlessingsPack(recovery)).toThrow('回复比例');
  });
});
