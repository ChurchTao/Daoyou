// Immutable v5 strategy semantics and presentation; future changes require a new version.
import { z } from 'zod';
import type { TowerEnemyPreview } from '../../../lib/tower/weekly';

export const TOWER_STRATEGY_VERSION = 'combat-v6-tower-v5' as const;
const traitId = z.enum([
  'magic_ward',
  'armor',
  'vital',
  'swift',
  'seal_resist',
  'charge',
  'limited_healing',
  'last_stand',
]);
const trait = z.union([
  z.strictObject({ id: traitId }),
  z.strictObject({ id: z.literal('guard'), targetEnemyId: z.string().min(1) }),
]);
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
        archetype: z.enum(['warrior', 'mage', 'binder', 'attendant']),
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
  if (f.enemies.some((e) => e.archetype === 'binder') && f.enemies.length !== 1)
    fail('封印暂限单敌');
  for (const e of f.enemies) {
    const has = (id: TowerTraitId) => hasTowerTrait(e, id);
    if (new Set(e.traits.map((t) => t.id)).size !== e.traits.length)
      fail('词条重复');
    if (
      ['armor', 'magic_ward', 'vital'].filter((id) => has(id as TowerTraitId))
        .length > 1
    )
      fail('生存词条冲突');
    if (
      ['swift', 'seal_resist', 'charge'].filter((id) => has(id as TowerTraitId))
        .length > 1
    )
      fail('节奏词条冲突');
    if (has('charge') && has('limited_healing')) fail('行动周期冲突');
    if (has('charge') && e.archetype !== 'warrior') fail('蓄势需要武斗原型');
    const guard = e.traits.find((t) => t.id === 'guard');
    if (guard?.id === 'guard') {
      if (
        guard.targetEnemyId === e.id ||
        !f.enemies.some((t) => t.id === guard.targetEnemyId)
      )
        fail('护卫目标引用无效');
      const visited = new Set([e.id]);
      let target: string | undefined = guard.targetEnemyId;
      while (target) {
        if (visited.has(target)) fail('循环护卫');
        visited.add(target);
        const next = f.enemies
          .find((t) => t.id === target)
          ?.traits.find((t) => t.id === 'guard');
        target = next?.id === 'guard' ? next.targetEnemyId : undefined;
      }
    }
    const guards = f.enemies.filter((other) =>
      other.traits.some((t) => t.id === 'guard' && t.targetEnemyId === e.id),
    ).length;
    if (guards > 1 && (f.kind === 'elite' || has('armor')))
      fail('精英或铁甲暂不支持双护卫');
  }
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
      traits: e.traits
        .filter(
          (t) => !formationOnly || ['guard', 'limited_healing'].includes(t.id),
        )
        .map((t) =>
          t.id === 'guard'
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

const descriptions: Record<TowerTraitId, [string, string]> = {
  vital: ['厚血', '自身气血提高 25%。'],
  armor: ['铁甲', '自身物防提高，法防保持基础值。'],
  magic_ward: ['灵障', '自身法防提高，物防保持基础值。'],
  swift: ['疾行', '速度较快，但并非必定先手。'],
  seal_resist: ['定神', '封印抵抗提高 10 点，并非免疫。'],
  charge: [
    '蓄势',
    '每三回合：蓄势 → 物理重击 → 普通攻击。重击可被控制跳过；施放后至下一回合结束承伤提高 25%。',
  ],
  limited_healing: [
    '续灯',
    '每第三回合治疗气血比例最低的友方（包括自己），回复自身气血上限的 20%；最多三次，其余回合弱攻击。',
  ],
  guard: [
    '护卫',
    '回合开始为指定同伴提供 15% 物理与法术减伤，最多 30%；死亡后下一回合降低，不覆盖固定伤害。',
  ],
  last_stand: [
    '碎梦',
    '回合开始时气血首次低于 40%，伤害提高 15%，持续至战斗结束。',
  ],
};
export function towerStrategyPreview(f: TowerFloorStrategy): TowerEnemyPreview {
  validateTowerFloorStrategy(f);
  const members = f.enemies.map((e, slot) => {
    const has = (id: TowerTraitId) => hasTowerTrait(e, id);
    const support = e.archetype === 'attendant';
    const name = support
      ? has('limited_healing')
        ? '执灯幻侍'
        : has('guard')
          ? `镜侍${slot === 1 ? '·左' : '·右'}`
          : '幻侍'
      : e.archetype === 'binder'
        ? '缚梦幻师'
        : e.archetype === 'mage'
          ? f.kind === 'normal'
            ? '碎镜术士'
            : '照影镜主'
          : f.kind !== 'normal'
            ? '负碑蜃卫'
            : ((f.floor - 1) % 10) + 1 >= 8
              ? '护镜傀'
              : '蜃影剑卫';
    const behavior =
      has('limited_healing') || has('charge')
        ? []
        : [
            support
              ? '每回合弱攻击。'
              : e.archetype === 'binder'
                ? '第1、4、7…回合封印，其余回合单体法术；封印持续当回合及下一回合。'
                : e.archetype === 'mage'
                  ? '每第三回合群体法术，其余回合单体法术；群法后至下一回合结束承伤提高25%。'
                  : f.kind === 'normal'
                    ? '普通攻击为主，每第三回合较强单体攻击。'
                    : '每第三回合双段物理攻击，其余回合单体物理攻击。',
          ];
    return {
      id: `tower.enemy.${slot}`,
      name,
      icon: support
        ? has('limited_healing')
          ? '🏮'
          : '🪞'
        : e.archetype === 'mage'
          ? '🔮'
          : e.archetype === 'binder'
            ? '🪬'
            : '⚔️',
      role: (e.role === 'support'
        ? has('limited_healing')
          ? 'healer'
          : has('guard')
            ? 'guard'
            : 'striker'
        : e.role) as TowerEnemyPreview['members'][number]['role'],
      details: [
        ...behavior,
        ...e.traits.map((t) =>
          t.id === 'guard'
            ? `${descriptions.guard[1]}（保护第 ${f.enemies.findIndex((other) => other.id === t.targetEnemyId) + 1} 位同伴）`
            : descriptions[t.id][1],
        ),
      ],
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
        f.enemies.flatMap((e) => e.traits.map((t) => descriptions[t.id][0])),
      ),
    ],
    details: members.flatMap((m) => m.details),
  };
}
