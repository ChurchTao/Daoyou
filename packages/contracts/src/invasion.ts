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
  z.strictObject({ type: z.literal('create') }),
  z.strictObject({ type: z.literal('join'), teamId: z.uuid().optional() }),
  z.strictObject({ type: z.literal('leave') }),
  z.strictObject({ type: z.literal('recruit'), advertised: z.boolean() }),
  z.strictObject({ type: z.literal('start') }),
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
  'cultivatorId' | 'name' | 'title' | 'gender' | 'realm'
>;
export type InvasionPublicTeam = { id: string; members: InvasionIdentity[] };
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
  teams: InvasionPublicTeam[];
  team:
    | (InvasionPublicTeam & {
        phase: InvasionPhase;
        realm: RealmType;
        leader: boolean;
        busyMembers?: boolean;
        regrouping?: boolean;
        recruiting?: boolean;
        ready: string[];
        wave: number;
        restEndsAt: number | null;
        battleId: string | null;
        firstClear: boolean;
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
    battleId: string | null;
    participants: InvasionIdentity[];
  })[];
};
