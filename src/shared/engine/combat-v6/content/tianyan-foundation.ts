import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, StatusCategory, StatusHit, StatusTick, TickKind, type StatusDef } from '../core';
import { sectSkillLearning } from './skill-learning';
import { validateSectExpressions } from './authoring-expressions';
import raw from './data/tianyan-foundation.json';

const element = z.enum(['wood', 'fire', 'earth', 'metal', 'water']);
export type TianyanElementV1 = z.infer<typeof element>;
export type TianyanReactionKindV1 = 'generate' | 'overcome';
export interface TianyanReactionDefV1 {
  id: string; name: string; kind: TianyanReactionKindV1;
  oldElement: TianyanElementV1; newElement: TianyanElementV1;
  mainFactor?: number; defenseIgnore?: number; followPower?: string;
  statusId?: string; healingPower?: string;
}
const id = z.string().regex(/^tianyan\.[a-z][a-z0-9_.]*$/);
const text = z.string().min(1).max(100);
const number = z.number().min(0).max(1000000);
const expression = z.union([z.number().min(-1000000).max(1000000), z.string().min(1).max(200)]);
export const TianyanFoundationShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  elements: z.array(z.strictObject({ element, markId: id, skillId: id })).length(5),
  statuses: z.array(z.strictObject({
    id, name: text, kind: id, category: z.enum(StatusCategory),
    ticks: z.enum(StatusTick).optional(),
    onTick: z.strictObject({ type: z.literal(TickKind.Dot), ratioOfMaxHp: number.max(1) }).optional(),
    speedMod: expression.optional(), attrMods: z.partialRecord(z.enum(ATTR_NAMES), expression).optional(),
    blocksAction: z.boolean().optional(), blocksSpell: z.boolean().optional(),
  })).min(5),
  reactions: z.array(z.strictObject({
    id, name: text, kind: z.enum(['generate', 'overcome']), oldElement: element, newElement: element,
    mainFactor: number.optional(), defenseIgnore: number.max(1).optional(),
    followPower: z.string().min(1).max(200).optional(), statusId: id.optional(),
    healingPower: z.string().min(1).max(200).optional(),
  })).length(10),
  statusApplications: z.record(id, z.strictObject({ duration: number.int().min(1).max(99), hit: z.enum(StatusHit).optional() })),
  resources: z.array(z.strictObject({ id, name: text, current: number.int(), max: number.int().positive() })).min(1),
  reactionResource: z.strictObject({ id, amount: number.int(), maxGainPerAction: number.int() }),
});
export function loadTianyanFoundation(data: unknown) {
  const result = TianyanFoundationShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const seen = new Set<string>();
    for (const [section, entries] of [['statuses', pack.statuses], ['reactions', pack.reactions], ['resources', pack.resources]] as const)
      entries.forEach((entry, i) => { if (seen.has(entry.id)) issue([section, i, 'id'], '重复 ID：' + entry.id); seen.add(entry.id); });
    const elements = new Set<string>(), marks = new Set<string>(), skills = new Set<string>();
    pack.elements.forEach((entry, i) => {
      if (elements.has(entry.element) || marks.has(entry.markId) || skills.has(entry.skillId)) issue(['elements', i], '五行、法印和技能映射必须各自唯一');
      elements.add(entry.element); marks.add(entry.markId); skills.add(entry.skillId);
      const status = pack.statuses.find(s => s.id === entry.markId);
      if (!status || status.kind !== 'tianyan.status.mark' || status.category !== StatusCategory.Debuff) issue(['elements', i, 'markId'], '必须引用普通减益法印');
      try { sectSkillLearning(entry.skillId); } catch { issue(['elements', i, 'skillId'], '缺少技能学习关系'); }
    });
    const pairs = new Set<string>(), appliedStatuses = new Set<string>();
    pack.reactions.forEach((reaction, i) => {
      const key = reaction.oldElement + ':' + reaction.newElement;
      if (pairs.has(key) || reaction.oldElement === reaction.newElement) issue(['reactions', i, reaction.id], '反应有序组合重复或五行相同');
      pairs.add(key);
      if (reaction.statusId) {
        appliedStatuses.add(reaction.statusId);
        if (!pack.statuses.some(s => s.id === reaction.statusId) || !pack.statusApplications[reaction.statusId]) issue(['reactions', i, reaction.id, 'statusId'], '反应状态或施加规则不存在');
      }
    });
    if (pack.reactions.filter(r => r.kind === 'generate').length !== 5 || pack.reactions.filter(r => r.kind === 'overcome').length !== 5) issue(['reactions'], '必须各有五种化生与冲克');
    for (const id of Object.keys(pack.statusApplications)) if (!appliedStatuses.has(id)) issue(['statusApplications', id], '状态施加规则未被反应引用');
    pack.resources.forEach((r, i) => { if (r.current > r.max) issue(['resources', i, 'current'], '初值超过上限'); });
    const resource = pack.resources.find(r => r.id === pack.reactionResource.id);
    if (!resource) issue(['reactionResource', 'id'], '资源引用不存在');
    else if (pack.reactionResource.amount > resource.max || pack.reactionResource.maxGainPerAction > resource.max) issue(['reactionResource'], '反应资源增长规则超过上限');
    pack.statuses.forEach((status, i) => { if (!!status.ticks !== !!status.onTick) issue(['statuses', i, status.id], '周期与周期效果必须同时定义'); });
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/tianyan-foundation.json', data, result.error.issues));
  return data as z.infer<typeof TianyanFoundationShape>;
}
export const TIANYAN_FOUNDATION = loadTianyanFoundation(raw);
export const TIANYAN_STATUSES: StatusDef[] = TIANYAN_FOUNDATION.statuses;
export const TIANYAN_REACTIONS_V1: readonly TianyanReactionDefV1[] = Object.freeze(TIANYAN_FOUNDATION.reactions);
