import { expireListings } from '@/lib/services/AuctionService';
import { NextResponse } from 'next/server';

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Cron Job: 处理过期的拍卖物品
 * 执行频率：每小时
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const processed = await expireListings();
    console.log(`Processed ${processed} expired auctions`);

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
