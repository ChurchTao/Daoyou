import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES } from '../core';
import raw from './data/methods.json';
import type { SectMethodDefV6, CombatV6SectId } from './types';

const methods = z.array(z.strictObject({
  id: z.string().regex(/^[a-z]+\.method\.[a-z_]+$/),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  name: z.string().trim().min(1).max(60),
  isPrimary: z.boolean(),
  panel: z.strictObject({
    attr: z.enum(ATTR_NAMES),
    mode: z.enum(['add', 'multiply']),
    value: z.number().min(0).max(10000).multipleOf(0.000001),
  }).optional(),
})).length(6);
export const SectMethodsPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  sects: z.strictObject({ lingxiao: methods, youdu: methods, wuxiang: methods, tianyan: methods, jiujie: methods }),
});
export function loadSectMethodsPack(data: unknown) {
  const result = SectMethodsPackShape.superRefine((pack, ctx) => {
    for (const [sectId, entries] of Object.entries(pack.sects)) {
      const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path: ['sects', sectId, ...path], message });
      if (entries.filter(m => m.isPrimary).length !== 1) issue([], '必须恰有一个主心法');
      entries.forEach((method, index) => {
        if (!method.id.startsWith(sectId + '.method.')) issue([index, 'id'], '心法 ID 不属于当前宗门：' + method.id);
        if (entries.findIndex(m => m.id === method.id) !== index) issue([index, 'id'], '心法 ID 重复：' + method.id);
        if (entries.findIndex(m => m.slot === method.slot) !== index) issue([index, 'slot'], '心法槽位重复：' + method.id);
      });
    }
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/methods.json', data, result.error.issues));
  return result.data;
}
export const SECT_METHODS: Record<CombatV6SectId, SectMethodDefV6[]> = loadSectMethodsPack(raw).sects;
