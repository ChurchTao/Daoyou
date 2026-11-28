import { z } from 'zod';
import type { CultivatorPortraitRef } from './cultivatorAvatar.js';

export type FriendRelationship =
  'friend' | 'none' | 'incoming' | 'outgoing' | 'unavailable';
export type FriendRequestStatus =
  'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export interface FriendCultivatorSummary {
  id: string;
  name: string;
  title: string | null;
  realm: string;
  realmStage: string;
  status: string;
  portrait?: CultivatorPortraitRef;
}

export interface FriendListEntry extends FriendCultivatorSummary {
  /** Null for a character that is no longer active. */
  online: boolean | null;
}

export interface FriendListResponse {
  friends: FriendListEntry[];
}

export interface FriendTargetResponse {
  target: FriendCultivatorSummary;
  relationship: FriendRelationship;
  isFriend: boolean;
  request?: FriendRequestDTO;
}

export interface FriendSearchResult extends FriendCultivatorSummary {
  relationship: FriendRelationship;
  isFriend: boolean;
  request?: FriendRequestDTO;
}

export interface FriendSearchResponse {
  results: FriendSearchResult[];
}

export interface FriendRequestDTO {
  id: string;
  requester: FriendCultivatorSummary;
  recipient: FriendCultivatorSummary;
  direction: 'incoming' | 'outgoing';
  status: FriendRequestStatus;
  revision: number;
  createdAt: string;
  expiresAt: string;
}

export const CreateFriendRequestSchema = z
  .object({
    cultivatorId: z.string().uuid(),
    requestId: z.string().uuid(),
  })
  .strict();
export type CreateFriendRequest = z.infer<typeof CreateFriendRequestSchema>;
export const FriendRequestActionSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export type FriendRequestAction = z.infer<typeof FriendRequestActionSchema>;
export interface FriendRequestResult {
  relationship: FriendRelationship;
  request?: FriendRequestDTO;
  friend?: FriendCultivatorSummary;
  message: string;
}
