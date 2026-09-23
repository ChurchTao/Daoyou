import { z } from 'zod';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
} from '../lib/sponsorship';
import { REALM_STAGE_VALUES, REALM_VALUES } from '../types/constants';
import { RewardSelectionsSchema } from './adminRewards';

const InstantSchema = z.string().datetime({ offset: true });
export const MailRealmSchema = z
  .object({
    realm: z.enum(REALM_VALUES),
    stage: z.enum(REALM_STAGE_VALUES),
  })
  .strict();
export type MailRealm = z.infer<typeof MailRealmSchema>;
export function mailRealmRank(value: MailRealm): number {
  return (
    REALM_VALUES.indexOf(value.realm) * REALM_STAGE_VALUES.length +
    REALM_STAGE_VALUES.indexOf(value.stage)
  );
}

export const SystemMailConditionsSchema = z
  .object({
    targetCultivatorId: z.uuid().optional(),
    createdFrom: InstantSchema.optional(),
    createdBefore: InstantSchema.optional(),
    createdBeforePublication: z.boolean().default(false),
    realmMin: MailRealmSchema.optional(),
    realmMax: MailRealmSchema.optional(),
    sponsorship: z
      .object({
        mode: z.enum(['at_least', 'one_of']),
        tiers: z.array(z.enum(SPONSORSHIP_TIER_IDS)).min(1).max(4),
      })
      .strict()
      .refine(
        (v) => v.mode !== 'at_least' || v.tiers.length === 1,
        '最低赞助级别只能选择一个',
      ),
  })
  .partial({ sponsorship: true })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.createdFrom &&
      v.createdBefore &&
      Date.parse(v.createdFrom) >= Date.parse(v.createdBefore)
    )
      ctx.addIssue({ code: 'custom', message: '角色创建时间范围无效' });
    if (
      v.realmMin &&
      v.realmMax &&
      mailRealmRank(v.realmMin) > mailRealmRank(v.realmMax)
    )
      ctx.addIssue({ code: 'custom', message: '境界下限不能高于上限' });
  });
export type SystemMailConditions = z.infer<typeof SystemMailConditionsSchema>;

export const SystemMailInputSchema = z
  .object({
    title: z.string().trim().min(1, '请填写邮件标题').max(200),
    content: z.string().trim().min(1, '请填写邮件正文').max(10000),
    rewardSelections: RewardSelectionsSchema,
    conditions: SystemMailConditionsSchema,
    startsAt: InstantSchema,
    endsAt: InstantSchema,
  })
  .strict()
  .refine(
    (v) => Date.parse(v.startsAt) < Date.parse(v.endsAt),
    '投递开始时间必须早于结束时间',
  );
export type SystemMailInput = z.infer<typeof SystemMailInputSchema>;

/** Server-captured facts keep retries independent of subsequent progression. */
export const SystemMailAudienceSnapshotSchema = z
  .object({
    cultivatorId: z.uuid(),
    createdAt: InstantSchema,
    realm: MailRealmSchema,
    highestSponsorshipTier: z.enum(SPONSORSHIP_TIER_IDS).nullable(),
    checkedAt: InstantSchema,
  })
  .strict();
export type SystemMailAudienceSnapshot = z.infer<
  typeof SystemMailAudienceSnapshotSchema
>;

export function matchesSystemMailConditions(
  conditions: SystemMailConditions,
  facts: SystemMailAudienceSnapshot,
  publishedAt: string,
): boolean {
  if (
    conditions.targetCultivatorId &&
    conditions.targetCultivatorId !== facts.cultivatorId
  )
    return false;
  const created = Date.parse(facts.createdAt);
  if (conditions.createdFrom && created < Date.parse(conditions.createdFrom))
    return false;
  if (
    conditions.createdBefore &&
    created >= Date.parse(conditions.createdBefore)
  )
    return false;
  if (conditions.createdBeforePublication && created >= Date.parse(publishedAt))
    return false;
  const rank = mailRealmRank(facts.realm);
  if (conditions.realmMin && rank < mailRealmRank(conditions.realmMin))
    return false;
  if (conditions.realmMax && rank > mailRealmRank(conditions.realmMax))
    return false;
  if (conditions.sponsorship) {
    if (!facts.highestSponsorshipTier) return false;
    const { mode, tiers } = conditions.sponsorship;
    if (mode === 'one_of' && !tiers.includes(facts.highestSponsorshipTier))
      return false;
    if (
      mode === 'at_least' &&
      SPONSORSHIP_TIER_META[facts.highestSponsorshipTier].rank <
        SPONSORSHIP_TIER_META[tiers[0]!].rank
    )
      return false;
  }
  return true;
}

export function isSystemMailInWindow(
  input: { publishedAt: string; startsAt: string; endsAt: string },
  checkedAt: string,
): boolean {
  const time = Date.parse(checkedAt);
  return (
    Date.parse(input.publishedAt) <= time &&
    Date.parse(input.startsAt) <= time &&
    time < Date.parse(input.endsAt)
  );
}

export type SystemMailCampaign = SystemMailInput & {
  id: string;
  status: 'draft' | 'published' | 'stopped';
  revision: number;
  createdAt: string;
  publishedAt: string | null;
  deliveredCount: number;
};
export type SystemMailListItem = Omit<
  SystemMailCampaign,
  'content' | 'rewardSelections'
>;

export function systemMailStatusLabel(
  campaign: Pick<SystemMailCampaign, 'status' | 'startsAt' | 'endsAt'>,
  now: number,
): string {
  if (campaign.status === 'draft') return '草稿';
  if (campaign.status === 'stopped') return '已停用';
  if (now < Date.parse(campaign.startsAt)) return '待开始';
  return now < Date.parse(campaign.endsAt) ? '投递中' : '已结束';
}

export function systemMailConditionSummary(
  conditions: SystemMailConditions,
): string[] {
  const result: string[] = [];
  if (conditions.targetCultivatorId)
    result.push(`指定角色：${conditions.targetCultivatorId}`);
  if (conditions.createdBeforePublication) result.push('仅发布前创建的角色');
  if (conditions.createdFrom)
    result.push(`角色创建不早于 ${formatMailTime(conditions.createdFrom)}`);
  if (conditions.createdBefore)
    result.push(`角色创建早于 ${formatMailTime(conditions.createdBefore)}`);
  if (conditions.realmMin)
    result.push(
      `最低境界：${conditions.realmMin.realm}${conditions.realmMin.stage}`,
    );
  if (conditions.realmMax)
    result.push(
      `最高境界：${conditions.realmMax.realm}${conditions.realmMax.stage}`,
    );
  if (conditions.sponsorship)
    result.push(
      `历史最高赞助级别${conditions.sponsorship.mode === 'at_least' ? '不低于' : '为'}：${conditions.sponsorship.tiers.map((t) => SPONSORSHIP_TIER_META[t].name).join('、')}`,
    );
  return result.length ? result : ['全部有效角色'];
}
export function formatMailTime(time: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time));
}
