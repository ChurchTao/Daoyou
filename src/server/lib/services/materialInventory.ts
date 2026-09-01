import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { materials } from '@server/lib/drizzle/schema';
import type { Material } from '@shared/types/cultivator';
import { and, asc, eq, sql } from 'drizzle-orm';
import { readSpiritFieldSeedSpec } from '@shared/engine/spirit-field/seedMaterial';

export type MaterialInventoryWrite = Pick<
  Material,
  'name' | 'type' | 'rank' | 'element' | 'description' | 'details' | 'quantity'
>;

export interface MaterialInventoryWriteResult {
  id: string;
  stacked: boolean;
}

function assertMaterialQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('材料数量必须为正整数');
  }
}

export async function addMaterialStackToInventory(
  cultivatorId: string,
  material: MaterialInventoryWrite,
  tx?: DbTransaction,
): Promise<MaterialInventoryWriteResult> {
  assertMaterialQuantity(material.quantity);

  const q = getExecutor(tx);
  const candidates = await q
    .select({ id: materials.id, type: materials.type, details: materials.details })
    .from(materials)
    .where(
      and(
        eq(materials.cultivatorId, cultivatorId),
        eq(materials.name, material.name),
        eq(materials.rank, material.rank),
        eq(materials.type, material.type),
      ),
    )
    .orderBy(asc(materials.createdAt), asc(materials.id));

  const incomingSeed = material.type === 'seed'
    ? readSpiritFieldSeedSpec(material.details)
    : null;
  const existing = candidates.find((candidate) => {
    if (material.type !== 'seed') return true;
    const candidateSeed = readSpiritFieldSeedSpec(candidate.details);
    return Boolean(
      incomingSeed &&
        candidateSeed &&
        incomingSeed.fingerprint === candidateSeed.fingerprint,
    );
  });

  if (existing) {
    await q
      .update(materials)
      .set({ quantity: sql`${materials.quantity} + ${material.quantity}` })
      .where(eq(materials.id, existing.id));
    return { id: existing.id, stacked: true };
  }

  const [inserted] = await q
    .insert(materials)
    .values({
      cultivatorId,
      name: material.name,
      type: material.type,
      rank: material.rank,
      element: material.element ?? null,
      description: material.description ?? null,
      details: material.details ?? {},
      quantity: material.quantity,
    })
    .returning({ id: materials.id });

  return { id: inserted.id, stacked: false };
}
