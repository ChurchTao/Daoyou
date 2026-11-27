import { HuntEventIdSchema } from '@daoyou/game-domain/hunts';
import { z } from 'zod';

export const PartyRecruitmentSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('invite') }),
  z.strictObject({ kind: z.literal('public'), recruitmentId: z.uuid() }),
  z.strictObject({
    kind: z.literal('hunt'),
    eventId: HuntEventIdSchema.nullable(),
  }),
  z.strictObject({ kind: z.literal('invasion'), week: z.iso.date() }),
]);
export type PartyRecruitmentSource = z.infer<
  typeof PartyRecruitmentSourceSchema
>;

export const PARTY_CAPACITY = 4;
export const PARTY_APPLICATION_LIMIT = 3;
export const PARTY_APPLICATION_TTL_MS = 10 * 60 * 1000;
export const PARTY_RECRUITMENT_MINUTES = 30;
export const PARTY_RECRUITMENT_LABELS = {
  any: '自由结伴',
  hunt: '结伴讨伐',
  invasion: '古魔入侵',
  arena: '擂台切磋',
} as const;
export const PartyRecruitmentIntentSchema = z.enum([
  'any',
  'hunt',
  'invasion',
  'arena',
]);
export type PartyRecruitmentIntent = z.infer<
  typeof PartyRecruitmentIntentSchema
>;
export type PartyRecruitmentNotice = {
  id: string;
  intent: PartyRecruitmentIntent;
  expiresAt: number;
};

export const PartyCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('create') }),
  z.strictObject({
    type: z.literal('recruit'),
    partyId: z.uuid(),
    intent: PartyRecruitmentIntentSchema,
  }),
  z.strictObject({ type: z.literal('stop-recruiting'), partyId: z.uuid() }),
  z.strictObject({
    type: z.literal('apply'),
    partyId: z.uuid(),
    source: PartyRecruitmentSourceSchema,
  }),
  z.strictObject({ type: z.literal('approve'), applicationId: z.uuid() }),
  z.strictObject({ type: z.literal('reject'), applicationId: z.uuid() }),
  z.strictObject({ type: z.literal('cancel'), applicationId: z.uuid() }),
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
export type PartyPublicMember = Omit<PartyView['members'][number], 'userId'>;
export type PartyMemberVitals = {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
};
export type PartyMemberState = {
  online: boolean;
  sectName: string | null;
  vitals: PartyMemberVitals | null;
};
export type PartyVitalsView = Partial<Record<string, PartyMemberState>>;
export type PartyRecruitment = {
  partyId: string;
  leader: PartyPublicMember;
  memberCount: number;
  source: PartyRecruitmentSource;
  label: string;
  requirement?: string;
};
export type PartyApplicationStatus =
  'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type PartyApplication = {
  id: string;
  partyId: string | null;
  partyLabel: string;
  source: PartyRecruitmentSource;
  label: string;
  status: PartyApplicationStatus;
  expiresAt: number;
};
export type IncomingPartyApplication = PartyApplication & {
  applicant: PartyPublicMember;
};
export type CurrentParty = {
  party: PartyView | null;
  roleMismatch: boolean;
  recruitment: PartyRecruitmentNotice | null;
  incoming: IncomingPartyApplication[];
  outgoing: PartyApplication[];
};

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
