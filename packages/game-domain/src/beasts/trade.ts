import { z } from 'zod';
import type { createBeastSchema } from './schema.js';


export function createBeastTradeSchemas(BeastSchema: ReturnType<typeof createBeastSchema>) {
const transferOwner = '00000000-0000-4000-8000-000000000000';
const {
  id: _id,
  ownerCultivatorId: _owner,
  ...individualShape
} = BeastSchema.shape;
void _id;
void _owner;
const BeastTransferSchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    individual: z.strictObject(individualShape),
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
const BeastTradePreviewSchema = z.strictObject({
  name: BeastSchema.shape.name,
  speciesId: BeastSchema.shape.speciesId,
  isMutant: BeastSchema.shape.isMutant,
  originKind: BeastSchema.shape.originKind,
  initialLevel: BeastSchema.shape.initialLevel,
  level: BeastSchema.shape.level,
  exp: BeastSchema.shape.exp,
  growth: BeastSchema.shape.growth,
  aptitudes: BeastSchema.shape.aptitudes,
  allocatedAttributes: BeastSchema.shape.allocatedAttributes,
  unallocatedPoints: BeastSchema.shape.unallocatedPoints,
  skillSlotCapacity: BeastSchema.shape.skillSlotCapacity,
  skills: BeastSchema.shape.skills,
  currentLifespan: BeastSchema.shape.currentLifespan,
  maxLifespan: BeastSchema.shape.maxLifespan,
});
return { BeastTransferSchema, BeastTradePreviewSchema };
}


export type BeastTransfer = z.infer<ReturnType<typeof createBeastTradeSchemas>['BeastTransferSchema']>;
