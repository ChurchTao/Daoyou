import { z } from 'zod';

export const PartyCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('create') }),
  z.strictObject({ type: z.literal('join'), partyId: z.uuid() }),
  z.strictObject({ type: z.literal('leave'), partyId: z.uuid() }),
  z.strictObject({ type: z.literal('disband'), partyId: z.uuid() }),
  z.strictObject({
    type: z.literal('kick'),
    partyId: z.uuid(),
    userId: z.uuid(),
  }),
  z.strictObject({
    type: z.literal('promote'),
    partyId: z.uuid(),
    userId: z.uuid(),
  }),
]);
export type PartyCommand = z.infer<typeof PartyCommandSchema>;
export type PartyView = {
  id: string;
  leaderId: string;
  revision: number;
  members: Array<{
    userId: string;
    cultivatorId: string;
    name: string;
    realm: string;
    realmStage: string;
    title: string | null;
    gender: string | null;
  }>;
};
export type CurrentParty = { party: PartyView | null; roleMismatch?: boolean };

export const PARTY_CHAT_MAX_CHARS = 100;

export const PartyChatSendSchema = z
  .object({
    text: z.string().max(400),
    replyToMessageId: z.uuid().optional(),
  })
  .strict();

export type PartyChatSend = z.infer<typeof PartyChatSendSchema>;

export type PartyChatReply = {
  messageId: string;
  senderName: string;
  summary: string;
};

export type PartyChatMessage = {
  id: string;
  teamId: string;
  senderCultivatorId: string;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  senderTitle?: string | null;
  text: string;
  reply: PartyChatReply | null;
  createdAt: string;
};
