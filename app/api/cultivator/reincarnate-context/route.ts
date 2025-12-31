import { withAuth } from '@/lib/api/withAuth';
import { getLastDeadCultivatorSummary } from '@/lib/repositories/cultivatorRepository';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/reincarnate-context
 * 获取转世上下文（上一世角色摘要）
 */
export const GET = withAuth(async (_req, { user }) => {
  const summary = await getLastDeadCultivatorSummary(user.id);
  if (!summary) {
    return NextResponse.json({
      success: true,
      data: null,
    });
  }

  return NextResponse.json({
    success: true,
    data: summary,
  });
});
