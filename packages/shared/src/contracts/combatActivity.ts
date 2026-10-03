import { z } from 'zod';

export const CombatActivityNoticeSchema = z
  .object({
    kind: z.enum([
      'tower',
      'dungeon',
      'ranking',
      'sect-task',
      'breakthrough',
      'wild',
      'training',
      'arena',
    ]),
    title: z.string().min(1),
    action: z.enum(['回到战斗', '前往结算']),
    href: z.string().min(1),
  })
  .strict();

export type CombatActivityNotice = z.infer<typeof CombatActivityNoticeSchema>;
