import { z } from 'zod';
import { SPONSORSHIP_TIER_IDS } from '../sponsorship.js';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';


export const InstantSchema = z.string().datetime({ offset: true });

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
    targetCultivatorId: z.uuid('请填写有效的目标角色 ID').optional(),
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
