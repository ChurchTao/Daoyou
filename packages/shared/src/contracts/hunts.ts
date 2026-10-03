import { z } from 'zod';
import type { HuntEvent } from '../hunts/config.js';
import type { HuntRewardSnapshot } from '../rewards/hunt.js';
import { REALM_VALUES, type RealmType } from '../types/constants.js';

export const HuntEventIdSchema = z
  .string()
  .regex(/^hunt-v[123]-\d{1,10}-[0-6]$/);
export const HuntCreateTeamSchema = z
  .object({
    eventId: HuntEventIdSchema,
    minRealm: z.enum(REALM_VALUES),
    maxRealm: z.enum(REALM_VALUES),
  })
  .strict()
  .refine(
    (v) => REALM_VALUES.indexOf(v.minRealm) <= REALM_VALUES.indexOf(v.maxRealm),
    '境界范围无效',
  );
export const HuntTeamCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('ready'),
      ready: z.boolean(),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal('leave'),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal('start'),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
]);
export type HuntTeamCommand = z.infer<typeof HuntTeamCommandSchema>;
export type HuntMember = {
  userId: string;
  cultivatorId: string;
  name: string;
  realm: RealmType;
  ready: boolean;
  assisting: boolean;
};
export type HuntTeam = {
  id: string;
  event: HuntEvent;
  leaderId: string;
  minRealm: RealmType;
  maxRealm: RealmType;
  members: HuntMember[];
  status: 'assembling' | 'starting' | 'in_battle';
  revision: number;
  startRequestId?: string;
  battleId?: string;
  lastBattleId?: string;
};
export type HuntLobby = {
  event: HuntEvent;
  open: boolean;
  claimed: boolean;
  teams: HuntTeam[];
  myTeam: HuntTeam | null;
  serverNow: number;
};
export type HuntBattleReward = {
  status: 'pending' | 'no-reward' | 'rewarded' | 'assisting';
  reason?: 'fallen';
  reward?: HuntRewardSnapshot;
  mailId?: string;
};
