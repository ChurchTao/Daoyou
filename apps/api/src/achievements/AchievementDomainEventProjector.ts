import { REALM_VALUES } from '@daoyou/constants/realms';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@daoyou/contracts/events';
import type { DomainEventType } from '@daoyou/game-domain/events';
import { authUsers } from '@server/lib/auth/schema.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import {
  accountDeletionRecords,
  achievementMetrics,
  cultivators,
  socialAccounts,
} from '@server/lib/drizzle/schema.js';
import type { FeatureCommandResult } from '@server/player/application/state/CommandExecutors.js';
import { enqueueSocialNotification } from '@server/social/social-notifications.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  recordAchievementMaximum,
  syncAchievements,
} from './achievement-ledger.js';

const eventTypes = new Set<DomainEventType>([
  'alchemy.craft.completed',
  'equipment.forged',
  'yield.collection.completed',
  'dungeon.run.settled',
  'cultivator.realm.changed',
  'cultivator.growth.observed',
  'spirit-field.harvest.completed',
  'mentorship.bound',
  'mentorship.disciple.graduated',
]);

export function isAchievementEvent(event: DomainEventEnvelope): boolean {
  return eventTypes.has(event.type);
}

function characterIds(event: DomainEventEnvelope): string[] {
  if (
    isDomainEventType(event, 'mentorship.bound') ||
    isDomainEventType(event, 'mentorship.disciple.graduated')
  ) {
    return [
      ...new Set([
        event.data.mentorCultivatorId,
        event.data.discipleCultivatorId,
      ]),
    ].sort();
  }
  if (
    isDomainEventType(event, 'alchemy.craft.completed') ||
    isDomainEventType(event, 'equipment.forged') ||
    isDomainEventType(event, 'yield.collection.completed') ||
    isDomainEventType(event, 'dungeon.run.settled') ||
    isDomainEventType(event, 'cultivator.realm.changed') ||
    isDomainEventType(event, 'cultivator.growth.observed') ||
    isDomainEventType(event, 'spirit-field.harvest.completed')
  )
    return [event.data.cultivatorId];
  return [];
}

/** Follow the social account -> character lock order without recreating deleted identities. */
async function lockExistingOwners(tx: DbTransaction, ids: string[]) {
  if (!ids.length) return [];
  const initial = await tx
    .select({ id: cultivators.id, userId: cultivators.userId })
    .from(cultivators)
    .where(inArray(cultivators.id, ids));
  const owners = [...new Set(initial.map((row) => row.userId))].sort();
  if (!owners.length) return [];
  await tx
    .select({ userId: socialAccounts.userId })
    .from(socialAccounts)
    .where(inArray(socialAccounts.userId, owners))
    .orderBy(socialAccounts.userId)
    .for('update');
  const users = await tx
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(inArray(authUsers.id, owners))
    .orderBy(authUsers.id)
    .for('key share');
  const deleted = await tx
    .select({ userId: accountDeletionRecords.userId })
    .from(accountDeletionRecords)
    .where(
      and(
        inArray(accountDeletionRecords.userId, owners),
        eq(accountDeletionRecords.status, 'completed'),
      ),
    );
  const available = new Set(
    users
      .map((row) => row.id)
      .filter((id) => !deleted.some((row) => row.userId === id)),
  );
  const current = await tx
    .select({ id: cultivators.id, userId: cultivators.userId })
    .from(cultivators)
    .where(inArray(cultivators.id, ids))
    .orderBy(cultivators.id)
    .for('no key update');
  return current.filter(
    (row) =>
      available.has(row.userId) &&
      initial.some(
        (before) => before.id === row.id && before.userId === row.userId,
      ),
  );
}

async function increment(
  tx: DbTransaction,
  cultivatorId: string,
  metric: string,
): Promise<boolean> {
  const rows = await tx
    .insert(achievementMetrics)
    .values({ cultivatorId, metric, value: 1 })
    .onConflictDoUpdate({
      target: [achievementMetrics.cultivatorId, achievementMetrics.metric],
      set: {
        value: sql`least(${achievementMetrics.value}::bigint + 1, 2147483647)::int`,
        updatedAt: new Date(),
      },
      setWhere: sql`${achievementMetrics.value} < 2147483647`,
    })
    .returning({ metric: achievementMetrics.metric });
  return rows.length > 0;
}

function counterMetric(event: DomainEventEnvelope): string | null {
  if (isDomainEventType(event, 'alchemy.craft.completed'))
    return 'alchemy.crafts';
  if (isDomainEventType(event, 'equipment.forged')) return 'forging.equipment';
  if (isDomainEventType(event, 'yield.collection.completed'))
    return 'exploration.claims';
  if (
    isDomainEventType(event, 'dungeon.run.settled') &&
    event.data.outcome === 'completed'
  )
    return 'dungeon.completions';
  return null;
}

/** The durable consumer receipt, metric changes, grants and notification share this transaction. */
export async function projectAchievementDomainEvent(
  event: DomainEventEnvelope,
  tx: DbTransaction,
): Promise<
  FeatureCommandResult<{ status: 'applied' | 'ignored'; unlocked: number }>
> {
  const owners = await lockExistingOwners(tx, characterIds(event));
  let totalUnlocked = 0;
  let changed = false;
  for (const owner of owners) {
    let metricChanged = false;
    const counter = counterMetric(event);
    if (counter) metricChanged = await increment(tx, owner.id, counter);
    if (isDomainEventType(event, 'cultivator.growth.observed')) {
      const metrics = {
        manuals: 'manuals.max_level',
        sect_methods: 'sect_methods.max_level',
        body: 'body.max_track_level',
        beasts: 'beasts.max_level',
        beast_fusions: 'beasts.fusions',
      } as const;
      metricChanged = await recordAchievementMaximum(
        tx,
        owner.id,
        metrics[event.data.discipline],
        event.data.value,
      );
    }
    if (isDomainEventType(event, 'cultivator.realm.changed')) {
      metricChanged = await recordAchievementMaximum(
        tx,
        owner.id,
        'cultivation.realm_rank',
        Math.max(0, REALM_VALUES.indexOf(event.data.toRealm)),
      );
    }
    const result = await syncAchievements(tx, owner.id);
    totalUnlocked += result.unlockedIds.length;
    if (
      metricChanged ||
      result.progressChanged ||
      result.unlockedIds.length > 0
    ) {
      changed = true;
      await enqueueSocialNotification(tx, owner.userId, {
        cultivatorId: owner.id,
        kind: 'achievements',
      });
    }
  }
  return {
    result: {
      status: changed ? 'applied' : 'ignored',
      unlocked: totalUnlocked,
    },
    resourceChanges: [],
  };
}
