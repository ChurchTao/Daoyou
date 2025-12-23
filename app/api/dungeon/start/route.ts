import { db } from '@/lib/drizzle/db';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const StartSchema = z.object({
  mapNodeId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get active cultivator
  const cultivator = await db.query.cultivators.findFirst({
    where: (cultivators, { eq, and }) =>
      and(eq(cultivators.userId, user.id), eq(cultivators.status, 'active')),
  });

  if (!cultivator) {
    return NextResponse.json(
      { error: 'No active cultivator' },
      { status: 404 },
    );
  }
  try {
    const body = await req.json();
    const { mapNodeId } = StartSchema.parse(body);
    const result = await dungeonService.startDungeon(cultivator.id, mapNodeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Start Dungeon Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '系统内部错误' },
      { status: 500 },
    );
  }
}
