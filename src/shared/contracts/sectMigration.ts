import { z } from 'zod';

export const LegacySectMemberSchema = z.object({
  membershipId: z.uuid(),
  cultivatorId: z.uuid(),
  sectId: z.string().min(1),
  activePathId: z.string().nullable(),
  methods: z
    .array(z.object({ methodId: z.string(), level: z.number().int() }))
    .max(100),
  paths: z
    .array(
      z.object({
        pathId: z.string(),
        unlockedLayerIds: z.array(z.string()).max(20),
      }),
    )
    .max(20),
  // Audit only; legacy nodes never become V6 selections.
  meridianLoadouts: z.array(
    z.object({
      pathId: z.string(),
      slot: z.number().int(),
      nodeIds: z.array(z.string()),
    }),
  ),
});
export type LegacySectMember = z.infer<typeof LegacySectMemberSchema>;
export type SectMigrationRefund = {
  cultivationExp: number;
  spiritStones: number;
  comprehensionInsight: number;
};
export type SectMigrationPlan = {
  methods: { methodId: string; level: number }[];
  meridianDepth: number;
  activePathId: string | null;
  pathIds: string[];
  refund: SectMigrationRefund;
};
export type SectMigrationRow = {
  membershipId: string;
  cultivatorId: string;
  name: string;
  sectId: string;
  status: 'ready' | 'completed' | 'blocked';
  error?: string;
  plan?: SectMigrationPlan;
};
export type SectMigrationReport = {
  enabled: boolean;
  phase: 'legacy' | 'v6' | 'unknown';
  stagedAt: string | null;
  issues: string[];
  rows: SectMigrationRow[];
  totals: SectMigrationRefund;
  complete: boolean;
};
export const SectMigrationBatchSchema = z.object({
  maintenanceConfirmed: z.literal(true),
  membershipIds: z.array(z.uuid()).min(1).max(20),
});
