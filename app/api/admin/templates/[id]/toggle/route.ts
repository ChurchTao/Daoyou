import { withAdminAuth } from '@/lib/api/adminAuth';
import { db } from '@/lib/drizzle/db';
import { adminMessageTemplates } from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withAdminAuth<{ id: string }>(
  async (_request: NextRequest, { user }, params) => {
    const template = await db().query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, params.id),
    });

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    const nextStatus = template.status === 'active' ? 'disabled' : 'active';

    const [updated] = await db()
      .update(adminMessageTemplates)
      .set({
        status: nextStatus,
        updatedBy: user.id,
      })
      .where(eq(adminMessageTemplates.id, params.id))
      .returning();

    return NextResponse.json({ success: true, template: updated });
  },
);
