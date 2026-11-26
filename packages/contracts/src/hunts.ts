import type {
  HuntEvent,
  HuntRewardSnapshot,
  HuntTeam,
} from '@daoyou/game-domain/hunts';
import { HuntEventIdSchema } from '@daoyou/game-domain/hunts';

import { z } from 'zod';

import { REALM_VALUES } from '@daoyou/constants/realms';

export const HuntCreateTeamSchema = z
  .object({
    eventId: HuntEventIdSchema.optional(),
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
      type: z.literal('start'),
      revision: z.number().int().nonnegative(),
      eventId: HuntEventIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('target'),
      eventId: HuntEventIdSchema.nullable(),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal('recruit') }).strict(),
]);

export type HuntTeamCommand = z.infer<typeof HuntTeamCommandSchema>;

export {
  PARTY_CHAT_MAX_CHARS as HUNT_TEAM_CHAT_MAX_CHARS,
  PartyChatSendSchema as HuntTeamChatSendSchema,
  type PartyChatMessage as HuntTeamChatMessage,
  type PartyChatReply as HuntTeamChatReply,
  type PartyChatSend as HuntTeamChatSend,
} from './party.js';

export type HuntLobby = {
  event: HuntEvent;
  open: boolean;
  claimed: boolean;
  myTeam: HuntTeam | null;
  serverNow: number;
};

export type HuntMine = {
  team: HuntTeam | null;
  serverNow: number;
};

export type HuntBattleReward = {
  status: 'pending' | 'no-reward' | 'rewarded' | 'assisting';
  reason?: 'fallen';
  reward?: HuntRewardSnapshot;
  mailId?: string;
};
