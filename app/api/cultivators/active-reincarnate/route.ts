import { db } from '@/lib/drizzle/db';
import { breakthroughHistory, cultivators } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cultivatorId } = await request.json();

    if (!cultivatorId) {
      return NextResponse.json(
        { error: 'Parameters missing' },
        { status: 400 },
      );
    }

    // Verify ownership and get current state
    const existing = await db
      .select()
      .from(cultivators)
      .where(
        and(eq(cultivators.id, cultivatorId), eq(cultivators.userId, user.id)),
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: '角色不存在或无权限' },
        { status: 403 },
      );
    }

    const cultivator = existing[0];

    if (cultivator.status === 'dead') {
      return NextResponse.json({ error: '该角色已身死道消' }, { status: 400 });
    }

    // Perform Reincarnation Logic
    await db.transaction(async (tx) => {
      // 1. Mark as dead
      await tx
        .update(cultivators)
        .set({
          status: 'dead',
          diedAt: new Date(),
        })
        .where(eq(cultivators.id, cultivatorId));

      // 2. Add a breakthrough history entry specifically for this event
      await tx.insert(breakthroughHistory).values({
        cultivatorId,
        from_realm: cultivator.realm,
        from_stage: cultivator.realm_stage,
        to_realm: '轮回',
        to_stage: '转世',
        age: cultivator.age,
        years_spent: 0,
        story: `道友${cultivator.name}感悟天道无常，寿元虽未尽，然道心已决。遂于今日自行兵解，散去一身修为，只求来世再踏仙途，重证大道。天地为之动容，降下祥云送行。`,
      });
    });

    return NextResponse.json({ success: true, message: '兵解成功，轮回已开' });
  } catch (error) {
    console.error('Active reincarnate error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
