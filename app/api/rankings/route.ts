import { cache } from 'react';
import { getRankingList } from '@/lib/redis/rankings';
import { NextResponse } from 'next/server';

// 使用 React.cache() 进行请求内去重
const getCachedRankingList = cache(async () => {
  return await getRankingList();
});

/**
 * GET /api/rankings
 * 获取万界金榜数据（前100名）
 * 从Redis读取排行榜数据，包含新天骄标记
 */
export async function GET() {
  try {
    const rankings = await getCachedRankingList();

    return NextResponse.json({
      success: true,
      data: rankings,
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
