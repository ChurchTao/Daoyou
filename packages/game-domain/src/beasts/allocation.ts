import { z } from 'zod';

export function createBeastAllocationSchema(pointsPerLevel: number) {
return z
  .object({
    constitution: z
      .number()
      .int()
      .min(0)
      .max(50 + 180 * pointsPerLevel),
    strength: z
      .number()
      .int()
      .min(0)
      .max(50 + 180 * pointsPerLevel),
    magic: z
      .number()
      .int()
      .min(0)
      .max(50 + 180 * pointsPerLevel),
    endurance: z
      .number()
      .int()
      .min(0)
      .max(50 + 180 * pointsPerLevel),
    agility: z
      .number()
      .int()
      .min(0)
      .max(50 + 180 * pointsPerLevel),
  })
  .strict();
}
