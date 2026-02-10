import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 角色类型（从 Drizzle schema 推断）
 */
export type Cultivator = typeof cultivators.$inferSelect;

/**
 * 仅认证上下文
 * 用于不需要操作特定角色的接口
 */
export interface AuthContext {
  user: User;
}

/**
 * 认证 + 活跃角色上下文
 * 用于需要操作当前活跃角色的接口
 */
export interface CultivatorContext extends AuthContext {
  cultivator: Cultivator;
  db: typeof db;
}

/**
 * 处理器函数类型
 * @template TContext - 上下文类型 (AuthContext | CultivatorContext)
 * @template TParams - URL 参数类型
 */
export type AuthHandler<TContext, TParams = Record<string, string>> = (
  request: NextRequest,
  context: TContext,
  params: TParams,
) => Promise<NextResponse | Response>;
