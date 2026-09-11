import { z } from 'zod';
import { DAO_EQUIPMENT_SLOTS } from './types';

const ratio = z.number().min(0).max(1).multipleOf(0.000001);
const positive = z.number().positive().max(1_000_000).multipleOf(0.000001);
const text = z.string().trim().min(1);
const slots = z.array(z.enum(DAO_EQUIPMENT_SLOTS)).min(1).optional();
const essenceEffect = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('panelAdd'),
    attribute: z.enum([
      'physicalAtk',
      'physicalDef',
      'magicAtk',
      'magicDef',
      'maxHp',
      'maxMp',
      'healPower',
      'speed',
      'hit',
      'dodge',
      'critRate',
      'spellCritRate',
      'physicalFuryRate',
      'sealHit',
      'sealResist',
    ]),
    value: z.number().min(-1_000_000).max(1_000_000),
  }),
  z.strictObject({
    type: z.literal('requiredLevelOffset'),
    value: z.number().int().min(-180).max(0),
  }),
  z.strictObject({
    type: z.literal('rageGain'),
    factor: z.number().min(1).max(100).multipleOf(0.000001),
  }),
  z.strictObject({ type: z.literal('rageCost'), factor: ratio.positive() }),
]);
const artEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('heal'), ratio }),
  z.strictObject({ type: z.literal('restoreMp'), ratio }),
  z.strictObject({ type: z.literal('revive'), hpRatio: ratio }),
  z.strictObject({
    type: z.literal('dispel'),
    side: z.enum(['ally', 'enemy']),
    categories: z.array(z.enum(['buff', 'control'])).min(1),
  }),
  z.strictObject({
    type: z.literal('defenseBuff'),
    attribute: z.enum(['physicalDef', 'magicDef']),
    ratio,
    duration: z.number().int().min(1).max(99),
    statusId: z.string().regex(/^dao_equipment\.status\.[a-z][a-z0-9_]*$/),
  }),
  z.strictObject({
    type: z.literal('physicalHit'),
    coefficient: positive,
    defenseIgnore: ratio,
  }),
  z.strictObject({
    type: z.literal('spellHit'),
    coefficient: positive,
    targetCount: z.number().int().min(1).max(10),
  }),
]);

export const EquipmentSpecialPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  essences: z
    .array(
      z.strictObject({
        id: z.string().regex(/^dao_equipment\.essence\.[a-z][a-z0-9_]*$/),
        name: text,
        allowedSlots: slots,
        stackPolicy: z.enum(['stack', 'unique', 'highest']),
        conflictGroup: text.optional(),
        effect: essenceEffect,
      }),
    )
    .min(1),
  arts: z
    .array(
      z.strictObject({
        id: z.string().regex(/^dao_equipment\.art\.[a-z][a-z0-9_]*$/),
        name: text,
        allowedSlots: slots,
        skillId: z.string().regex(/^dao_equipment\.skill\.[a-z][a-z0-9_]*$/),
        includeDownedInMultiSect: z.boolean().optional(),
        rageCost: z.number().int().min(0).max(1_000_000),
        effect: artEffect,
      }),
    )
    .min(1),
  rageResource: z.strictObject({
    name: text,
    initial: z.number().int().nonnegative(),
    maximum: positive.int(),
  }),
  rageGain: z.strictObject({
    minPerHit: z.number().int().nonnegative(),
    maxPerHit: positive.int(),
    damagePercentScale: positive,
    maxPerAction: positive.int(),
  }),
});

export const EquipmentSpecialPackSchema = EquipmentSpecialPackShape.superRefine(
  (pack, ctx) => {
    const ids = new Set<string>();
    const uniqueId = (id: string, path: (string | number)[]) => {
      if (ids.has(id))
        ctx.addIssue({ code: 'custom', path, message: `ID 重复：${id}` });
      ids.add(id);
    };
    for (const group of ['essences', 'arts'] as const)
      pack[group].forEach((entry, i) => {
        uniqueId(entry.id, [group, i, 'id']);
        if (
          entry.allowedSlots &&
          new Set(entry.allowedSlots).size !== entry.allowedSlots.length
        )
          ctx.addIssue({
            code: 'custom',
            path: [group, i, 'allowedSlots'],
            message: '部位不得重复',
          });
      });
    pack.arts.forEach((art, i) => {
      uniqueId(art.skillId, ['arts', i, 'skillId']);
      if (
        art.includeDownedInMultiSect &&
        (art.effect.type !== 'dispel' || art.effect.side !== 'ally')
      )
        ctx.addIssue({
          code: 'custom',
          path: ['arts', i, 'includeDownedInMultiSect'],
          message: '仅友方驱散支持此历史阶段目标扩展',
        });
      if (art.effect.type === 'defenseBuff')
        uniqueId(art.effect.statusId, ['arts', i, 'effect', 'statusId']);
      if (
        art.effect.type === 'dispel' &&
        new Set(art.effect.categories).size !== art.effect.categories.length
      )
        ctx.addIssue({
          code: 'custom',
          path: ['arts', i, 'effect', 'categories'],
          message: '驱散类别不得重复',
        });
    });
    if (pack.rageResource.initial > pack.rageResource.maximum)
      ctx.addIssue({
        code: 'custom',
        path: ['rageResource', 'initial'],
        message: '初始战意不得超过上限',
      });
    if (pack.rageGain.minPerHit > pack.rageGain.maxPerHit)
      ctx.addIssue({
        code: 'custom',
        path: ['rageGain', 'minPerHit'],
        message: '单次下限不得超过上限',
      });
  },
);

export type EquipmentSpecialPack = z.infer<typeof EquipmentSpecialPackShape>;

export function loadEquipmentSpecialPack(data: unknown) {
  const result = EquipmentSpecialPackSchema.safeParse(data);
  if (result.success) return result.data;
  throw new Error(
    result.error.issues
      .map((issue) => {
        let entry: unknown = data;
        for (const key of issue.path.slice(0, 2))
          entry =
            entry && typeof entry === 'object'
              ? Reflect.get(entry, key)
              : undefined;
        const id =
          entry && typeof entry === 'object' && 'id' in entry
            ? ` [${String(entry.id)}]`
            : '';
        return `equipment-special.json${id} ${issue.path.join('.')}: ${issue.message}`;
      })
      .join('\n'),
  );
}
