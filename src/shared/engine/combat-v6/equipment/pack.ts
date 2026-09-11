import { z } from 'zod';
import { DAO_EQUIPMENT_SLOTS } from './types';

const attributes = z.enum([
  'vitality',
  'strength',
  'spirit',
  'endurance',
  'speed',
  'willpower',
]);
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
const coefficientRange = z.strictObject({
  minCoefficient: z.number().nonnegative(),
  maxCoefficient: z.number().nonnegative(),
});
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
          .array(coefficientRange.extend({ attr: panelAttribute }))
          .min(1),
        favoredAttributes: z.array(attributes),
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
    favoredWeight: z.number().positive(),
    normalWeight: z.number().positive(),
    bonusValue: coefficientRange,
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
    const range = (
      value: z.infer<typeof coefficientRange>,
      path: (string | number)[],
    ) => {
      if (value.minCoefficient > value.maxCoefficient)
        issue([...path, 'maxCoefficient'], '上界不得小于下界');
      if (!Number.isSafeInteger(Math.floor(180 * value.maxCoefficient)))
        issue([...path, 'maxCoefficient'], '最高器阶的结果超出安全整数范围');
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
      unique(template.favoredAttributes, ['templates', i, 'favoredAttributes']);
      template.baseStats.forEach((stat, j) =>
        range(stat, ['templates', i, 'baseStats', j]),
      );
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
    if (
      !Number.isFinite(
        6 *
          Math.max(pack.generation.favoredWeight, pack.generation.normalWeight),
      )
    )
      issue(['generation', 'favoredWeight'], '累计抽取权重超出有限数值范围');
    range(pack.generation.bonusValue, ['generation', 'bonusValue']);
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
