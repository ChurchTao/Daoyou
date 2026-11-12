import { describe, expect, it } from 'vitest';
import {
  SpiritFieldBranchBatchRequestSchema,
  SpiritFieldBranchRequestSchema,
  SpiritFieldEvolveRequestSchema,
  SpiritFieldHarvestRequestSchema,
  SpiritFieldMatureBatchRequestSchema,
  SpiritFieldRestoreRequestSchema,
  SpiritFieldSowRequestSchema,
  SpiritFieldStarterRequestSchema,
  SpiritFieldUprootRequestSchema,
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

  it('requires the complete unknown-plant target and forbids client-selected compensation', () => {
    const request = { ...command, plotIndex: 0, plantId: 'field-1:unknown:0' };
    expect(SpiritFieldUprootRequestSchema.parse(request)).toEqual(request);
    for (const input of [
      command,
      { ...request, plotIndex: 6 },
      { ...request, plantId: '' },
      { ...request, expectedVersion: -1 },
      { ...request, quality: '神品' },
      { ...request, quantity: 100 },
      { ...request, speciesId: 'licorice' },
    ])
      expect(SpiritFieldUprootRequestSchema.safeParse(input).success).toBe(
        false,
      );
  });

  it('requires explicit, unique batch targets without client-supplied costs', () => {
    const targets = [
      { plotIndex: 0, plantId: 'plant-1' },
      { plotIndex: 1, plantId: 'plant-2' },
    ];
    for (const [schema, branch] of [
      [SpiritFieldMatureBatchRequestSchema, {}],
      [SpiritFieldBranchBatchRequestSchema, { branch: 'essence' }],
    ] as const) {
      const request = { ...command, ...branch, targets };
      expect(schema.parse(request)).toEqual(request);
      for (const invalidTargets of [
        [],
        [targets[0], { plotIndex: 0, plantId: 'plant-2' }],
        [targets[0], { plotIndex: 1, plantId: 'plant-1' }],
        [{ plotIndex: 6, plantId: 'plant-1' }],
        [{ plotIndex: 0, plantId: '' }],
        Array.from({ length: 7 }, (_, index) => ({
          plotIndex: index,
          plantId: `plant-${index}`,
        })),
        [{ plotIndex: 0, plantId: 'plant-1', qi: 0 }],
      ]) {
        expect(
          schema.safeParse({ ...request, targets: invalidTargets }).success,
        ).toBe(false);
      }
      expect(schema.safeParse({ ...request, qi: 0 }).success).toBe(false);
      expect(
        schema.safeParse({ ...request, expectedVersion: -1 }).success,
      ).toBe(false);
    }
    expect(
      SpiritFieldBranchBatchRequestSchema.safeParse({ ...command, targets })
        .success,
    ).toBe(false);
  });
});
