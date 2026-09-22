import type { MeridianNodeDefV6, SectPathDefV6 } from './types';

/** 兼容早期将末端奖励当作互斥经脉保存的方案；读取不写回持久化数据。 */
export function normalizeMeridianSelection(path: SectPathDefV6, nodeIds: string[]): string[] {
  return nodeIds.map(id => path.nodes.find(n => n.id === id)?.legacyReplacementId ?? id);
}

export function meridianNodesConnect(from: MeridianNodeDefV6, to: MeridianNodeDefV6): boolean {
  return !from.automatic && !to.automatic && to.layer === from.layer + 1 && Math.abs(from.slot - to.slot) <= 1;
}

export function canSelectMeridianNode(path: SectPathDefV6, nodeIds: string[], node: MeridianNodeDefV6): boolean {
  if (node.automatic) return false;
  return !path.requiresConnectedNodes || node.layer === 1 || path.nodes.some(parent => nodeIds.includes(parent.id) && meridianNodesConnect(parent, node));
}

/** 旧方案读取和前层改选只保留连通前缀，不替玩家选择新的节点。 */
export function connectedMeridianSelection(path: SectPathDefV6, nodeIds: string[]): string[] {
  const normalized = normalizeMeridianSelection(path, nodeIds);
  if (!path.requiresConnectedNodes) return normalized;
  const result: string[] = [];
  for (const node of [...path.nodes].sort((a, b) => a.layer - b.layer || a.slot - b.slot)) {
    if (normalized.includes(node.id) && canSelectMeridianNode(path, result, node)) result.push(node.id);
  }
  return result;
}

export function toggleMeridianNode(path: SectPathDefV6, nodeIds: string[], node: MeridianNodeDefV6): string[] {
  if (!canSelectMeridianNode(path, nodeIds, node)) return nodeIds;
  const next = nodeIds.filter(id => path.nodes.find(n => n.id === id)?.layer !== node.layer);
  if (!nodeIds.includes(node.id)) next.push(node.id);
  return connectedMeridianSelection(path, next);
}
