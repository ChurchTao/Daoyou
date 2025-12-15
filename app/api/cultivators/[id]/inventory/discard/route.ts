import { db } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { itemId, itemType } = body;

    if (!itemId || !itemType) {
      return NextResponse.json(
        { success: false, error: 'Missing itemId or itemType' },
        { status: 400 },
      );
    }

    // Verify cultivator ownership
    const [cultivator] = await db
      .select()
      .from(schema.cultivators)
      .where(
        and(
          eq(schema.cultivators.id, id),
          eq(schema.cultivators.userId, user.id),
        ),
      )
      .limit(1);

    if (!cultivator) {
      return NextResponse.json(
        { success: false, error: 'Cultivator not found or access denied' },
        { status: 403 },
      );
    }

    // Delete item based on type
    let deleted = false;
    if (itemType === 'artifact') {
      // Check if equipped first? The frontend handles equipped state, but backend should ideally prevent deleting equipped items?
      // Or just set equipped to null in equippedItems if enforced by FK?
      // Schema says: onDelete: 'set null' for equippedItems relations. So it's safe to delete.
      const result = await db
        .delete(schema.artifacts)
        .where(
          and(
            eq(schema.artifacts.id, itemId),
            eq(schema.artifacts.cultivatorId, id),
          ),
        )
        .returning();
      deleted = result.length > 0;
    } else if (itemType === 'consumable') {
      const result = await db
        .delete(schema.consumables)
        .where(
          and(
            eq(schema.consumables.id, itemId),
            eq(schema.consumables.cultivatorId, id),
          ),
        )
        .returning();
      deleted = result.length > 0;
    } else if (itemType === 'material') {
      const result = await db
        .delete(schema.materials)
        .where(
          and(
            eq(schema.materials.id, itemId),
            eq(schema.materials.cultivatorId, id),
          ),
        )
        .returning();
      deleted = result.length > 0;
    } else {
      return NextResponse.json(
        { success: false, error: '无效的物品类型' },
        { status: 400 },
      );
    }

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '物品未找到或无法删除' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: '物品已丢弃' });
  } catch (error) {
    console.error('Discard API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
