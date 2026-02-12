import { getExecutor } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BroadcastRecipientSeed,
  EmailAudienceFilter,
  GameMailAudienceFilter,
  RecipientResolveResult,
} from '@/types/admin-broadcast';
import { RealmType } from '@/types/constants';
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
  const admin = createAdminClient();
  const recipients: BroadcastRecipientSeed[] = [];
  const perPage = 200;

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

  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Supabase listUsers failed: ${error.message}`);
    }

    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      if (!user.email || !user.email_confirmed_at) continue;

      const createdAt = user.created_at ? new Date(user.created_at) : null;
      if (from && createdAt && createdAt < from) continue;
      if (to && createdAt && createdAt > to) continue;

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
          registeredAt: user.created_at,
        },
      });
    }

    if (users.length < perPage) break;
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
