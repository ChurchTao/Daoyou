export const MENTORSHIP_MILESTONE_KEYS = [
  'realm',
  'manual',
  'sect_methods',
  'body',
] as const;
export type MentorshipMilestoneKey = (typeof MENTORSHIP_MILESTONE_KEYS)[number];
export type MentorshipRequestStatus =
  'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type MentorshipRelationStatus = 'active' | 'graduated' | 'dissolved';

export interface MentorshipMilestone {
  key: MentorshipMilestoneKey;
  label: string;
  current: number;
  required: number;
  complete: boolean;
  detail: string;
}

export interface MentorshipGraduationProgress {
  ready: boolean;
  milestones: MentorshipMilestone[];
}

export interface MentorshipGraduationFacts {
  realm: string;
  realmStage: string;
  manuals: ReadonlyArray<{ realm: string; level: number }>;
  sectMethodLevels: readonly number[];
  bodyTrackLevels: readonly number[];
}
