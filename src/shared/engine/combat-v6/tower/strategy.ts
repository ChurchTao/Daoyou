// Explicit authored strategy. Runtime interpretation never consults generation templates.
import { z } from 'zod';
import type { TowerEnemyPreview } from '../../../lib/tower/weekly';
import { TOWER_CATALOG, TOWER_SKILLS, towerContentNote } from './catalog';

export const TOWER_STRATEGY_VERSION = 'combat-v6-tower-v7' as const;
const trait = z.strictObject({
  id: z.string().min(1),
  targetEnemyId: z.string().min(1).optional(),
});
const share = z.number().positive().max(1);
export const TowerFloorStrategySchema = z.strictObject({
  floor: z.number().int().min(1).max(20),
  kind: z.enum(['normal', 'elite', 'boss']),
  budget: z.strictObject({ hpScale: z.number().positive().max(1) }),
  enemies: z
    .array(
      z.strictObject({
        id: z
          .string()
          .regex(/^[a-zA-Z0-9_.-]+$/)
          .max(60),
        archetype: z.string().min(1),
        behaviorId: z.string().min(1),
        role: z.enum(['leader', 'striker', 'support']),
        traits: z.array(trait).max(8),
        budgetShare: z.strictObject({ hp: share, output: share }),
      }),
    )
    .min(1)
    .max(3),
});
export type TowerFloorStrategy = z.infer<typeof TowerFloorStrategySchema>;
export type TowerEnemyStrategy = TowerFloorStrategy['enemies'][number];
export type TowerTraitId = TowerEnemyStrategy['traits'][number]['id'];
export const hasTowerTrait = (enemy: TowerEnemyStrategy, id: TowerTraitId) =>
  enemy.traits.some((t) => t.id === id);

export function validateTowerFloorStrategy(
  input: unknown,
): asserts input is TowerFloorStrategy {
  const f = TowerFloorStrategySchema.parse(input);
  const fail = (reason: string): never => {
    throw new Error(`幻境第 ${f.floor} 层：${reason}`);
  };
  if (
    f.kind !==
    (f.floor % 10 === 0 ? 'boss' : f.floor % 5 === 0 ? 'elite' : 'normal')
  )
    fail('楼层类型无效');
  if (new Set(f.enemies.map((e) => e.id)).size !== f.enemies.length)
    fail('敌人ID重复');
  if (f.enemies.filter((e) => e.role === 'leader').length !== 1)
    fail('需要一名主敌');
  for (const key of ['hp', 'output'] as const) {
    if (
      Math.abs(f.enemies.reduce((sum, e) => sum + e.budgetShare[key], 0) - 1) >
      1e-9
    )
      fail('预算份额必须合计为1');
  }
  for (const e of f.enemies) {
    const archetype = TOWER_CATALOG.archetypes[e.archetype];
    const behavior = TOWER_CATALOG.behaviors[e.behaviorId];
    if (!archetype || !behavior) fail('原型或行动方案不存在');
    if (archetype.maxEnemies && f.enemies.length > archetype.maxEnemies)
      fail('原型人数限制');
    if (!behavior.archetypes.includes(e.archetype))
      fail('行动方案与原型不兼容');
    const ids = new Set(e.traits.map((t) => t.id));
    if (ids.size !== e.traits.length) fail('词条重复');
    if (
      behavior.requires.some((t) => !ids.has(t)) ||
      behavior.forbids.some((t) => ids.has(t))
    )
      fail('行动方案与词条不兼容');
    const groups = new Set<string>();
    for (const t of e.traits) {
      const definition = TOWER_CATALOG.traits[t.id];
      if (!definition) fail('词条不存在');
      if (
        !definition.archetypes.includes(e.archetype) ||
        definition.forbids.some((id) => ids.has(id))
      )
        fail('词条不兼容');
      if (definition.group) {
        if (groups.has(definition.group)) fail('词条分组冲突');
        groups.add(definition.group);
      }
      if (definition.relation) {
        if (
          !t.targetEnemyId ||
          t.targetEnemyId === e.id ||
          !f.enemies.some((other) => other.id === t.targetEnemyId)
        )
          fail('关系目标无效');
      } else if (t.targetEnemyId) fail('非关系词条不能指定目标');
    }
    const guards = f.enemies.filter((other) =>
      other.traits.some(
        (t) => TOWER_CATALOG.traits[t.id]?.relation && t.targetEnemyId === e.id,
      ),
    ).length;
    const maxGuards = Math.min(
      TOWER_CATALOG.kinds[f.kind].maxGuards,
      ...e.traits.map((t) => TOWER_CATALOG.traits[t.id].maxGuards ?? 2),
    );
    if (guards > maxGuards) fail('护卫数量超限');
  }
  const visit = (id: string, path: Set<string>) => {
    if (path.has(id)) fail('循环护卫');
    const next = new Set(path).add(id);
    for (const trait of f.enemies.find((e) => e.id === id)!.traits) {
      if (trait.targetEnemyId) visit(trait.targetEnemyId, next);
    }
  };
  for (const enemy of f.enemies) visit(enemy.id, new Set());
}

/** IDs are local references; renaming them cannot bypass weekly repetition scoring. */
export function towerStrategySignature(
  floor: TowerFloorStrategy,
  formationOnly = false,
) {
  return JSON.stringify({
    budget: floor.budget,
    enemies: floor.enemies.map((e) => ({
      archetype: formationOnly ? undefined : e.archetype,
      role: e.role,
      behavior: formationOnly
        ? undefined
        : TOWER_CATALOG.behaviors[e.behaviorId],
      traits: e.traits
        .filter(
          (t) => !formationOnly || ['guard', 'limited_healing'].includes(t.id),
        )
        .map((t) =>
          t.targetEnemyId !== undefined
            ? {
                id: t.id,
                target: floor.enemies.findIndex(
                  (e) => e.id === t.targetEnemyId,
                ),
              }
            : { id: t.id },
        )
        .sort((a, b) => a.id.localeCompare(b.id)),
      budgetShare: e.budgetShare,
    })),
  });
}

const attributeLabels: Record<string, string> = {
  hp: '气血',
  physicalDef: '物防',
  magicDef: '法防',
  speed: '速度',
  sealResist: '抗封',
  sealHit: '封印命中',
  output: '输出预算',
  critRate: '物理暴击',
  spellCritRate: '法术暴击',
};
export function towerStrategyPreview(f: TowerFloorStrategy): TowerEnemyPreview {
  validateTowerFloorStrategy(f);
  const members = f.enemies.map((e, slot) => {
    const archetype = TOWER_CATALOG.archetypes[e.archetype];
    const behavior = TOWER_CATALOG.behaviors[e.behaviorId];
    const actionName = (id: string) =>
      TOWER_SKILLS.find((s) => s.id === id)?.name ??
      (id === 'attack' ? '普攻' : '防御');
    const details = [
      `每 ${behavior.cycle.length} 回合：${behavior.cycle.map(actionName).join(' → ')}。`,
      behavior.tip,
    ];
    for (const trait of e.traits) {
      const definition = TOWER_CATALOG.traits[trait.id];
      for (const [key, value] of Object.entries(definition.multiply))
        details.push(`${attributeLabels[key]} ×${Number(value.toFixed(3))}。`);
      for (const [key, value] of Object.entries(definition.add))
        details.push(
          `${attributeLabels[key]} ${value >= 0 ? '+' : ''}${value}。`,
        );
      if (trait.targetEnemyId)
        details.push(
          `保护第 ${f.enemies.findIndex((other) => other.id === trait.targetEnemyId) + 1} 位同伴；击杀护卫后下一回合解除其保护。`,
        );
    }
    for (const id of [
      ...new Set([...behavior.cycle, ...e.traits.map((t) => t.id)]),
    ]) {
      const note = towerContentNote(id);
      if (note) details.push(note);
      const skill = TOWER_SKILLS.find((s) => s.id === id);
      if (skill?.effects.some((effect) => effect.type === 'heal'))
        details.push(
          `治疗最低气血比例友方（含自己）；法力 ${behavior.maxMp ?? TOWER_CATALOG.defaults.maxMp}，每次消耗 ${skill.costMp ?? 0}，不足时改用${actionName(behavior.fallback)}。`,
        );
    }
    const visual =
      [...e.traits]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((t) => TOWER_CATALOG.traits[t.id].presentation)
        .find(Boolean) ?? archetype;
    return {
      id: `tower.enemy.${slot}`,
      name: visual.name,
      icon: visual.icon,
      role: (e.role === 'support'
        ? hasTowerTrait(e, 'limited_healing')
          ? 'healer'
          : e.traits.some((t) => t.targetEnemyId)
            ? 'guard'
            : 'striker'
        : e.role) as TowerEnemyPreview['members'][number]['role'],
      details,
    };
  });
  const leader = members[f.enemies.findIndex((e) => e.role === 'leader')];
  return {
    floor: f.floor,
    kind: f.kind,
    name: leader.name,
    icon: leader.icon,
    members,
    labels: [
      ...new Set(
        f.enemies.flatMap((e) =>
          e.traits.map((t) => TOWER_CATALOG.traits[t.id].label),
        ),
      ),
    ],
    details: [...new Set(members.flatMap((m) => m.details))],
  };
}
