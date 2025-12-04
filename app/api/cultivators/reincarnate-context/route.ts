import { getLastDeadCultivatorSummary } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

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
  } catch (err) {
    console.error('获取转世上下文 API 错误:', err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'development'
            ? err instanceof Error
              ? err.message
              : '获取转世上下文失败'
            : '获取转世上下文失败，请稍后再试',
      },
      { status: 500 },
    );
  }
}
