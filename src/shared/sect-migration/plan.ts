import type {
  LegacySectMember,
  SectMigrationPlan,
} from '../contracts/sectMigration';
import mapping from './mapping.json';

/** Frozen V5 release mapping and prices. Do not follow future V6 balance changes. */
export function planLegacySectMigration(
  member: LegacySectMember,
): SectMigrationPlan {
  if (!Object.prototype.hasOwnProperty.call(mapping, member.sectId))
    throw new Error('未知旧宗门');
  const rule = mapping[member.sectId as keyof typeof mapping];
  const methods = new Map<string, number>();
  for (const method of member.methods) {
    if (!rule.methods.some(([id]) => id === method.methodId))
      throw new Error('未知旧心法');
    if (methods.has(method.methodId)) throw new Error('旧心法重复');
    if (
      !Number.isInteger(method.level) ||
      method.level < 0 ||
      method.level > 180
    )
      throw new Error('旧心法等级越界');
    methods.set(method.methodId, method.level);
  }
  const levels = rule.methods.map(([id]) => methods.get(id) ?? 0);
  if (levels.slice(1).some((level) => level > levels[0]))
    throw new Error('旧分支心法超过主心法或缺失主心法');
  const depths = new Map<string, number>();
  const layers = ['1', '2', '3', '4', '5', 'ultimate'];
  for (const path of member.paths) {
    if (!rule.paths.some(([id]) => id === path.pathId))
      throw new Error('未知旧流派');
    if (depths.has(path.pathId)) throw new Error('旧流派重复');
    if (
      path.unlockedLayerIds.length > 6 ||
      path.unlockedLayerIds.some((id, i) => id !== layers[i])
    )
      throw new Error('旧经脉层数必须从第一层连续解锁');
    depths.set(path.pathId, path.unlockedLayerIds.length);
  }
  const depthValues = rule.paths.map(([id]) => depths.get(id) ?? 0);
  const depth = Math.max(...depthValues);
  const active = rule.paths.find(([id]) => id === member.activePathId);
  if (
    member.activePathId !== null &&
    (!active || !depths.get(member.activePathId))
  )
    throw new Error('当前旧流派不存在或尚未解锁');
  if (depth > 0 && !active) throw new Error('已解锁经脉但缺失当前流派');
  const refundDepth = Math.min(...depthValues);
  let cultivationExp = 0;
  for (let layer = 1; layer <= refundDepth; layer++)
    cultivationExp += 5000 * 4 ** (layer - 1);
  return {
    methods: rule.methods.map(([, methodId], i) => ({
      methodId,
      level: levels[i],
    })),
    meridianDepth: depth,
    activePathId: active?.[1] ?? null,
    pathIds: rule.paths.map(([, id]) => id),
    refund: {
      cultivationExp,
      spiritStones: cultivationExp * 5,
      comprehensionInsight: refundDepth * 100,
    },
  };
}
