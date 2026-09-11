import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/methods.json';
import schema from './data/methods.schema.json';
import { loadSectMethodsPack, SectMethodsPackShape } from './method-pack';
import { COMBAT_V6_SECT_DEFINITIONS } from './index';
import { compileSectDefinitionV6 } from './compiler';
import { createEmptySectCombatProgressV6, createFreshCombatV6MethodLevels } from '../build-state';

describe('宗门心法配置', () => {
  it('编辑器 Schema 与运行时结构一致', () => {
    expect(z.toJSONSchema(SectMethodsPackShape)).toEqual(schema);
  });
  it('拒绝重复槽位、外宗 ID 和多个主心法', () => {
    for (const change of [
      (data: typeof raw) => { data.sects.lingxiao[1].slot = 1; },
      (data: typeof raw) => { data.sects.lingxiao[0].id = 'youdu.method.canon'; },
      (data: typeof raw) => { data.sects.lingxiao[1].isPrimary = true; },
    ]) {
      const data = structuredClone(raw);
      change(data);
      expect(() => loadSectMethodsPack(data)).toThrow('content/data/methods.json: sects.lingxiao');
    }
  });
  it('修改心法面板系数后实际编译采用新值', () => {
    const data = structuredClone(raw);
    data.sects.lingxiao[0].panel.value = 3;
    const definition = { ...COMBAT_V6_SECT_DEFINITIONS.lingxiao, methods: loadSectMethodsPack(data).sects.lingxiao };
    const progress = createEmptySectCombatProgressV6('lingxiao', definition.paths[0].id, createFreshCombatV6MethodLevels('lingxiao'));
    const result = compileSectDefinitionV6({ definition, progress, characterLevel: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.projection.panel).toContainEqual({ attr: 'physicalAtk', mode: 'add', value: 3 });
  });
});
