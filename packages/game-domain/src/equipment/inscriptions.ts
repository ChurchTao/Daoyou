import { z } from 'zod';

const inscription = z
  .strictObject({
    patternId: z.string().min(1),
    level: z.number().int().positive(),
  })
  .nullable();

export const FormationInscriptionsSchema = z.tuple([inscription, inscription]);
