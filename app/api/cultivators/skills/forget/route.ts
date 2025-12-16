import { db } from '@/lib/drizzle/db';
import { cultivators, skills } from '@/lib/drizzle/schema';
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

    const { cultivatorId, skillId } = await request.json();

    if (!cultivatorId || !skillId) {
      return NextResponse.json(
        { error: 'Parameters missing' },
        { status: 400 },
      );
    }

    // Verify ownership
    const cultivator = await db.query.cultivators.findFirst({
      where: and(
        eq(cultivators.id, cultivatorId),
        eq(cultivators.userId, user.id),
      ),
      columns: { id: true },
    });

    if (!cultivator) {
      return NextResponse.json(
        { error: 'Unauthorized: Cultivator does not belong to user' },
        { status: 403 },
      );
    }

    const deleted = await db
      .delete(skills)
      .where(and(eq(skills.id, skillId), eq(skills.cultivatorId, cultivatorId)))
      .returning();

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found or could not be deleted' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error forgetting skill:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
