import { z } from 'zod';

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

export const AdminOnlineTrendQuerySchema = z.object({
  range: z.enum(['1h', '24h']).default('1h'),
});

export type AdminOnlineTrendRange = z.infer<
  typeof AdminOnlineTrendQuerySchema
>['range'];

export interface AdminOnlineTrendPoint {
  at: number;
  current: number | null;
  yesterday: number | null;
}

export interface AdminOnlineTrend {
  from: number;
  to: number;
  points: AdminOnlineTrendPoint[];
}

export interface AdminOnlineTrendResponse {
  success: true;
  data: AdminOnlineTrend;
}

export const AdminOnlineCharactersQuerySchema = z.object({
  search: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().positive().default(1),
});

export type AdminOnlineCharactersQuery = z.infer<
  typeof AdminOnlineCharactersQuerySchema
>;

export interface AdminOnlineCharacter {
  id: string;
  name: string;
  realm: string;
  realmStage: string;
  sectName: string | null;
}

export interface AdminOnlineCharactersPage {
  source: AdminOnlineUsersSource;
  generatedAt: string;
  items: AdminOnlineCharacter[];
  hasNext: boolean;
}

export interface AdminOnlineCharactersResponse {
  success: true;
  data: AdminOnlineCharactersPage;
}
