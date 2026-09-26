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
    type: z.literal('requiredStageOffset'),
    value: z.number().int().min(-1).max(0),
  }),
  z.strictObject({
    type: z.literal('rageGain'),
    factor: z.number().min(1).max(100).multipleOf(0.000001),
  }),
  z.strictObject({ type: z.literal('rageCost'), factor: ratio.positive() }),
  z.strictObject({
    type: z.literal('sealChance'),
    side: z.enum(['hit', 'resist']),
    value: ratio,
  }),
  z.strictObject({
    type: z.literal('antiCrit'),
    kind: z.enum(['physical', 'spell']),
    value: ratio,
  }),
  z.strictObject({
    type: z.literal('defenseIgnore'),
    kind: z.enum(['physical', 'spell']),
    value: ratio,
  }),
  z.strictObject({ type: z.literal('mpWaiver'), chance: ratio }),
  z.strictObject({ type: z.literal('regeneration'), levelRatio: ratio }),
  z.strictObject({
    type: z.literal('revival'),
    chance: ratio,
    hpRatio: ratio.positive(),
  }),
]);
const artEffect = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('heal'),
    ratio,
    capPerLevel: positive.optional(),
  }),
  z.strictObject({
    type: z.literal('revive'),
    hpRatio: ratio.positive(),
    capPerLevel: positive.optional(),
  }),
  z.strictObject({
    type: z.literal('cleanse'),
    kinds: z.array(text).min(1),
    healRatio: ratio,
  }),
  z.strictObject({ type: z.literal('rageDamage'), amount: positive.int() }),
  z.strictObject({
    type: z.literal('status'),
    statusId: z.string().regex(/^dao_equipment\.status\.[a-z][a-z0-9_]*$/),
    group: text,
    modifier: z.enum([
      'physicalDealt',
      'spellDealt',
      'physicalTaken',
      'spellTaken',
      'speed',
      'healTaken',
    ]),
    ratio: z.number().min(-1).max(1).multipleOf(0.000001),
    duration: z.union([z.literal('battle'), z.number().int().min(1).max(99)]),
  }),
  z.strictObject({
    type: z.literal('restoreMp'),
    ratio,
    casterLevelFactor: positive,
    capPerLevel: positive.optional(),
  }),
  z.strictObject({
    type: z.literal('massRevive'),
    hpRatio: ratio.positive(),
    remainingHpRatio: ratio.positive(),
    remainingMpRatio: ratio,
  }),
  z.strictObject({
    type: z.literal('dispelBuff'),
    chance: ratio,
    artChance: ratio,
  }),
  z.strictObject({
    type: z.literal('attack'),
    kind: z.enum(['physical', 'spell']),
    resultFactors: z.array(ratio.positive()).min(1).max(10),
    defenseIgnore: ratio.optional(),
    mpDamageRatio: positive.optional(),
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
        description: text,
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
        description: text,
        target: z.enum(['self', 'ally', 'allies', 'enemy', 'enemies']),
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
    damagePercentScale: positive,
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
      if (art.effect.type === 'status')
        uniqueId(art.effect.statusId, ['arts', i, 'effect', 'statusId']);
      if (
        art.effect.type === 'cleanse' &&
        new Set(art.effect.kinds).size !== art.effect.kinds.length
      )
        ctx.addIssue({
          code: 'custom',
          path: ['arts', i, 'effect', 'kinds'],
          message: '解控类别不得重复',
        });
      const friendly = ['self', 'ally', 'allies'].includes(art.target);
      if (
        (['heal', 'revive', 'cleanse', 'restoreMp', 'massRevive'].includes(
          art.effect.type,
        ) &&
          !friendly) ||
        (['rageDamage', 'attack'].includes(art.effect.type) &&
          art.target !== 'enemy') ||
        (art.effect.type === 'revive' && art.target !== 'ally') ||
        (art.effect.type === 'massRevive' && art.target !== 'allies') ||
        (art.effect.type === 'dispelBuff' && art.target !== 'enemies') ||
        (art.effect.type === 'attack' &&
          art.effect.mpDamageRatio !== undefined &&
          art.effect.kind !== 'physical')
      )
        ctx.addIssue({
          code: 'custom',
          path: ['arts', i, 'target'],
          message: '效果与目标范围不匹配',
        });
    });
    if (pack.rageResource.initial > pack.rageResource.maximum)
      ctx.addIssue({
        code: 'custom',
        path: ['rageResource', 'initial'],
        message: '初始战意不得超过上限',
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
