import { HuntEventIdSchema } from '@daoyou/game-domain/hunts';
import type {
  HuntTeam,
  HuntEvent,
  HuntRewardSnapshot,
} from '@daoyou/game-domain/hunts';

import { z } from 'zod';



import { REALM_VALUES } from '@daoyou/constants/realms';

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
