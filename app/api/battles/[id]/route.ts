import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: false,
    error: '旧战绩详情接口已废弃，请使用 /api/battle-records/v2/[id]',
  }, { status: 410 });
}
