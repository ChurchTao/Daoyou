import { z } from 'zod';
import { DAO_EQUIPMENT_SLOTS } from './types';

const panelAttribute = z.enum([
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
]);
const bounds = z.tuple([z.number().int().nonnegative().max(1000000), z.number().int().nonnegative().max(1000000)]);
const level = z.union([z.literal(10), z.literal(30), z.literal(50), z.literal(70), z.literal(90)]);
const statRange = z.strictObject({ level, normal: bounds, enhanced: bounds });
const probability = z.number().min(0).max(1);

export const EquipmentBasePackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  templates: z
    .array(
      z.strictObject({
        id: z.string().regex(/^dao_equipment\.standard\.[a-z]+\.v1$/),
        name: z.string().trim().min(1),
        slot: z.enum(DAO_EQUIPMENT_SLOTS),
        baseStats: z
          .array(z.strictObject({ attr: panelAttribute, ranges: z.array(statRange).length(5) }))
          .min(1),
      }),
    )
    .length(DAO_EQUIPMENT_SLOTS.length),
  inscriptions: z
    .array(
      z.strictObject({
        id: z.string().regex(/^dao_inscription\.[a-z][a-z0-9_]*$/),
        name: z.string().trim().min(1),
        attr: panelAttribute,
        valuePerLevel: z.number().positive(),
        allowedSlots: z.array(z.enum(DAO_EQUIPMENT_SLOTS)).min(1),
      }),
    )
    .min(1),
  generation: z.strictObject({
    bonusCountProbabilities: z.tuple([probability, probability, probability]),
    bonusRanges: z.array(z.strictObject({ level, min: z.number().int().positive(), max: z.number().int().positive() })).length(5),
  }),
});

export const EquipmentBasePackSchema = EquipmentBasePackShape.superRefine(
  (pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const unique = (values: string[], path: (string | number)[]) => {
      values.forEach((value, i) => {
        if (values.indexOf(value) !== i) issue([...path, i], '不得重复');
      });
    };
    unique(
      pack.templates.map((t) => t.id),
      ['templates'],
    );
    unique(
      pack.templates.map((t) => t.slot),
      ['templates'],
    );
    pack.templates.forEach((template, i) => {
      if (template.id !== `dao_equipment.standard.${template.slot}.v1`)
        issue(
          ['templates', i, 'id'],
          '模板 ID 必须匹配标准部位 ID，供图纸和生成入口引用',
        );
      unique(
        template.baseStats.map((s) => s.attr),
        ['templates', i, 'baseStats'],
      );
      template.baseStats.forEach((stat, j) => {
        const path = ['templates', i, 'baseStats', j, 'ranges'];
        unique(stat.ranges.map((r) => String(r.level)), path);
        stat.ranges.forEach((r, k) => {
          if (r.normal[0] > r.normal[1] || r.enhanced[0] > r.enhanced[1])
            issue([...path, k], '上界不得小于下界');
          if (r.enhanced.some((v, n) => v < r.normal[n]))
            issue([...path, k, 'enhanced'], '高品阶范围不得低于普通范围');
        });
      });
    });
    unique(
      pack.inscriptions.map((t) => t.id),
      ['inscriptions'],
    );
    pack.inscriptions.forEach((inscription, i) => {
      unique(inscription.allowedSlots, ['inscriptions', i, 'allowedSlots']);
    });
    const total = pack.generation.bonusCountProbabilities.reduce(
      (sum, p) => sum + p,
      0,
    );
    if (Math.abs(total - 1) > 1e-12)
      issue(
        ['generation', 'bonusCountProbabilities'],
        '0／1／2 条概率之和必须为 1',
      );
    unique(pack.generation.bonusRanges.map((r) => String(r.level)), ['generation', 'bonusRanges']);
    pack.generation.bonusRanges.forEach((r, i) => {
      if (r.min > r.max) issue(['generation', 'bonusRanges', i], '上界不得小于下界');
    });
  },
);

export function loadEquipmentBasePack(
  data: unknown,
  filename = 'equipment-base.json',
) {
  const result = EquipmentBasePackSchema.safeParse(data);
  if (result.success) return result.data;
  const errors = result.error.issues.map((issue) => {
    // Read identity from the original input so structural errors also identify their entry.
    let entry: unknown = data;
    for (const key of issue.path.slice(0, 2)) {
      entry =
        entry && typeof entry === 'object'
          ? Reflect.get(entry, key)
          : undefined;
    }
    const id =
      entry && typeof entry === 'object' && 'id' in entry
        ? ` [${String(entry.id)}]`
        : '';
    return `${filename}${id} ${issue.path.join('.')}: ${issue.message}`;
  });
  throw new Error(errors.join('\n'));
}
