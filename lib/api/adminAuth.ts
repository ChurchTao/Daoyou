import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { AuthHandler } from './types';

interface AdminContext {
  user: {
    id: string;
    email?: string;
  };
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function withAdminAuth<
  T extends Record<string, string> = Record<string, string>,
>(handler: AuthHandler<AdminContext, T>) {
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

      if (!isAdminEmail(user.email)) {
        return errorResponse('无管理员权限', 403);
      }

      const resolvedParams = context?.params ? await context.params : ({} as T);
      return handler(
        request,
        { user: { id: user.id, email: user.email } },
        resolvedParams,
      );
    } catch (error) {
      console.error('Admin API Error:', error);
      return errorResponse('服务器内部错误', 500);
    }
  };
}
