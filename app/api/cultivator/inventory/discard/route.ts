import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const DiscardSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(['artifact', 'consumable', 'material']),
});

/**
 * POST /api/cultivator/inventory/discard
 * 丢弃物品
 */
export const POST = withActiveCultivator(
  async (req: NextRequest, { cultivator }) => {
    const body = await req.json();
    const { itemId, itemType } = DiscardSchema.parse(body);

    // Delete item based on type
    let deleted = false;
    if (itemType === 'artifact') {
      const result = await db()
        .delete(schema.artifacts)
        .where(
          and(
            eq(schema.artifacts.id, itemId),
            eq(schema.artifacts.cultivatorId, cultivator.id),
          ),
        )
        .returning();
      deleted = result.length > 0;
    } else if (itemType === 'consumable') {
      const result = await db()
        .delete(schema.consumables)
        .where(
          and(
            eq(schema.consumables.id, itemId),
            eq(schema.consumables.cultivatorId, cultivator.id),
          ),
        )
        .returning();
      deleted = result.length > 0;
    } else if (itemType === 'material') {
      const result = await db()
        .delete(schema.materials)
        .where(
          and(
            eq(schema.materials.id, itemId),
            eq(schema.materials.cultivatorId, cultivator.id),
          ),
        )
        .returning();
      deleted = result.length > 0;
    }

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '物品未找到或无法删除' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: '物品已丢弃' });
  },
);
