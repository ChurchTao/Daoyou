import { mockRankings } from '@/data/mockRankings';
import { NextResponse } from 'next/server';

/**
 * GET /api/rankings
 * 获取排行榜数据
 * 目前使用mock数据，后续将接入真实数据库
 */
export async function GET() {
  try {
    // 返回mock排行榜数据
    return NextResponse.json({
      success: true,
      data: mockRankings,
    });
  } catch (error) {
    console.error('获取排行榜 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取排行榜失败，请稍后重试'
        : '获取排行榜失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
