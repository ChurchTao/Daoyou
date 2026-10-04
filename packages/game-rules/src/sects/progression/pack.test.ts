import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SECTS_PROGRESSION_PROGRESSION_DATA as raw } from '@daoyou/game-content/sects/progression';
import { SECTS_PROGRESSION_PROGRESSION_SCHEMA as schema } from '@daoyou/game-content/authoring/sects';
import { SectProgressionPackShape, loadSectProgressionPack, configuredMethodCost, configuredMeridianCost } from '../progression-pack.js';

describe('宗门养成配置', () => {
  it('编辑器 Schema 与运行时结构一致', () => {
    expect(z.toJSONSchema(SectProgressionPackShape)).toEqual(schema);
  });
  it('修改配置改变费用，同时保留取整算法', () => {
    const data = structuredClone(raw);
    data.method.expBase = 123;
    data.method.stonesPerExp = 2;
    data.meridian.insight = 200;
    const pack = loadSectProgressionPack(data);
    expect(configuredMethodCost(pack, 1)).toEqual({ cultivationExp: 130, spiritStones: 300, comprehensionInsight: 0 });
    expect(configuredMeridianCost(pack, 7).comprehensionInsight).toBe(200);
  });
  it('拒绝倒序门槛、溢出及产生小数的经济配置', () => {
    const descending = structuredClone(raw);
    descending.meridian.characterLevels[1] = 20;
    expect(() => loadSectProgressionPack(descending)).toThrow('meridian.characterLevels.1');
    const overflow = structuredClone(raw);
    overflow.method.expGrowth = 100;
    expect(() => loadSectProgressionPack(overflow)).toThrow('method.');
    const fractional = structuredClone(raw);
    fractional.meridian.stonesPerExp = 0.000001;
    expect(() => loadSectProgressionPack(fractional)).toThrow('spiritStones');
  });
})
