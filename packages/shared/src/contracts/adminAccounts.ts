import { z } from 'zod';

export const AdminAccountListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  searchField: z.enum(['email', 'name']).default('email'),
  verified: z.enum(['all', 'true', 'false']).default('all'),
});

const NormalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: '邮箱格式错误' }));

export const AdminAccountChangeEmailRequestSchema = z.object({
  expectedCurrentEmail: NormalizedEmailSchema,
  newEmail: NormalizedEmailSchema,
});

export const AdminAccountBanDurationSchema = z.enum([
  '1_day',
  '7_days',
  '30_days',
  'permanent',
]);

export const AdminAccountBanRequestSchema = z.object({
  reason: z.string().trim().min(1, '请填写封禁原因').max(500),
  duration: AdminAccountBanDurationSchema,
});

export const AdminAccountParamsSchema = z.object({
  userId: z.string().uuid(),
});

export type AdminAccountListQuery = z.infer<typeof AdminAccountListQuerySchema>;
export type AdminAccountChangeEmailRequest = z.infer<
  typeof AdminAccountChangeEmailRequestSchema
>;
export type AdminAccountBanRequest = z.infer<
  typeof AdminAccountBanRequestSchema
>;
export type AdminAccountBanDuration = z.infer<
  typeof AdminAccountBanDurationSchema
>;

export interface AdminAccountCultivatorSummary {
  id: string;
  name: string;
  realm: string;
  realmStage: string;
  lastActiveAt: string | null;
}

export interface AdminAccountListItem {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  providers: string[];
  createdAt: string;
  activeSessionCount: number;
  lastSessionAt: string | null;
  activeCultivator: AdminAccountCultivatorSummary | null;
}

export interface AdminAccountListResponse {
  success: true;
  data: {
    accounts: AdminAccountListItem[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface AdminAccountChangeEmailResponse {
  success: true;
  data: {
    userId: string;
    email: string;
    emailVerified: false;
    sessionsRevoked: true;
  };
}

export interface AdminAccountRevokeSessionsResponse {
  success: true;
  data: {
    userId: string;
    sessionsRevoked: true;
  };
}

export interface AdminAccountModerationResponse {
  success: true;
  data: {
    userId: string;
    banned: boolean;
    banReason: string | null;
    banExpires: string | null;
    sessionsRevoked: boolean;
  };
}

export interface AdminAccountErrorResponse {
  success: false;
  error: string;
  code?: string;
  partial?: {
    userId: string;
    email: string;
    emailVerified: false;
    sessionsRevoked: false;
  };
}
