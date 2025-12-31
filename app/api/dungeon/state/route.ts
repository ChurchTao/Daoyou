import { withActiveCultivator } from '@/lib/api/withAuth';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { NextResponse } from 'next/server';

export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const state = await dungeonService.getState(cultivator.id);
  return NextResponse.json({ state });
});
