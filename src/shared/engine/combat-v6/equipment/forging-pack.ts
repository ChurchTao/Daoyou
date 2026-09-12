import { z } from 'zod';
import { QUALITY_VALUES } from '../../../types/constants';
import { EQUIPMENT_LEVELS } from './realm';
import {
  DAO_EQUIPMENT_SLOTS,
  type DaoEquipmentArtDefV1,
  type DaoEquipmentEssenceDefV1,
} from './types';

const probability = z.number().min(0).max(1);
export const EquipmentForgingPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  generation: z.strictObject({
    essenceCountProbabilities: z.tuple([probability, probability, probability]),
    artChance: probability,
    essencePool: z.array(z.string().min(1)).min(1),
    artPool: z.array(z.string().min(1)).min(1),
  }),
  forging: z.strictObject({
    boostPerMaterial: z.number().min(0).max(0.2).multipleOf(0.000001),
    costs: z
      .array(
        z.strictObject({
          level: z.union(EQUIPMENT_LEVELS.map((level) => z.literal(level))),
          spiritStones: z.number().int().nonnegative().max(100_000_000),
          qi: z.number().int().nonnegative().max(1_000_000),
          quantity: z.number().int().min(1).max(5),
          rank: z.enum(QUALITY_VALUES),
        }),
      )
      .length(9),
  }),
});

type SpecialDefinitions = {
  essences: readonly DaoEquipmentEssenceDefV1[];
  arts: readonly DaoEquipmentArtDefV1[];
};

export function loadEquipmentForgingPack(
  data: unknown,
  definitions: SpecialDefinitions,
) {
  const schema = EquipmentForgingPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const total = pack.generation.essenceCountProbabilities.reduce(
      (sum, p) => sum + p,
      0,
    );
    if (Math.abs(total - 1) > 1e-12)
      issue(['generation', 'essenceCountProbabilities'], '概率之和必须为 1');
    for (const [pool, entries] of [
      ['essencePool', definitions.essences],
      ['artPool', definitions.arts],
    ] as const) {
      const ids = pack.generation[pool];
      ids.forEach((id, i) => {
        if (ids.indexOf(id) !== i)
          issue(['generation', pool, i], `ID 重复：${id}`);
        if (!entries.some((entry) => entry.id === id))
          issue(['generation', pool, i], `引用不存在：${id}`);
      });
      const needed =
        pool === 'artPool'
          ? pack.generation.artChance > 0
            ? 1
            : 0
          : pack.generation.essenceCountProbabilities[2] > 0
            ? 2
            : pack.generation.essenceCountProbabilities[1] > 0
              ? 1
              : 0;
      for (const slot of DAO_EQUIPMENT_SLOTS) {
        if (
          entries.filter(
            (entry) =>
              ids.includes(entry.id) &&
              (!entry.allowedSlots || entry.allowedSlots.includes(slot)),
          ).length < needed
        )
          issue(
            ['generation', pool],
            `${slot} 可用内容不足 ${needed} 个，无法满足配置概率`,
          );
      }
    }
    const levels = new Set<number>();
    pack.forging.costs.forEach((cost, i) => {
      if (levels.has(cost.level))
        issue(['forging', 'costs', i, 'level'], `器阶重复：${cost.level}`);
      levels.add(cost.level);
    });
  });
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new Error(
    result.error.issues
      .map(
        (issue) =>
          `equipment-forging.json ${issue.path.join('.')}: ${issue.message}`,
      )
      .join('\n'),
  );
}
