export type AdminOnlineUsersSource = 'redis' | 'memory';

export interface AdminOnlineUsersSnapshot {
  source: AdminOnlineUsersSource;
  generatedAt: string;
  currentOnline: number;
  todayPeakOnline: number;
  allTimePeakOnline: number;
  today: string;
}

export interface AdminOnlineUsersResponse {
  success: true;
  data: AdminOnlineUsersSnapshot;
}
