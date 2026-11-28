import { z } from 'zod';
import { readLegacyBeastLifespan, type createBeastSchema } from './schema.js';

export function createBeastTradeSchemas(
  BeastSchema: ReturnType<typeof createBeastSchema>,
) {
  const transferOwner = '00000000-0000-4000-8000-000000000000';
  const shape = BeastSchema.out.shape;
  const { id: _id, ownerCultivatorId: _owner, ...individualShape } = shape;
  void _id;
  void _owner;
  const BeastTransferSchema = z
    .strictObject({
      id: z.uuid(),
      createdAt: z.iso.datetime(),
      individual: readLegacyBeastLifespan(z.strictObject(individualShape)),
    })
    .superRefine((value, ctx) => {
      const parsed = BeastSchema.safeParse({
        ...value.individual,
        id: value.id,
        ownerCultivatorId: transferOwner,
      });
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          ctx.addIssue({ code: 'custom', message: issue.message });
      if (value.individual.revision >= 100000)
        ctx.addIssue({ code: 'custom', message: '灵兽版本已达上限' });
    });
  const BeastTradePreviewSchema = readLegacyBeastLifespan(
    z.strictObject({
      name: shape.name,
      speciesId: shape.speciesId,
      isMutant: shape.isMutant,
      originKind: shape.originKind,
      initialLevel: shape.initialLevel,
      level: shape.level,
      exp: shape.exp,
      growth: shape.growth,
      aptitudes: shape.aptitudes,
      allocatedAttributes: shape.allocatedAttributes,
      unallocatedPoints: shape.unallocatedPoints,
      skillSlotCapacity: shape.skillSlotCapacity,
      skills: shape.skills,
      currentLifespan: shape.currentLifespan,
    }),
  );
  return { BeastTransferSchema, BeastTradePreviewSchema };
}

export type BeastTransfer = z.infer<
  ReturnType<typeof createBeastTradeSchemas>['BeastTransferSchema']
>;
