import { ELEMENT_VALUES } from '@daoyou/constants/elements';
import { QUALITY_ORDER, QUALITY_VALUES } from '@daoyou/constants/qualities';
import {
  SPIRIT_SEED_GROWTH_FORMS,
  SPIRIT_SEED_HARVEST_PARTS,
  SpiritGardenFruitEffectsSchema,
} from '@daoyou/game-domain/spirit-field';
import { z } from 'zod';

const speciesPerQuality = 4;
const identifier = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(80);
const text = z.string().trim().min(1).max(500);
const duration = z
  .number()
  .int()
  .positive()
  .max(30 * 86_400_000);
const output = z
  .object({
    name: text.max(80),
    description: text,
    kind: z.enum(['herb', 'tcdb', 'spirit_fruit']),
    quantity: z.number().int().min(1).max(1000),
    cycleMs: duration.describe(
      '凡品基准生产周期，单位毫秒；运行时按原种品质倍率缩放。',
    ),
    fruitEffects: SpiritGardenFruitEffectsSchema.optional().describe(
      '仅灵果填写。最多三种药性，share 合计为 1，共享原有单效灵果强度。灵兽修为不可与人物药性组合。',
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.kind === 'spirit_fruit') !== Boolean(value.fruitEffects)) {
      ctx.addIssue({
        code: 'custom',
        path: ['fruitEffects'],
        message: '灵果必须配置药性份额，材料不得配置灵果药性',
      });
    }
  });
const branch = z
  .object({ name: text.max(20), description: text, output })
  .strict();
const species = z
  .object({
    id: identifier.describe('永久物种身份；发布后不要改名或复用。'),
    name: text
      .max(40)
      .describe('成株名称；灵种名称由此统一生成“成株名称的种子”。'),
    description: text,
    quality: z.enum(QUALITY_VALUES).describe('物种固有品阶，每阶有独立物种。'),
    element: z.enum(ELEMENT_VALUES),
    growthForm: z.enum(SPIRIT_SEED_GROWTH_FORMS),
    harvestPart: z.enum(SPIRIT_SEED_HARVEST_PARTS),
    portrait: z
      .object({
        atlas: z
          .string()
          .regex(/^botanical-[a-z0-9-]+$/)
          .max(80)
          .describe('四列四行图谱，行序为幼苗、成株、蕴灵、蜕变。'),
        index: z
          .number()
          .int()
          .min(0)
          .max(speciesPerQuality - 1)
          .describe('图谱列号，从左到右编号 0—3。'),
      })
      .strict(),
    matureMs: duration.describe('凡品基准成株时间，单位毫秒。'),
    branchMs: duration.describe('凡品基准蕴灵定向时间，单位毫秒。'),
    evolveMs: duration.describe('凡品基准蜕变时间，单位毫秒。'),
    baseOutput: output,
    branches: z.object({ abundance: branch, essence: branch }).strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.name.endsWith('的种子'))
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: '物种名称必须填写成株名称',
      });
    if (value.matureMs > value.branchMs || value.branchMs > value.evolveMs)
      ctx.addIssue({
        code: 'custom',
        path: ['matureMs'],
        message: '成株、定向、蜕变时间必须依次递增',
      });
    if (value.baseOutput.kind !== 'herb')
      ctx.addIssue({
        code: 'custom',
        path: ['baseOutput', 'kind'],
        message: '基础产物必须为药材',
      });
    if (value.branches.abundance.output.kind !== 'herb')
      ctx.addIssue({
        code: 'custom',
        path: ['branches', 'abundance', 'output', 'kind'],
        message: '繁茂路线必须产出药材',
      });
    if (value.branches.abundance.output.name !== value.baseOutput.name)
      ctx.addIssue({
        code: 'custom',
        path: ['branches', 'abundance', 'output', 'name'],
        message: '繁茂路线应增加原药材产量，不更换产物',
      });
    if (value.branches.essence.output.kind === 'herb')
      ctx.addIssue({
        code: 'custom',
        path: ['branches', 'essence', 'output', 'kind'],
        message: '特化路线必须产出灵果或天材地宝',
      });
    for (const key of ['abundance', 'essence'] as const)
      if (value.branches[key].output.cycleMs < value.baseOutput.cycleMs)
        ctx.addIssue({
          code: 'custom',
          path: ['branches', key, 'output', 'cycleMs'],
          message: '定向后的周期不得短于基础周期，避免沿用进度重复增产',
        });
  });

export const SpiritGardenCatalogShape = z
  .object({
    $schema: z.string().optional(),
    schemaVersion: z.literal(1),
    offlineCapMs: duration.describe('每株最多积蓄的生产时间，单位毫秒。'),
    collectionLimit: z.number().int().min(1).max(128),
    species: z.array(species).length(QUALITY_VALUES.length * speciesPerQuality),
  })
  .strict();

export const SpiritGardenCatalogSchema = SpiritGardenCatalogShape.superRefine(
  (catalog, ctx) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    const portraits = new Set<string>();
    const productNames = new Set<string>();
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    for (const quality of QUALITY_VALUES) {
      const entries = catalog.species.filter((entry) => entry.quality === quality);
      if (entries.length !== speciesPerQuality)
        add(['species'], `${quality}必须有四种灵植`);
      if (new Set(entries.map((entry) => entry.portrait.atlas)).size !== 1)
        add(['species'], `${quality}的灵植应归于同一张独立图谱`);
    }
    catalog.species.forEach((entry, index) => {
      const path = ['species', index];
      if (ids.has(entry.id)) add([...path, 'id'], '物种身份不可重复');
      if (names.has(entry.name)) add([...path, 'name'], '成株名称不可重复');
      ids.add(entry.id);
      names.add(entry.name);
      const portrait = `${entry.portrait.atlas}:${entry.portrait.index}`;
      if (portraits.has(portrait))
        add([...path, 'portrait'], '每个独立物种必须使用独立图谱格位');
      portraits.add(portrait);
      for (const [outputKey, product] of [
        ['baseOutput', entry.baseOutput],
        ['essence', entry.branches.essence.output],
      ] as const) {
        if (productNames.has(product.name))
          add([...path, outputKey, 'name'], '不同物种产物名称不可重复');
        productNames.add(product.name);
      }
      for (const product of [
        entry.baseOutput,
        entry.branches.abundance.output,
        entry.branches.essence.output,
      ])
        if (
          Math.round(
            product.cycleMs * (1 + QUALITY_ORDER[entry.quality] * 0.25),
          ) > catalog.offlineCapMs
        )
          add(
            [...path, 'branches'],
            '生产周期不得超过积蓄上限，否则成熟后无法持续生产',
          );
    });
  },
);

/** Validates authoring data before the catalog becomes available to either app. */
export function loadSpiritGardenCatalog(input: unknown) {
  return SpiritGardenCatalogSchema.parse(input);
}
