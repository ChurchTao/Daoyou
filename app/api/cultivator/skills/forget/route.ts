import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { skills } from '@/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ForgetSkillSchema = z.object({
  skillId: z.string(),
});

/**
 * POST /api/cultivator/skills/forget
 * 遗忘技能
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { skillId } = ForgetSkillSchema.parse(body);

    const deleted = await db()
      .delete(skills)
      .where(
        and(eq(skills.id, skillId), eq(skills.cultivatorId, cultivator.id)),
      )
      .returning();

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found or could not be deleted' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
