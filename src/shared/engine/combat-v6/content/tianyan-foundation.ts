import { z } from 'zod';
import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { type StatusDef } from '../core';
import { validateSectExpressions } from './authoring-expressions';
import { tyElement, tyId, tyEffect, tyStatus, tyModifier } from './tianyan-shapes';
import raw from './data/tianyan-foundation.json';

export const TianyanFoundationShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  elements: z.array(z.strictObject({ element: tyElement, markId: tyId, skillId: tyId })).length(5),
  statuses: z.array(tyStatus).min(5),
  reactions: z.array(z.strictObject({ id: tyId, name: z.string().min(1), kind: z.enum(['generate', 'overcome']), oldElement: tyElement, newElement: tyElement, effects: z.array(tyEffect), modifiers: z.array(tyModifier).optional() })).length(10),
});
export type TianyanElementV1 = z.infer<typeof tyElement>;
export type TianyanReactionDefV1 = z.infer<typeof TianyanFoundationShape>['reactions'][number];
export type TianyanReactionKindV1 = TianyanReactionDefV1['kind'];
const generates: Record<TianyanElementV1, TianyanElementV1> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const overcomes: Record<TianyanElementV1, TianyanElementV1> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
export function validateTianyanReferences(value: unknown, ids: Set<string>, issue: (path: (string | number)[], message: string) => void, path: (string | number)[] = []) {
  if (Array.isArray(value)) { value.forEach((v, i) => validateTianyanReferences(v, ids, issue, [...path, i])); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['statusId', 'markId'].includes(key) && !ids.has(String(child))) issue([...path, key], '状态引用不存在：' + child);
    if (['requireStatusIds', 'sourceInitialStatusIds', 'targetStatusIds'].includes(key)) for (const id of child as string[]) if (!ids.has(id)) issue([...path, key], '状态引用不存在：' + id);
    validateTianyanReferences(child, ids, issue, [...path, key]);
  }
}
export function loadTianyanFoundation(data: unknown) {
  const result = TianyanFoundationShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids = [...pack.statuses, ...pack.reactions].map(s => s.id);
    if (new Set(ids).size !== ids.length) issue([], '重复 ID');
    for (const key of ['element', 'markId', 'skillId'] as const) if (new Set(pack.elements.map(e => e[key])).size !== 5) issue(['elements'], '五行映射必须唯一');
    const pairs = pack.reactions.map(r => `${r.oldElement}:${r.newElement}`);
    if (new Set(pairs).size !== 10) issue(['reactions'], '反应有序组合重复');
    pack.reactions.forEach((r, i) => {
      if ((r.kind === 'generate' ? generates[r.oldElement] !== r.newElement : overcomes[r.newElement] !== r.oldElement)) issue(['reactions', i], '生克方向错误');
    });
    if (pack.reactions.filter(r => r.kind === 'generate').length !== 5) issue(['reactions'], '必须各有五种相生与相克');
    for (const e of pack.elements) {
      const s = pack.statuses.find(s => s.id === e.markId);
      if (!s || s.kind !== 'tianyan.status.mark' || s.category !== 'buff' || !s.untilBattleEnd || !s.persistWhenDowned || s.dispellable !== false) issue(['elements', e.element], '法印必须是持久且不可驱散的自身状态');
    }
    validateTianyanReferences(pack, new Set(pack.statuses.map(s => s.id)), issue);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/tianyan-foundation.json', data, result.error.issues));
  return result.data;
}
export const TIANYAN_FOUNDATION = loadTianyanFoundation(raw);
export const TIANYAN_STATUSES: StatusDef[] = TIANYAN_FOUNDATION.statuses;
export const TIANYAN_REACTIONS_V1 = TIANYAN_FOUNDATION.reactions;
