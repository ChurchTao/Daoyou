import type { RealmType } from '@daoyou/constants/realms';
import {
  INVASION_CARDS,
  type InvasionCard,
  type InvasionCards,
  type InvasionMember,
  type InvasionPhase,
  type InvasionResources,
  type InvasionReward,
} from '@daoyou/game-domain/invasion';
import { z } from 'zod';

export const InvasionCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('recruit'), advertised: z.boolean() }),
  z.strictObject({ type: z.literal('start') }),
  z.strictObject({
    type: z.literal('next'),
    runId: z.uuid(),
    wave: z.number().int().positive(),
  }),
  z.strictObject({ type: z.literal('withdraw') }),
  z.strictObject({ type: z.literal('ready'), ready: z.boolean() }),
  z.strictObject({
    type: z.literal('card'),
    card: z.enum(INVASION_CARDS).nullable(),
  }),
  z.strictObject({
    type: z.literal('recover'),
    itemId: z.uuid(),
    requestId: z.uuid(),
  }),
]);
export type InvasionCommand = z.infer<typeof InvasionCommandSchema>;
export type InvasionIdentity = Pick<
  InvasionMember,
  'cultivatorId' | 'name' | 'title' | 'gender' | 'realm' | 'realmStage'
>;
export type InvasionPublicTeam = { id: string; members: InvasionIdentity[] };
export type InvasionPreviousWave = { wave: number } & (
  | { status: 'assist' | 'pending' }
  | { status: 'settled'; reward: InvasionReward | null }
);
export type InvasionStatus = {
  opensAt: number;
  closesAt: number;
  nextOpensAt: number;
  serverNow: number;
  open: boolean;
  otherCharacter: boolean;
  completedWave: number;
  lastBattleId: string | null;
  reward: InvasionReward | null;
  rewardsPending: boolean;
  team:
    | (InvasionPublicTeam & {
        phase: InvasionPhase;
        realm: RealmType;
        leader: boolean;
        captainId: string;
        startBlockedReason?: string;
        regrouping?: boolean;
        recruiting?: boolean;
        ready: string[];
        wave: number;
        restEndsAt: number | null;
        battleId: string | null;
        firstClear: boolean;
        previousWave?: InvasionPreviousWave;
        resources: Record<string, InvasionResources>;
        self: { cards: InvasionCards; selected?: InvasionCard };
        recovery: { id: string; name: string; quantity: number }[];
      })
    | null;
};
export type InvasionRanking = {
  week: string | null;
  rows: (InvasionPublicTeam & {
    realm: RealmType;
    rank: number;
    wave: number;
    participants: InvasionIdentity[];
  })[];
};
