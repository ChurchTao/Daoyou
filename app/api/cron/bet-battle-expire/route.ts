import { expireBetBattles } from '@/lib/services/BetBattleService';
import { NextResponse } from 'next/server';

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const processed = await expireBetBattles();
    return NextResponse.json({
      success: true,
      processed,
      message: `已处理 ${processed} 个过期赌战`,
    });
  } catch (error) {
    console.error('Bet battle expire cron error:', error);
    return NextResponse.json(
      { success: false, error: '处理过期赌战失败' },
      { status: 500 },
    );
  }
}
