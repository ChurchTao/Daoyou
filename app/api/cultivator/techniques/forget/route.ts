import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivationTechniques } from '@/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ForgetTechniqueSchema = z.object({
  techniqueId: z.string(),
});

/**
 * POST /api/cultivator/techniques/forget
 * 遗忘功法
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { techniqueId } = ForgetTechniqueSchema.parse(body);

    const deleted = await getExecutor()
      .delete(cultivationTechniques)
      .where(
        and(
          eq(cultivationTechniques.id, techniqueId),
          eq(cultivationTechniques.cultivatorId, cultivator.id),
        ),
      )
      .returning();

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        { error: 'Technique not found or could not be deleted' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
