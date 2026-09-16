import { z } from 'zod';

export const MANUAL_REALMS = ['炼气', '筑基', '金丹', '元婴'] as const;
export const MANUAL_ATTRIBUTES = [
  'vitality',
  'strength',
  'spirit',
  'endurance',
  'speed',
  'willpower',
] as const;
const positive = z.number().int().positive().max(1_000_000_000);
const cost = z.strictObject({
  experience: positive,
  insight: z.number().int().min(1).max(100),
});
const growth = {
  valueAt1: z.number().positive().max(0.2),
  valueAt9: z.number().positive().max(0.2),
};
export const ManualConditionShape = z.enum([
  'always',
  'selfHpBelow50',
  'selfHpBelow35',
  'selfHpAbove70',
  'targetHpBelow50',
  'targetHpBelow35',
  'targetHpAbove70',
  'selfMpBelow50',
  'selfMpAbove50',
  'selfMpAbove70',
  'defending',
  'selfBarrier',
  'targetBarrier',
  'targetDot',
  'selfControl',
  'selfDebuff',
]);
export const ManualMechanismShape = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('damage'),
    condition: ManualConditionShape,
    kinds: z
      .array(z.enum(['physical', 'spell', 'fixed']))
      .min(1)
      .max(3),
    ...growth,
  }),
  z.strictObject({
    type: z.literal('mitigation'),
    condition: ManualConditionShape,
    kinds: z
      .array(z.enum(['physical', 'spell']))
      .min(1)
      .max(2),
    ...growth,
  }),
  z.strictObject({
    type: z.enum([
      'heal',
      'barrier',
      'evasion',
      'sealResist',
      'restoreHp',
      'restoreMp',
    ]),
    condition: ManualConditionShape,
    ...growth,
  }),
]);
export type ManualMechanism = z.infer<typeof ManualMechanismShape>;
export const ManualPackShape = z.strictObject({
  $schema: z.string().optional(),
  version: z.literal(3),
  progressions: z.record(
    z.string().min(1),
    z.strictObject({
      maxLevel: z.number().int().min(2).max(99),
      bottlenecks: z.array(z.number().int().positive()),
      costsByRealm: z.record(z.enum(MANUAL_REALMS), z.array(cost)),
    }),
  ),
  manuals: z
    .array(
      z.strictObject({
        id: z.string().regex(/^character_manual\.[a-z][a-z0-9_-]*$/),
        name: z.string().min(1),
        realm: z.enum(MANUAL_REALMS),
        description: z.string().min(1),
        progressionId: z.string().min(1),
        effects: z
          .array(
            z.strictObject({
              attribute: z.enum(MANUAL_ATTRIBUTES),
              valueAt1: z.number().int().min(1).max(1000),
              valuePerLevel: z.number().int().min(1).max(100),
            }),
          )
          .min(1)
          .max(1),
        mechanism: ManualMechanismShape,
      }),
    )
    .min(1),
});
export const ManualPackSchema = ManualPackShape.superRefine((pack, ctx) => {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message });
  const ids = new Set<string>();
  pack.manuals.forEach((manual, i) => {
    if (ids.has(manual.id)) issue(['manuals', i, 'id'], '功法 ID 重复');
    ids.add(manual.id);
    const mechanism = manual.mechanism;
    if (mechanism.valueAt9 <= mechanism.valueAt1)
      issue(['manuals', i, 'mechanism'], '机制必须随层数增强');
    if (
      'kinds' in mechanism &&
      new Set(mechanism.kinds).size !== mechanism.kinds.length
    )
      issue(['manuals', i, 'mechanism'], '伤害类型重复');
    if (
      ['mitigation', 'evasion', 'restoreHp', 'restoreMp'].includes(
        mechanism.type,
      ) &&
      mechanism.condition.startsWith('target')
    )
      issue(['manuals', i, 'mechanism'], '防护与回合恢复仅支持自身条件');
    if (mechanism.type === 'sealResist' && mechanism.condition !== 'always')
      issue(['manuals', i, 'mechanism'], '封印抵抗为常驻能力');
    if (!pack.progressions[manual.progressionId])
      issue(['manuals', i, 'progressionId'], '培养规则不存在');
    if (
      new Set(manual.effects.map((e) => e.attribute)).size !==
      manual.effects.length
    )
      issue(['manuals', i, 'effects'], '属性不能重复');
  });
  for (const [id, rule] of Object.entries(pack.progressions)) {
    if (
      rule.bottlenecks.some(
        (n, i) => n >= rule.maxLevel || (i > 0 && n <= rule.bottlenecks[i - 1]),
      )
    )
      issue(['progressions', id, 'bottlenecks'], '瓶颈必须递增且低于满层');
    for (const realm of MANUAL_REALMS) {
      if (rule.costsByRealm[realm].length !== rule.maxLevel - 1)
        issue(
          ['progressions', id, 'costsByRealm', realm],
          '必须逐层配置二层至满层的费用',
        );
    }
  }
});
export function loadManualPack(data: unknown) {
  return ManualPackSchema.parse(data);
}
