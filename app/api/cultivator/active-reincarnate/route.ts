import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { breakthroughHistory, cultivators } from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * POST /api/cultivator/active-reincarnate
 * 主动兵解（放弃当前角色，开始新轮回）
 */
export const POST = withActiveCultivator(async (_req, { cultivator }) => {
  if (cultivator.status === 'dead') {
    return NextResponse.json({ error: '该角色已身死道消' }, { status: 400 });
  }

  // Perform Reincarnation Logic
  await getExecutor().transaction(async (tx) => {
    // 1. Mark as dead
    await tx
      .update(cultivators)
      .set({
        status: 'dead',
        diedAt: new Date(),
      })
      .where(eq(cultivators.id, cultivator.id));

    // 2. Add a breakthrough history entry specifically for this event
    await tx.insert(breakthroughHistory).values({
      cultivatorId: cultivator.id,
      from_realm: cultivator.realm,
      from_stage: cultivator.realm_stage,
      to_realm: '轮回',
      to_stage: '转世',
      age: cultivator.age,
      years_spent: 0,
      story: `道友${cultivator.name}感悟天道无常，寿元虽未尽，然道心已决。遂于今日自行兵解，散去一身修为，只求来世再踏仙途，重证大道。天地为之动容，降下祥云送行。`,
    });
  });

  return NextResponse.json({ success: true, message: '兵解成功，轮回已开' });
});
