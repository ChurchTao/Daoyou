import { db } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, ctx: Params) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(battleRecords)
    .where(and(eq(battleRecords.id, id), eq(battleRecords.userId, user.id)))
    .limit(1);

  const record = rows[0];

  if (!record) {
    return NextResponse.json(
      { success: false, error: '记录不存在' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: record,
  });
}
