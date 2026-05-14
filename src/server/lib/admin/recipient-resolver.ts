import { authUsers } from '@server/lib/auth/schema';
import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import {
  BroadcastRecipientSeed,
  EmailAudienceFilter,
  GameMailAudienceFilter,
  RecipientResolveResult,
} from '@shared/types/admin-broadcast';
import { RealmType } from '@shared/types/constants';
import { and, eq, gte, lte } from 'drizzle-orm';
import { isRealmInRange, toRealmType } from './realm';

function toStartOfDay(dateString?: string): Date | null {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toEndOfDay(dateString?: string): Date | null {
  if (!dateString) return null;
  const date = new Date(`${dateString}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildResolveResult(
  recipients: BroadcastRecipientSeed[],
): RecipientResolveResult {
  return {
    totalCount: recipients.length,
    recipients,
    sampleRecipients: recipients.slice(0, 20),
  };
}

export async function resolveEmailRecipients(
  filters: EmailAudienceFilter = {},
): Promise<RecipientResolveResult> {
  const recipients: BroadcastRecipientSeed[] = [];

  const from = toStartOfDay(filters.registeredFrom);
  const to = toEndOfDay(filters.registeredTo);

  const needCultivatorFilter =
    filters.hasActiveCultivator !== undefined ||
    !!filters.realmMin ||
    !!filters.realmMax;

  const activeCultivatorMap = new Map<string, { realm: RealmType }>();
  if (needCultivatorFilter) {
    const activeCultivators = await getExecutor()
      .select({
        userId: cultivators.userId,
        realm: cultivators.realm,
      })
      .from(cultivators)
      .where(eq(cultivators.status, 'active'));

    for (const item of activeCultivators) {
      const realm = toRealmType(item.realm);
      if (!realm) continue;
      activeCultivatorMap.set(item.userId, { realm });
    }
  }

  const authUserConditions = [eq(authUsers.emailVerified, true)];
  if (from) {
    authUserConditions.push(gte(authUsers.createdAt, from));
  }
  if (to) {
    authUserConditions.push(lte(authUsers.createdAt, to));
  }

  const users = await getExecutor()
    .select({
      id: authUsers.id,
      email: authUsers.email,
      createdAt: authUsers.createdAt,
    })
    .from(authUsers)
    .where(and(...authUserConditions));

  for (const user of users) {
    if (needCultivatorFilter) {
      const activeCultivator = activeCultivatorMap.get(user.id);

      if (filters.hasActiveCultivator === true && !activeCultivator) continue;
      if (filters.hasActiveCultivator === false && activeCultivator) continue;

      if (filters.realmMin || filters.realmMax) {
        if (!activeCultivator) continue;
        if (
          !isRealmInRange(
            activeCultivator.realm,
            filters.realmMin,
            filters.realmMax,
          )
        ) {
          continue;
        }
      }
    }

    recipients.push({
      recipientType: 'email',
      recipientKey: user.email.toLowerCase(),
      metadata: {
        userId: user.id,
        registeredAt: user.createdAt?.toISOString(),
      },
    });
  }

  return buildResolveResult(recipients);
}

export async function resolveGameMailRecipients(
  filters: GameMailAudienceFilter = {},
): Promise<RecipientResolveResult> {
  const createdFrom = toStartOfDay(filters.cultivatorCreatedFrom);
  const createdTo = toEndOfDay(filters.cultivatorCreatedTo);

  const whereConditions = [eq(cultivators.status, 'active')];
  if (createdFrom) {
    whereConditions.push(gte(cultivators.createdAt, createdFrom));
  }
  if (createdTo) {
    whereConditions.push(lte(cultivators.createdAt, createdTo));
  }

  const rows = await getExecutor()
    .select({
      id: cultivators.id,
      realm: cultivators.realm,
      createdAt: cultivators.createdAt,
    })
    .from(cultivators)
    .where(and(...whereConditions));

  const recipients: BroadcastRecipientSeed[] = [];
  for (const row of rows) {
    const realm = toRealmType(row.realm);
    if (!realm) continue;

    if (!isRealmInRange(realm, filters.realmMin, filters.realmMax)) {
      continue;
    }

    recipients.push({
      recipientType: 'cultivator',
      recipientKey: row.id,
      metadata: {
        realm,
        createdAt: row.createdAt?.toISOString(),
      },
    });
  }

  return buildResolveResult(recipients);
}
