import { REALM_VALUES } from '@daoyou/constants/realms';
import { z } from 'zod';

const ActivityKind = z.enum(['invasion', 'alchemy-contest', 'baixiao']);
const Timestamp = z.int().positive();

const ActivityRumor = z.discriminatedUnion('phase', [
  z.strictObject({
    kind: ActivityKind,
    phase: z.enum(['waiting', 'open']),
    time: Timestamp,
  }),
  z.strictObject({
    kind: ActivityKind,
    phase: z.enum(['unavailable', 'unknown']),
  }),
]);

export const HomeRumorsSchema = z.strictObject({
  activities: z.array(ActivityRumor),
  wandererLocation: z.string(),
  hunts: z.array(
    z.strictObject({
      realm: z.enum(REALM_VALUES),
      label: z.string(),
      locationName: z.string(),
      href: z.string().startsWith('/game/map-v2?'),
    }),
  ),
  nextRefreshAt: Timestamp,
});

export type HomeRumors = z.infer<typeof HomeRumorsSchema>;
export type HomeActivityRumor = z.infer<typeof ActivityRumor>;
export type HomeRumorsResponse = Omit<HomeRumors, 'hunts'> & {
  hunt: HomeRumors['hunts'][number] | null;
  serverNow: number;
};
