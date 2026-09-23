import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import {
  BroadcastRecipientSeed,
  GameMailAudienceFilter,
  RecipientResolveResult,
} from '@shared/types/admin-broadcast';
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

export class RecipientResolveError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'RecipientResolveError';
  }
}

export async function resolveGameMailRecipients(
  filters: GameMailAudienceFilter = {},
): Promise<RecipientResolveResult> {
  if (filters.targetCultivatorId) {
    const row = await getExecutor()
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
        createdAt: cultivators.createdAt,
      })
      .from(cultivators)
      .where(
        and(
          eq(cultivators.id, filters.targetCultivatorId),
          eq(cultivators.status, 'active'),
        ),
      )
      .then((rows) => rows[0]);

    if (!row) {
      throw new RecipientResolveError('目标角色不存在或未处于活跃状态', 404);
    }

    const realm = toRealmType(row.realm);
    if (!realm) {
      throw new RecipientResolveError('目标角色境界数据异常', 400);
    }

    return buildResolveResult([
      {
        recipientType: 'cultivator',
        recipientKey: row.id,
        metadata: {
          cultivatorId: row.id,
          cultivatorName: row.name,
          realm,
          createdAt: row.createdAt?.toISOString(),
        },
      },
    ]);
  }

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
      name: cultivators.name,
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
        cultivatorId: row.id,
        cultivatorName: row.name,
        realm,
        createdAt: row.createdAt?.toISOString(),
      },
    });
  }

  return buildResolveResult(recipients);
}
