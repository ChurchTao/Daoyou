import { z } from 'zod';
import { TOWER_FORMATIONS } from '../../../lib/tower/formations';
import { TOWER_CATALOG } from './catalog';
import raw from './data/generation.json';

const id = z.string().min(1);
const recipe = z.strictObject({ formation: id, archetype: id, behavior: id });
export const TowerGenerationSchema = z.strictObject({
  combinations: z
    .array(
      z.strictObject({
        id,
        style: id,
        survival: id,
        tempo: id,
        archetype: id,
        traits: z.array(id),
        behavior: id,
        lateBehavior: id,
      }),
    )
    .min(1),
  roles: z.record(
    id,
    z.strictObject({
      archetype: id.optional(),
      traits: z.array(id).optional(),
      behavior: id.optional(),
      lateBehavior: id.optional(),
    }),
  ),
  lateFloors: z.array(z.number().int().min(1).max(20)),
  kindTraits: z.record(z.enum(['normal', 'elite', 'boss']), z.array(id)),
  normalFloors: z.record(id, recipe),
  leadIns: z.record(
    id,
    z.strictObject({
      source: z.number().int().min(1).max(20),
      mode: z.enum(['formation', 'leader']),
    }),
  ),
  preludes: z.record(
    id,
    z.strictObject({ formation: id, archetype: id.optional(), behavior: id }),
  ),
  behaviorTraits: z.record(id, z.array(id)),
  formationRules: z.array(
    z.strictObject({
      match: z.strictObject({ style: id.optional(), survival: id.optional() }),
      elite: z.array(id),
      boss: z.array(id),
    }),
  ),
});
export function loadTowerGeneration(input: unknown) {
  const config = TowerGenerationSchema.parse(input);
  const assert = (valid: unknown, message: string) => {
    if (!valid) throw new Error(`幻境生成配置：${message}`);
  };
  const formation = (id: string) =>
    assert(
      Object.prototype.hasOwnProperty.call(TOWER_FORMATIONS, id),
      `阵容不存在 ${id}`,
    );
  const archetype = (id: string) =>
    assert(TOWER_CATALOG.archetypes[id], `原型不存在 ${id}`);
  const behavior = (id: string) =>
    assert(TOWER_CATALOG.behaviors[id], `行动方案不存在 ${id}`);
  const traits = (ids: string[]) =>
    ids.forEach((id) => assert(TOWER_CATALOG.traits[id], `词条不存在 ${id}`));
  const keyFloors = [5, 10, 15, 20];
  const authoredFloors = [
    ...Object.keys(config.normalFloors),
    ...Object.keys(config.leadIns),
  ];
  assert(
    new Set(authoredFloors).size === authoredFloors.length,
    '普通层与铺垫重复',
  );
  assert(
    authoredFloors.every(
      (n) => /^(?:[1-9]|1[0-9]|20)$/.test(n) && !keyFloors.includes(Number(n)),
    ),
    '普通层编号无效',
  );
  assert(authoredFloors.length === 16, '普通层或铺垫缺失');
  assert(
    config.lateFloors.every((n) => keyFloors.includes(n)),
    '行动变体只能配置于关键层',
  );
  for (const f of Object.values(TOWER_FORMATIONS))
    for (const role of f.roles)
      assert(config.roles[role], `缺少阵容角色 ${role}`);
  assert(
    new Set(config.combinations.map((c) => c.id)).size ===
      config.combinations.length,
    '组合ID重复',
  );
  for (const c of config.combinations) {
    archetype(c.archetype);
    behavior(c.behavior);
    behavior(c.lateBehavior);
    traits(c.traits);
  }
  for (const r of Object.values(config.roles)) {
    if (r.archetype) archetype(r.archetype);
    if (r.behavior) behavior(r.behavior);
    if (r.lateBehavior) behavior(r.lateBehavior);
    traits(r.traits ?? []);
  }
  for (const r of Object.values(config.normalFloors)) {
    formation(r.formation);
    archetype(r.archetype);
    behavior(r.behavior);
  }
  for (const r of Object.values(config.preludes)) {
    formation(r.formation);
    if (r.archetype) archetype(r.archetype);
    if (r.behavior !== 'source') behavior(r.behavior);
  }
  for (const [key, ids] of Object.entries(config.behaviorTraits)) {
    behavior(key);
    traits(ids);
  }
  for (const ids of Object.values(config.kindTraits)) traits(ids);
  for (const [floor, leadIn] of Object.entries(config.leadIns))
    assert(
      Number(floor) + 1 === leadIn.source && leadIn.source % 5 === 0,
      '铺垫必须关联下一关键层',
    );
  for (const rule of config.formationRules)
    for (const id of [...rule.elite, ...rule.boss]) {
      formation(id);
      assert(config.preludes[id], `缺少铺垫 ${id}`);
    }
  return config;
}
export const TOWER_GENERATION = loadTowerGeneration(raw);
