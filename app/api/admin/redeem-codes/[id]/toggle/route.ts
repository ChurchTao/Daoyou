import { withAdminAuth } from '@/lib/api/adminAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { redeemCodes } from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const POST = withAdminAuth<{ id: string }>(
  async (_request, { user }, params) => {
    const q = getExecutor();
    const item = await q.query.redeemCodes.findFirst({
      where: eq(redeemCodes.id, params.id),
    });

    if (!item) {
      return NextResponse.json({ error: '兑换码不存在' }, { status: 404 });
    }

    const nextStatus = item.status === 'active' ? 'disabled' : 'active';
    const [updated] = await q
      .update(redeemCodes)
      .set({
        status: nextStatus,
        updatedBy: user.id,
      })
      .where(eq(redeemCodes.id, item.id))
      .returning();

    return NextResponse.json({ success: true, redeemCode: updated });
  },
);
