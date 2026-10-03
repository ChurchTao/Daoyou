import {
  AdminAccountParamsSchema,
  type AdminAccountBanDuration,
  type AdminAccountBanRequest,
  type AdminAccountChangeEmailRequest,
  type AdminAccountErrorResponse,
  type AdminAccountListItem,
  type AdminAccountListQuery,
} from '@daoyou/shared/contracts/adminAccounts';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { auth } from '@server/lib/auth/auth.js';
import { authAccounts, authSessions } from '@server/lib/auth/schema.js';
import type { AuthUser } from '@server/lib/auth/types.js';
import { runDbTasks, type DbClient } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { APIError } from 'better-auth/api';
import { and, eq, inArray } from 'drizzle-orm';
type AuthHeaders = (headers: Headers) => void;

const BAN_DURATION_SECONDS: Record<
  Exclude<AdminAccountBanDuration, 'permanent'>,
  number
> = {
  '1_day': 24 * 60 * 60,
  '7_days': 7 * 24 * 60 * 60,
  '30_days': 30 * 24 * 60 * 60,
};

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function getAuthErrorDetails(error: unknown) {
  if (error instanceof APIError) {
    return {
      code:
        typeof error.body?.code === 'string'
          ? error.body.code
          : 'AUTH_API_ERROR',
      message:
        typeof error.body?.message === 'string'
          ? error.body.message
          : error.message,
      statusCode: error.statusCode,
    };
  }

  return {
    code: 'AUTH_API_ERROR',
    message: error instanceof Error ? error.message : 'Better Auth 操作失败',
    statusCode: 500,
  };
}

function accountError(
  error: string,
  status: 400 | 403 | 404 | 409 | 500,
  code?: string,
  partial?: AdminAccountErrorResponse['partial'],
): never {
  throw new HttpException(
    {
      success: false,
      error,
      ...(code ? { code } : {}),
      ...(partial ? { partial } : {}),
    } satisfies AdminAccountErrorResponse,
    status,
  );
}

function mapBetterAuthError(error: unknown): never {
  const details = getAuthErrorDetails(error);

  if (
    details.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ||
    details.code === 'USER_ALREADY_EXISTS'
  ) {
    return accountError('该邮箱已被其他账号占用', 409, details.code);
  }

  if (details.statusCode === 404 || details.code === 'USER_NOT_FOUND') {
    return accountError('目标账号不存在', 404, details.code);
  }

  if (details.statusCode === 403) {
    return accountError('无账号管理权限', 403, details.code);
  }

  if (details.code === 'YOU_CANNOT_BAN_YOURSELF') {
    return accountError('不能封禁当前管理员账号', 409, details.code);
  }

  return accountError('Better Auth 操作失败', 500, details.code);
}

function logAccountEmailOperation(event: {
  outcome: 'success' | 'failure' | 'partial';
  phase: 'lookup' | 'precondition' | 'update_email' | 'revoke_sessions';
  operatorUserId: string;
  targetUserId: string;
  oldEmail?: string;
  newEmail?: string;
  oldEmailVerified?: boolean;
  errorCode?: string;
}) {
  const payload = {
    event: 'admin_account_email_change',
    occurredAt: new Date().toISOString(),
    ...event,
  };

  if (event.outcome === 'success') {
    console.info('[admin-account-email-change]', payload);
    return;
  }

  console.error('[admin-account-email-change]', payload);
}

function logAccountModerationOperation(event: {
  action: 'ban' | 'unban';
  outcome: 'success' | 'failure';
  operatorUserId: string;
  targetUserId: string;
  duration?: AdminAccountBanDuration;
  reason?: string;
  errorCode?: string;
}) {
  const payload = {
    event: 'admin_account_moderation',
    occurredAt: new Date().toISOString(),
    ...event,
  };

  if (event.outcome === 'success') {
    console.info('[admin-account-moderation]', payload);
    return;
  }

  console.error('[admin-account-moderation]', payload);
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(
    headers: Headers,
    query: AdminAccountListQuery,
    onHeaders: AuthHeaders,
  ) {
    const offset = (query.page - 1) * query.limit;

    let result;
    try {
      result = await auth.api.listUsers({
        headers: headers,
        query: {
          limit: query.limit,
          offset,
          sortBy: 'createdAt',
          sortDirection: 'desc',
          ...(query.search
            ? {
                searchValue: query.search,
                searchField: query.searchField,
                searchOperator: 'contains' as const,
              }
            : {}),
          ...(query.verified === 'all'
            ? {}
            : {
                filterField: 'emailVerified',
                filterValue: query.verified === 'true',
                filterOperator: 'eq' as const,
              }),
        },
        returnHeaders: true,
      });
    } catch (error) {
      return mapBetterAuthError(error);
    }

    onHeaders(result.headers);
    const users = result.response.users;
    const userIds = users.map((user) => user.id);

    const providerMap = new Map<string, Set<string>>();
    const sessionMap = new Map<
      string,
      { activeCount: number; lastSessionAt: Date | null }
    >();
    const cultivatorMap = new Map<
      string,
      AdminAccountListItem['activeCultivator']
    >();

    if (userIds.length > 0) {
      const executor = this.database;
      const now = new Date();
      const [accountRows, sessionRows, cultivatorRows] = await runDbTasks(
        executor,
        [
          () =>
            executor
              .select({
                userId: authAccounts.userId,
                providerId: authAccounts.providerId,
              })
              .from(authAccounts)
              .where(inArray(authAccounts.userId, userIds)),
          () =>
            executor
              .select({
                userId: authSessions.userId,
                expiresAt: authSessions.expiresAt,
                updatedAt: authSessions.updatedAt,
              })
              .from(authSessions)
              .where(inArray(authSessions.userId, userIds)),
          () =>
            executor
              .select({
                id: cultivators.id,
                userId: cultivators.userId,
                name: cultivators.name,
                realm: cultivators.realm,
                realmStage: cultivators.realm_stage,
                lastActiveAt: cultivators.lastActiveAt,
              })
              .from(cultivators)
              .where(
                and(
                  inArray(cultivators.userId, userIds),
                  eq(cultivators.status, 'active'),
                ),
              ),
        ] as const,
      );

      for (const row of accountRows) {
        const providers = providerMap.get(row.userId) ?? new Set<string>();
        providers.add(row.providerId);
        providerMap.set(row.userId, providers);
      }

      for (const row of sessionRows) {
        const current = sessionMap.get(row.userId) ?? {
          activeCount: 0,
          lastSessionAt: null,
        };
        if (row.expiresAt > now) {
          current.activeCount += 1;
        }
        if (!current.lastSessionAt || row.updatedAt > current.lastSessionAt) {
          current.lastSessionAt = row.updatedAt;
        }
        sessionMap.set(row.userId, current);
      }

      for (const row of cultivatorRows) {
        if (cultivatorMap.has(row.userId)) continue;
        cultivatorMap.set(row.userId, {
          id: row.id,
          name: row.name,
          realm: row.realm,
          realmStage: row.realmStage,
          lastActiveAt: toIsoString(row.lastActiveAt),
        });
      }
    }

    const accounts: AdminAccountListItem[] = users.map((user) => {
      const session = sessionMap.get(user.id);
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        banned: Boolean(user.banned),
        banReason: user.banReason ?? null,
        banExpires: toIsoString(user.banExpires),
        providers: Array.from(providerMap.get(user.id) ?? []).sort(),
        createdAt: toIsoString(user.createdAt) ?? '',
        activeSessionCount: session?.activeCount ?? 0,
        lastSessionAt: toIsoString(session?.lastSessionAt),
        activeCultivator: cultivatorMap.get(user.id) ?? null,
      };
    });

    return {
      success: true,
      data: {
        accounts,
        total: result.response.total,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  async changeEmail(
    headers: Headers,
    actor: AuthUser,
    userId: string,
    input: AdminAccountChangeEmailRequest,
    onHeaders: AuthHeaders,
  ) {
    const params = AdminAccountParamsSchema.safeParse({ userId });
    if (!params.success) {
      return accountError('目标账号 ID 格式错误', 400, 'INVALID_USER_ID');
    }

    const operator = actor;
    const targetUserId = params.data.userId;

    let target;
    try {
      const result = await auth.api.getUser({
        headers: headers,
        query: { id: targetUserId },
        returnHeaders: true,
      });
      onHeaders(result.headers);
      target = result.response;
    } catch (error) {
      const details = getAuthErrorDetails(error);
      logAccountEmailOperation({
        outcome: 'failure',
        phase: 'lookup',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        newEmail: input.newEmail,
        errorCode: details.code,
      });
      return mapBetterAuthError(error);
    }

    const currentEmail = target.email.trim().toLowerCase();
    if (currentEmail !== input.expectedCurrentEmail) {
      logAccountEmailOperation({
        outcome: 'failure',
        phase: 'precondition',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        oldEmail: currentEmail,
        newEmail: input.newEmail,
        oldEmailVerified: target.emailVerified,
        errorCode: 'STALE_CURRENT_EMAIL',
      });
      return accountError(
        '账号邮箱已发生变化，请刷新列表后重试',
        409,
        'STALE_CURRENT_EMAIL',
      );
    }

    if (currentEmail === input.newEmail) {
      logAccountEmailOperation({
        outcome: 'failure',
        phase: 'precondition',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        oldEmail: currentEmail,
        newEmail: input.newEmail,
        oldEmailVerified: target.emailVerified,
        errorCode: 'EMAIL_UNCHANGED',
      });
      return accountError('新邮箱不能与当前邮箱相同', 409, 'EMAIL_UNCHANGED');
    }

    let updatedUser;
    try {
      const result = await auth.api.adminUpdateUser({
        headers: headers,
        body: {
          userId: targetUserId,
          data: {
            email: input.newEmail,
            emailVerified: false,
          },
        },
        returnHeaders: true,
      });
      onHeaders(result.headers);
      updatedUser = result.response;
    } catch (error) {
      const details = getAuthErrorDetails(error);
      logAccountEmailOperation({
        outcome: 'failure',
        phase: 'update_email',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        oldEmail: currentEmail,
        newEmail: input.newEmail,
        oldEmailVerified: target.emailVerified,
        errorCode: details.code,
      });
      return mapBetterAuthError(error);
    }

    try {
      const result = await auth.api.revokeUserSessions({
        headers: headers,
        body: { userId: targetUserId },
        returnHeaders: true,
      });
      onHeaders(result.headers);
    } catch (error) {
      const details = getAuthErrorDetails(error);
      logAccountEmailOperation({
        outcome: 'partial',
        phase: 'revoke_sessions',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        oldEmail: currentEmail,
        newEmail: updatedUser.email,
        oldEmailVerified: target.emailVerified,
        errorCode: details.code,
      });
      return accountError(
        '邮箱已改绑，但旧会话撤销失败，请刷新后重试下线',
        500,
        'EMAIL_CHANGED_SESSION_REVOKE_FAILED',
        {
          userId: targetUserId,
          email: updatedUser.email,
          emailVerified: false,
          sessionsRevoked: false,
        },
      );
    }

    logAccountEmailOperation({
      outcome: 'success',
      phase: 'revoke_sessions',
      operatorUserId: operator?.id ?? '',
      targetUserId,
      oldEmail: currentEmail,
      newEmail: updatedUser.email,
      oldEmailVerified: target.emailVerified,
    });

    return {
      success: true,
      data: {
        userId: targetUserId,
        email: updatedUser.email,
        emailVerified: false as const,
        sessionsRevoked: true as const,
      },
    };
  }

  async ban(
    headers: Headers,
    actor: AuthUser,
    userId: string,
    input: AdminAccountBanRequest,
    onHeaders: AuthHeaders,
  ) {
    const params = AdminAccountParamsSchema.safeParse({ userId });
    if (!params.success) {
      return accountError('目标账号 ID 格式错误', 400, 'INVALID_USER_ID');
    }

    const operator = actor;
    const targetUserId = params.data.userId;
    if (operator?.id === targetUserId) {
      logAccountModerationOperation({
        action: 'ban',
        outcome: 'failure',
        operatorUserId: operator.id,
        targetUserId,
        duration: input.duration,
        reason: input.reason,
        errorCode: 'YOU_CANNOT_BAN_YOURSELF',
      });
      return accountError(
        '不能封禁当前管理员账号',
        409,
        'YOU_CANNOT_BAN_YOURSELF',
      );
    }

    try {
      const result = await auth.api.banUser({
        headers: headers,
        body: {
          userId: targetUserId,
          banReason: input.reason,
          ...(input.duration === 'permanent'
            ? {}
            : { banExpiresIn: BAN_DURATION_SECONDS[input.duration] }),
        },
        returnHeaders: true,
      });
      onHeaders(result.headers);
      const user = result.response.user;

      logAccountModerationOperation({
        action: 'ban',
        outcome: 'success',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        duration: input.duration,
        reason: input.reason,
      });

      return {
        success: true,
        data: {
          userId: targetUserId,
          banned: true,
          banReason: user.banReason ?? input.reason,
          banExpires: toIsoString(user.banExpires),
          sessionsRevoked: true,
        },
      };
    } catch (error) {
      const details = getAuthErrorDetails(error);
      logAccountModerationOperation({
        action: 'ban',
        outcome: 'failure',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        duration: input.duration,
        reason: input.reason,
        errorCode: details.code,
      });
      return mapBetterAuthError(error);
    }
  }

  async unban(
    headers: Headers,
    actor: AuthUser,
    userId: string,
    onHeaders: AuthHeaders,
  ) {
    const params = AdminAccountParamsSchema.safeParse({ userId });
    if (!params.success) {
      return accountError('目标账号 ID 格式错误', 400, 'INVALID_USER_ID');
    }

    const operator = actor;
    const targetUserId = params.data.userId;

    try {
      const result = await auth.api.unbanUser({
        headers: headers,
        body: { userId: targetUserId },
        returnHeaders: true,
      });
      onHeaders(result.headers);

      logAccountModerationOperation({
        action: 'unban',
        outcome: 'success',
        operatorUserId: operator?.id ?? '',
        targetUserId,
      });

      return {
        success: true,
        data: {
          userId: targetUserId,
          banned: false,
          banReason: null,
          banExpires: null,
          sessionsRevoked: false,
        },
      };
    } catch (error) {
      const details = getAuthErrorDetails(error);
      logAccountModerationOperation({
        action: 'unban',
        outcome: 'failure',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        errorCode: details.code,
      });
      return mapBetterAuthError(error);
    }
  }

  async revokeSessions(
    headers: Headers,
    actor: AuthUser,
    userId: string,
    onHeaders: AuthHeaders,
  ) {
    const params = AdminAccountParamsSchema.safeParse({ userId });
    if (!params.success) {
      return accountError('目标账号 ID 格式错误', 400, 'INVALID_USER_ID');
    }

    const operator = actor;
    const targetUserId = params.data.userId;

    try {
      const userResult = await auth.api.getUser({
        headers: headers,
        query: { id: targetUserId },
        returnHeaders: true,
      });
      onHeaders(userResult.headers);

      const revokeResult = await auth.api.revokeUserSessions({
        headers: headers,
        body: { userId: targetUserId },
        returnHeaders: true,
      });
      onHeaders(revokeResult.headers);

      console.info('[admin-account-session-revoke]', {
        event: 'admin_account_session_revoke',
        occurredAt: new Date().toISOString(),
        outcome: 'success',
        operatorUserId: operator?.id ?? '',
        targetUserId,
      });

      return {
        success: true,
        data: {
          userId: targetUserId,
          sessionsRevoked: true as const,
        },
      };
    } catch (error) {
      const details = getAuthErrorDetails(error);
      console.error('[admin-account-session-revoke]', {
        event: 'admin_account_session_revoke',
        occurredAt: new Date().toISOString(),
        outcome: 'failure',
        operatorUserId: operator?.id ?? '',
        targetUserId,
        errorCode: details.code,
      });
      return mapBetterAuthError(error);
    }
  }
}
