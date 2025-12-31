import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const TitleSchema = z.object({
  title: z.string().min(2).max(8).optional().nullable(),
});

/**
 * POST /api/cultivator/title
 * 修改当前活跃角色称号
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { title } = TitleSchema.parse(body);

    // Update title
    const updated = await db
      .update(cultivators)
      .set({ title: title || null }) // Allow clearing title by sending empty string or null
      .where(eq(cultivators.id, cultivator.id))
      .returning();

    return NextResponse.json({ success: true, data: updated[0] });
  },
);
