export interface SocialBlockDTO {
  id: string;
  name: string;
  createdAt: string;
}
export interface SocialSummary {
  unreadMessages: number;
  archivedUnreadMessages: number;
  friendRequests: number;
  mentorshipRequests: number;
  mentorshipReadyToGraduate: number;
}
