import {
  createSystemMailInputSchema,
  type SystemMailCampaign,
  mailRealmRank,
  type SystemMailConditions,
  type SystemMailAudienceSnapshot,
} from '@daoyou/game-domain/mail';
export const SystemMailInputSchema = createSystemMailInputSchema(RewardSelectionsSchema);





import { SPONSORSHIP_TIER_META } from '@daoyou/game-domain/sponsorship';




import { RewardSelectionsSchema } from '../rewards/items.js';


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
