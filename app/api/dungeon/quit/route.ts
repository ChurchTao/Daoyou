import { withActiveCultivator } from '@/lib/api/withAuth';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { NextResponse } from 'next/server';

export const POST = withActiveCultivator(async (_req, { cultivator }) => {
  await dungeonService.quitDungeon(cultivator.id);
  return NextResponse.json({ success: true });
});
