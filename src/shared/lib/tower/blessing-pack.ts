import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import raw from './data/blessings.json';

export const TOWER_BLESSING_IDS = ['vitality_surge', 'strength_surge', 'spirit_surge', 'endurance_surge', 'swift_step', 'mind_focus', 'jade_bones', 'sea_of_qi', 'breathing_technique', 'meridian_cycle', 'balanced_dao'] as const;
export type TowerBlessingId = (typeof TOWER_BLESSING_IDS)[number];
export const TOWER_BASE_ATTRIBUTES = ['vitality', 'strength', 'spirit', 'endurance', 'speed', 'willpower'] as const;
const id = z.enum(TOWER_BLESSING_IDS);
const resource = z.enum(['hp', 'mp']);
const ratio = z.number().min(0).max(1);
export const TowerBlessingsPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  blessings: z.array(z.strictObject({
    id, name: z.string().min(1).max(50), label: z.string().min(1).max(50), maxStacks: z.number().int().min(1).max(99),
    effect: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('attribute'), attribute: z.enum(TOWER_BASE_ATTRIBUTES), perStack: ratio }),
      z.strictObject({ kind: z.literal('allAttributes'), perStack: ratio }),
      z.strictObject({ kind: z.enum(['resourceMax', 'recovery']), resource, perStack: ratio }),
    ]),
  })).length(TOWER_BLESSING_IDS.length),
  choices: z.strictObject({ count: z.number().int().min(1).max(TOWER_BLESSING_IDS.length), forced: z.array(z.strictObject({ id, resource, atOrBelow: ratio })) }),
});
export function loadTowerBlessingsPack(data: unknown) {
  const result = TowerBlessingsPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (new Set(pack.blessings.map(b => b.id)).size !== TOWER_BLESSING_IDS.length) issue(['blessings'], '祝福 ID 必须完整且唯一');
    pack.blessings.forEach((b, i) => {
      if (b.effect.kind === 'recovery' && b.effect.perStack * b.maxStacks > 1) issue(['blessings', i, b.id], '满层回复比例不能超过1');
    });
    const forcedIds = new Set<string>();
    pack.choices.forced.forEach((rule, i) => {
      if (forcedIds.has(rule.id)) issue(['choices', 'forced', i, rule.id], '推荐祝福重复');
      forcedIds.add(rule.id);
      const blessing = pack.blessings.find(b => b.id === rule.id);
      if (!blessing || blessing.effect.kind !== 'recovery' || blessing.effect.resource !== rule.resource) issue(['choices', 'forced', i, rule.id], '推荐规则必须引用对应资源的回复祝福');
    });
    if (forcedIds.size > pack.choices.count) issue(['choices', 'count'], '候选数量不足以容纳推荐祝福');
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('tower/data/blessings.json', data, result.error.issues));
  return result.data;
}
export const TOWER_BLESSINGS_PACK = loadTowerBlessingsPack(raw);
export function towerBlessingRule(id: TowerBlessingId, pack = TOWER_BLESSINGS_PACK) {
  return pack.blessings.find(b => b.id === id)!;
}
export function towerBlessingResourceRatio(blessings: Partial<Record<TowerBlessingId, number>>, kind: 'resourceMax' | 'recovery', resource: 'hp' | 'mp', pack = TOWER_BLESSINGS_PACK): number {
  let ratio = 0;
  for (const blessing of pack.blessings) {
    const effect = blessing.effect;
    if (effect.kind === kind && effect.resource === resource) ratio += (blessings[blessing.id] ?? 0) * effect.perStack;
  }
  return ratio;
}
