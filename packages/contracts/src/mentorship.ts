import type {
  MentorshipGraduationProgress,
  MentorshipMilestoneKey,
  MentorshipRelationStatus,
  MentorshipRequestStatus,
} from '@daoyou/game-domain/mentorship';
import { z } from 'zod';

export const MentorshipMutationSchema = z.strictObject({
  requestId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
});
export const MentorshipRequestSchema = z.strictObject({
  requestId: z.uuid(),
  targetCultivatorId: z.uuid(),
  direction: z.enum(['apprentice', 'mentor']),
});
export const MentorshipProfileSchema = MentorshipMutationSchema.extend({
  open: z.boolean(),
  directions: z.array(z.string().trim().min(1).max(20)).max(5),
  availableTimes: z.string().trim().max(100),
  introduction: z.string().trim().max(300),
});
export type MentorshipMutation = z.infer<typeof MentorshipMutationSchema>;
export type MentorshipRequestInput = z.infer<typeof MentorshipRequestSchema>;
export type MentorshipProfileInput = z.infer<typeof MentorshipProfileSchema>;
export interface MentorshipIdentity {
  id: string | null;
  name: string;
  realm?: string;
  realmStage?: string;
  status?: string;
}
export interface MentorshipProfileView {
  open: boolean;
  directions: string[];
  availableTimes: string;
  introduction: string;
  revision: number;
}
export interface MentorshipRelationView {
  id: string;
  status: MentorshipRelationStatus;
  revision: number;
  role: 'mentor' | 'disciple';
  mentor: MentorshipIdentity;
  disciple: MentorshipIdentity;
  paused: boolean;
  pauseReason: string | null;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  graduationRewardedAt: string | null;
  mentorReputationReward: number | null;
  discipleReputationReward: number | null;
  graduation: MentorshipGraduationProgress;
}
export interface MentorshipRequestView {
  id: string;
  status: MentorshipRequestStatus;
  revision: number;
  incoming: boolean;
  mentor: MentorshipIdentity;
  disciple: MentorshipIdentity;
  expiresAt: string;
  createdAt: string;
}
export interface MentorshipOverview {
  actor: MentorshipIdentity;
  eligibility: {
    canMentor: boolean;
    canApprentice: boolean;
    reasons: string[];
    permanentlyBound: boolean;
  };
  profile: MentorshipProfileView | null;
  relations: MentorshipRelationView[];
  requests: MentorshipRequestView[];
  graduation: MentorshipGraduationProgress;
  honor: { graduatedDisciples: number };
}
export interface MentorshipMentorView {
  cultivatorId: string;
  name: string;
  realm: string;
  realmStage: string;
  sectName: string | null;
  profile: MentorshipProfileView;
  remainingSeats: number;
}
export type { MentorshipGraduationProgress, MentorshipMilestoneKey };
