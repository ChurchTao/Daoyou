import { describe, expect, it } from 'vitest';
import {
  SpiritFieldBranchRequestSchema,
  SpiritFieldEvolveRequestSchema,
  SpiritFieldHarvestRequestSchema,
  SpiritFieldRestoreRequestSchema,
  SpiritFieldSowRequestSchema,
  SpiritFieldStarterRequestSchema,
} from './spiritField.js';

const command = { requestId: 'garden:request-1', expectedVersion: 4 };
const itemId = '24ad00d4-5459-46da-8994-1451570924fb';

describe('long-lived spirit field commands', () => {
  it('accepts the complete sow and evolution payloads, retaining revision guards', () => {
    expect(
      SpiritFieldSowRequestSchema.parse({
        ...command,
        plotIndex: 5,
        seedMaterialId: itemId,
        revision: 2,
      }).revision,
    ).toBe(2);
    const evolve = {
      ...command,
      plotIndex: 0,
      plantId: 'plant-1',
      resourceId: itemId,
      resourceRevision: 3,
    };
    expect(SpiritFieldEvolveRequestSchema.parse(evolve)).toEqual(evolve);
    const { resourceRevision: _revision, ...withoutRevision } = evolve;
    expect(
      SpiritFieldEvolveRequestSchema.safeParse(withoutRevision).success,
    ).toBe(false);
  });

  it('requires a nonnegative garden version and rejects client-owned rewards', () => {
    for (const schema of [
      SpiritFieldHarvestRequestSchema,
      SpiritFieldStarterRequestSchema,
    ]) {
      expect(schema.safeParse(command).success).toBe(true);
      expect(schema.safeParse({ requestId: command.requestId }).success).toBe(
        false,
      );
      expect(
        schema.safeParse({ ...command, expectedVersion: -1 }).success,
      ).toBe(false);
      expect(schema.safeParse({ ...command, quantity: 100 }).success).toBe(
        false,
      );
      expect(schema.safeParse({ ...command, plotIndex: 0 }).success).toBe(
        false,
      );
    }
  });

  it('bounds target plots and cultivation branches', () => {
    const plant = { ...command, plotIndex: 0, plantId: 'plant-1' };
    expect(
      SpiritFieldBranchRequestSchema.safeParse({ ...plant, branch: 'essence' })
        .success,
    ).toBe(true);
    expect(
      SpiritFieldBranchRequestSchema.safeParse({
        ...plant,
        branch: 'instant_god',
      }).success,
    ).toBe(false);
    expect(
      SpiritFieldRestoreRequestSchema.safeParse({ ...plant, plotIndex: 6 })
        .success,
    ).toBe(false);
    expect(
      SpiritFieldRestoreRequestSchema.safeParse({ ...plant, plantId: '' })
        .success,
    ).toBe(false);
  });
});
