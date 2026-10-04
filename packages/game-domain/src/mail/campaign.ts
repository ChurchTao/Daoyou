import { z } from 'zod';
import type { createRewardSchemas } from '../rewards/selection.js';
import { InstantSchema, SystemMailConditionsSchema } from './audience.js';


export function createSystemMailInputSchema(RewardSelectionsSchema: ReturnType<typeof createRewardSchemas>['RewardSelectionsSchema']) {
const SystemMailInputSchema = z
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
return SystemMailInputSchema;
}


export type SystemMailInput = z.infer<ReturnType<typeof createSystemMailInputSchema>>;


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
