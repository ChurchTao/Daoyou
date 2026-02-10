import { AuctionService } from '@/lib/services/AuctionService';
import { NextResponse } from 'next/server';

/**
 * Cron Job: 处理过期的拍卖物品
 * 执行频率：每小时
 *
 * Vercel Cron 配置：
 * export const config = {
 *   runtime: 'edge',
 *   cron: '0 * * * *', // 每小时执行
 * }
 */
export async function GET(request: Request) {
  // 验证 Cron Secret
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const processed = await AuctionService.expireListings();

    return NextResponse.json({
      success: true,
      processed,
      message: `已处理 ${processed} 个过期拍卖`,
    });
  } catch (error) {
    console.error('Auction Expire Cron Error:', error);
    return NextResponse.json(
      { success: false, error: '处理过期拍卖失败' },
      { status: 500 },
    );
  }
}

// Vercel Cron 配置
export const config = {
  runtime: 'edge' as const,
  cron: '0 * * * *', // 每小时执行
};
