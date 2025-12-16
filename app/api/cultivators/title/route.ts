import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
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

    const { cultivatorId, title } = await request.json();

    if (!cultivatorId) {
      return NextResponse.json(
        { error: 'Parameters missing' },
        { status: 400 },
      );
    }

    // Validate title length
    if (title && (title.length < 2 || title.length > 8)) {
      return NextResponse.json(
        { error: '称号长度需在2-8字之间' },
        { status: 400 },
      );
    }

    // Verify ownership
    const existing = await db.query.cultivators.findFirst({
      where: and(
        eq(cultivators.id, cultivatorId),
        eq(cultivators.userId, user.id),
      ),
      columns: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '角色不存在或无权限' },
        { status: 403 },
      );
    }

    // Update title
    const updated = await db
      .update(cultivators)
      .set({ title: title || null }) // Allow clearing title by sending empty string or null
      .where(eq(cultivators.id, cultivatorId))
      .returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating title:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
