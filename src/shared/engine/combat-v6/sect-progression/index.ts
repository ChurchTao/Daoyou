import { SECT_PROGRESSION, configuredMethodCost, configuredMeridianCost, methodLevelCap } from './pack';
import type { SectV6Action, SectV6Cost } from '@shared/contracts/combatV6Sect';
import {
  COMBAT_V6_SECT_DEFINITIONS,
  compileCurrentSectCombatV6,
} from '../content/index';
import type { CombatV6SectId, SectCombatProgressV6 } from '../content/types';

export class SectV6RuleError extends Error {}
export { methodLevelCap } from './pack';
export const MERIDIAN_LEVELS = SECT_PROGRESSION.meridian.characterLevels;
export function methodTrainingCost(targetLevel: number): SectV6Cost {
  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > SECT_PROGRESSION.method.maxLevel)
    throw new SectV6RuleError('心法等级无效');
  return configuredMethodCost(SECT_PROGRESSION, targetLevel);
}
export function meridianUnlockCost(layer: number): SectV6Cost {
  if (!Number.isInteger(layer) || layer < 1 || layer > 7)
    throw new SectV6RuleError('经脉层级无效');
  return configuredMeridianCost(SECT_PROGRESSION, layer);
}
export function sectV6Change(
  progress: SectCombatProgressV6,
  characterLevel: number,
  action: SectV6Action,
) {
  const definition = COMBAT_V6_SECT_DEFINITIONS[progress.sectId];
  const next = structuredClone(progress);
  let cost: SectV6Cost = {
    cultivationExp: 0,
    spiritStones: 0,
    comprehensionInsight: 0,
  };
  if (action.action === 'train') {
    const method = definition.methods.find((m) => m.id === action.methodId);
    if (!method) throw new SectV6RuleError('心法不属于当前宗门');
    const target = progress.methods[method.id] + 1;
    const primary = definition.methods.find((m) => m.isPrimary)!;
    if (target > methodLevelCap(characterLevel))
      throw new SectV6RuleError('已达当前人物等级允许的心法上限');
    if (!method.isPrimary && target > progress.methods[primary.id])
      throw new SectV6RuleError(`分支不可超过${primary.name}`);
    cost = methodTrainingCost(target);
    next.methods[method.id] = target;
  } else if (action.action === 'unlock') {
    const layer = progress.meridianDepth + 1;
    if (layer > 7) throw new SectV6RuleError('经脉已全部解锁');
    if (characterLevel < MERIDIAN_LEVELS[layer - 1])
      throw new SectV6RuleError(
        `人物达到${MERIDIAN_LEVELS[layer - 1]}级后可解锁`,
      );
    cost = meridianUnlockCost(layer);
    next.meridianDepth = layer as SectCombatProgressV6['meridianDepth'];
  } else {
    const path = definition.paths.find((p) => p.id === action.pathId);
    if (!path) throw new SectV6RuleError('流派不属于当前宗门');
    if (action.action === 'activate') {
      if (progress.activePathId === path.id)
        throw new SectV6RuleError('已是当前流派');
      next.activePathId = path.id;
    } else {
      const loadout = next.meridianLoadouts.find((l) => l.pathId === path.id)!;
      const layers = new Set<number>();
      for (const id of action.nodeIds) {
        const node = path.nodes.find((n) => n.id === id);
        if (!node) throw new SectV6RuleError('节点不属于所选流派');
        if (node.layer > progress.meridianDepth)
          throw new SectV6RuleError('节点所在层尚未解锁');
        if (layers.has(node.layer))
          throw new SectV6RuleError('每层只能选择一个节点');
        layers.add(node.layer);
      }
      loadout.nodeIds = [...action.nodeIds].sort(
        (a, b) =>
          path.nodes.find((n) => n.id === a)!.layer -
          path.nodes.find((n) => n.id === b)!.layer,
      );
      loadout.revision++;
      // Validate the saved path even when it is not the active one.
      const compiled = compileCurrentSectCombatV6({
        progress: { ...next, activePathId: path.id },
        characterLevel,
      });
      if (!compiled.ok)
        throw new SectV6RuleError(
          compiled.diagnostics.map((d) => d.message).join('；'),
        );
    }
  }
  const compiled = compileCurrentSectCombatV6({ progress: next, characterLevel });
  if (!compiled.ok)
    throw new SectV6RuleError(
      compiled.diagnostics.map((d) => d.message).join('；'),
    );
  return { progress: next, cost };
}

/** Transfer is positional; character-owned manuals and equipment are not part of this plan. */
export function transferSectProgress(
  progress: SectCombatProgressV6,
  targetId: CombatV6SectId,
  reversePaths: boolean,
): SectCombatProgressV6 {
  const source = COMBAT_V6_SECT_DEFINITIONS[progress.sectId];
  const target = COMBAT_V6_SECT_DEFINITIONS[targetId];
  const index = source.paths.findIndex((p) => p.id === progress.activePathId);
  if (index < 0) throw new SectV6RuleError('当前流派无效');
  return {
    version: 1,
    sectId: targetId,
    methods: Object.fromEntries(
      target.methods.map((method) => [
        method.id,
        progress.methods[
          source.methods.find((m) => m.slot === method.slot)!.id
        ],
      ]),
    ),
    meridianDepth: progress.meridianDepth,
    activePathId: target.paths[reversePaths ? 1 - index : index].id,
    meridianLoadouts: [
      { pathId: target.paths[0].id, nodeIds: [], revision: 0 },
      { pathId: target.paths[1].id, nodeIds: [], revision: 0 },
    ],
  };
}
