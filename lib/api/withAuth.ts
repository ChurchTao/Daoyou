import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext, AuthHandler, CultivatorContext } from './types';

/**
 * 创建错误响应的辅助函数
 */
function errorResponse(
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  const body: { error: string; details?: unknown } = { error: message };
  if (process.env.NODE_ENV === 'development' && details) {
    body.details = details instanceof Error ? details.message : details;
  }
  return NextResponse.json(body, { status });
}

/**
 * withAuth - 仅验证用户登录
 *
 * 适用于：不需要操作特定角色的接口
 * 例如：获取角色列表、生成角色、邮件列表等
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (req, { user }) => {
 *   const data = await getDataForUser(user.id);
 *   return NextResponse.json({ success: true, data });
 * });
 * ```
 */
export function withAuth<
  T extends Record<string, string> = Record<string, string>,
>(handler: AuthHandler<AuthContext, T>) {
  return async (
    request: NextRequest,
    context?: { params?: Promise<T> },
  ): Promise<NextResponse | Response> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return errorResponse('未授权访问', 401);
      }

      const resolvedParams = context?.params ? await context.params : ({} as T);
      return handler(request, { user }, resolvedParams);
    } catch (error) {
      console.error('API Error:', error);
      return errorResponse(
        error instanceof Error ? error.message : '服务器内部错误',
        500,
        error,
      );
    }
  };
}

/**
 * withActiveCultivator - 验证用户登录 + 自动获取活跃角色
 *
 * 适用于：需要操作当前活跃角色的接口（大多数游戏接口）
 * 特点：不需要前端传入 cultivatorId，自动获取当前用户的活跃角色
 *
 * @example
 * ```typescript
 * export const POST = withActiveCultivator(async (req, { user, cultivator }) => {
 *   // cultivator 已经是当前用户的活跃角色
 *   const result = await doSomething(cultivator.id);
 *   return NextResponse.json({ success: true, data: result });
 * });
 * ```
 */
export function withActiveCultivator<
  T extends Record<string, string> = Record<string, string>,
>(handler: AuthHandler<CultivatorContext, T>) {
  return async (
    request: NextRequest,
    context?: { params?: Promise<T> },
  ): Promise<NextResponse | Response> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return errorResponse('未授权访问', 401);
      }

      // 自动获取当前用户的活跃角色
      const cultivator = await db.query.cultivators.findFirst({
        where: and(
          eq(cultivators.userId, user.id),
          eq(cultivators.status, 'active'),
        ),
      });

      if (!cultivator) {
        return errorResponse('当前没有活跃角色', 404);
      }

      const resolvedParams = context?.params ? await context.params : ({} as T);
      return handler(request, { user, cultivator }, resolvedParams);
    } catch (error) {
      console.error('API Error:', error);
      return errorResponse(
        error instanceof Error ? error.message : '服务器内部错误',
        500,
        error,
      );
    }
  };
}
