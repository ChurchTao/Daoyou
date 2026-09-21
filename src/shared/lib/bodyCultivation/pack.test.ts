import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/body-cultivation.json';
import schema from './data/body-cultivation.schema.json';
import { BodyCultivationPackShape, BODY_CULTIVATION_TRACK_KEYS, loadBodyCultivationPack, bodyCultivationThreshold } from './pack';
import { bodyCultivationEffectTexts } from './benefits';
import { compileBodyCultivationV6 } from '@shared/engine/combat-v6/projection/body-cultivation-v6';
import { compileCharacterPanelV1 } from '@shared/engine/combat-v6/projection/character-panel-v1';
import type { BodyCultivationState } from '@shared/types/condition';

function state(level: number): BodyCultivationState {
  return { version: 1, realm: 'dao_body', milestones: {}, tracks: Object.fromEntries(BODY_CULTIVATION_TRACK_KEYS.map(key => [key, { level, progress: 0 }])) as BodyCultivationState['tracks'] };
}
const basePanel = compileCharacterPanelV1({ vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 });
describe('炼体成长与收益数据包', () => {
  it('编辑器 Schema 与运行时结构一致', () => expect(z.toJSONSchema(BodyCultivationPackShape, { reused: 'ref' })).toEqual(schema));
  it('配置修改联动进度、展示、投影与最高等级夹取', () => {
    const data = structuredClone(raw);
    data.progress.base = 120;
    data.progress.perLevel = 80;
    data.tracks.skin.benefit.perLevel = 2;
    data.tracks.qi_blood.benefit.hpRatioPerLevel = 0.01;
    data.tracks.qi_blood.benefit.healLevelsPerPoint = 3;
    data.realms[6].softTrackCap = 70;
    const pack = loadBodyCultivationPack(data);
    expect(bodyCultivationThreshold(10, pack)).toBe(920);
    expect(bodyCultivationEffectTexts('skin', 10, pack)).toEqual(['防御修炼 Lv.20']);
    expect(bodyCultivationEffectTexts('qi_blood', 10, pack)).toEqual(['裸身气血 +10%', '固定治疗强度 +3']);
    const input = state(71);
    const result = compileBodyCultivationV6(input, { ...basePanel, maxHp: 1000 }, pack);
    expect(result).toMatchObject({ defenseCultivate: 140, lifeFoundationLevel: 70, maxHpBonus: 700, healPowerBonus: 23 });
    expect(result.diagnostics).toHaveLength(5);
    expect(input.tracks.skin.level).toBe(71);
  });
  it('拒绝未知字段、重复修炼属性、不可达位阶及倒退上限', () => {
    expect(() => loadBodyCultivationPack({ ...raw, unknown: 1 })).toThrow('body-cultivation.json');
    const duplicate = structuredClone(raw);
    duplicate.tracks.skin.benefit.attribute = 'attackCultivate';
    expect(() => loadBodyCultivationPack(duplicate)).toThrow('各映射一次');
    const unreachable = structuredClone(raw);
    unreachable.realms[1].totalLevel = 26;
    expect(() => loadBodyCultivationPack(unreachable)).toThrow('无法达到');
    const cap = structuredClone(raw);
    cap.realms[1].softTrackCap = 4;
    expect(() => loadBodyCultivationPack(cap)).toThrow('递增');
  });
});
