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
export const ManualPackShape = z.strictObject({
  $schema: z.string().optional(),
  version: z.literal(1),
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
        rarity: z.enum(['common', 'rare']),
        description: z.string().min(1),
        progressionId: z.string().min(1),
        dropWeight: positive,
        effects: z
          .array(
            z.strictObject({
              attribute: z.enum(MANUAL_ATTRIBUTES),
              valuePerLevel: z.number().int().min(1).max(100),
            }),
          )
          .min(1)
          .max(2),
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
