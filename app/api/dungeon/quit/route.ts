import { db } from '@/lib/drizzle/db';
import { dungeonService } from '@/lib/dungeon/service';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
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
    await dungeonService.quitDungeon(cultivator.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Quit Dungeon Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '系统内部错误' },
      { status: 500 },
    );
  }
}
