import { z } from 'zod';

export const CombatV6TerminalReasonSchema = z.enum([
  'battle-ended',
  'fled',
  'player-abandoned',
  'expired',
  'membership-changed',
  'technical-abort',
]);

export type CombatV6TerminalReason = z.infer<
  typeof CombatV6TerminalReasonSchema
>;

export const VersionStampSchema = z
  .object({
    autoPolicyVersion: z.string().min(1).optional(),
    engineVersion: z.string().min(1),
    rulesetVersion: z.string().min(1),
    contentVersion: z.string().min(1),
    projectionVersion: z.string().min(1),
  })
  .strict();
