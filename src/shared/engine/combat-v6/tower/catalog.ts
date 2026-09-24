import { z } from 'zod';
import raw from './data/enemies.json';
import mechanics from './data/mechanics.json';
import { TOWER_SKILLS, TOWER_STATUS_DEFS } from './data/skills';

const modifiers = z.partialRecord(
  z.enum([
    'hp',
    'physicalDef',
    'magicDef',
    'speed',
    'output',
    'sealResist',
    'sealHit',
    'critRate',
    'spellCritRate',
  ]),
  z.number().finite(),
);
const multipliers = modifiers.refine(
  (values) => Object.values(values).every((v) => v > 0),
  '属性倍率必须为正数',
);
export type TowerModifier = keyof z.infer<typeof modifiers>;
const ids = z.array(z.string().min(1));
const kind = z.enum(['normal', 'elite', 'boss']);
export const TowerCatalogSchema = z.strictObject({
  notes: z.record(z.string(), z.string()),
  defaults: z.strictObject({
    maxMp: z.number().positive(),
    critRate: z.number().min(0).max(1),
    spellCritRate: z.number().min(0).max(1),
    sealHit: z.number().nonnegative(),
    sealResist: z.number().nonnegative(),
  }),
  kinds: z.record(
    kind,
    z.strictObject({
      multiply: multipliers,
      maxGuards: z.number().int().min(0).max(2),
    }),
  ),
  archetypes: z.record(
    z.string(),
    z.strictObject({
      name: z.string().min(1),
      icon: z.string().min(1),
      multiply: multipliers,
      kindMultiply: z.partialRecord(kind, multipliers).optional(),
      maxEnemies: z.number().int().min(1).max(3).optional(),
    }),
  ),
  traits: z.record(
    z.string(),
    z.strictObject({
      label: z.string().min(1),
      presentation: z
        .strictObject({ name: z.string(), icon: z.string() })
        .optional(),
      group: z.string().optional(),
      multiply: multipliers,
      add: modifiers,
      passives: ids,
      forbids: ids,
      archetypes: ids,
      maxGuards: z.number().int().min(0).max(2).optional(),
      relation: z
        .strictObject({
          anchorStatus: z.string(),
          targetPassive: z.string(),
          sourcePassive: z.string(),
        })
        .optional(),
    }),
  ),
  behaviors: z.record(
    z.string(),
    z.strictObject({
      archetypes: ids.min(1),
      cycle: ids.min(1).max(12),
      fallback: z.string(),
      tip: z.string(),
      requires: ids,
      forbids: ids,
      maxMp: z.number().nonnegative().optional(),
    }),
  ),
});
export function loadTowerCatalog(input: unknown) {
  const pack = TowerCatalogSchema.parse(input);
  const skills = new Set(TOWER_SKILLS.map((s) => s.id));
  const statuses = new Set(TOWER_STATUS_DEFS.map((s) => s.id));
  const action = (id: string) =>
    id === 'attack' || id === 'defend' || skills.has(id);
  for (const [id, behavior] of Object.entries(pack.behaviors)) {
    if (
      ![...behavior.cycle, behavior.fallback].every(action) ||
      behavior.archetypes.some((a) => !pack.archetypes[a]) ||
      [...behavior.requires, ...behavior.forbids].some((t) => !pack.traits[t])
    )
      throw new Error(`幻境行动方案引用无效：${id}`);
  }
  for (const [id, trait] of Object.entries(pack.traits)) {
    if (
      trait.archetypes.some((a) => !pack.archetypes[a]) ||
      trait.forbids.some((t) => !pack.traits[t]) ||
      trait.passives.some((s) => !skills.has(s))
    )
      throw new Error(`幻境词条引用无效：${id}`);
    if (
      trait.relation &&
      (!statuses.has(trait.relation.anchorStatus) ||
        !skills.has(trait.relation.targetPassive) ||
        !skills.has(trait.relation.sourcePassive))
    )
      throw new Error(`幻境关系引用无效：${id}`);
  }
  return pack;
}
export const TOWER_CATALOG = loadTowerCatalog(raw);
export type TowerNpcPlan = { cycle: string[]; fallback: string };
export { TOWER_SKILLS, TOWER_STATUS_DEFS };

export function towerContentNote(id: string): string | undefined {
  return TOWER_CATALOG.notes[id]?.replace(
    /\{(\w+):(percent|increase|number)\}/g,
    (_, key: string, format: string) => {
      const value = mechanics[key as keyof typeof mechanics];
      if (value === undefined) throw new Error(`幻境说明参数不存在：${key}`);
      return String(
        Number(
          (format === 'percent'
            ? value * 100
            : format === 'increase'
              ? (value - 1) * 100
              : value
          ).toFixed(3),
        ),
      );
    },
  );
}
