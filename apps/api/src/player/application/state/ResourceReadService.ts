import type {
  ResourceDataMap,
  ResourceReadResponse,
  ResourceScope,
  ResourceTopic,
} from '@daoyou/shared/contracts/resources';
import { RESOURCE_DATA_SCHEMAS } from '@daoyou/shared/contracts/resources';
import {
  db,
  runDbTasks,
  type DbClient,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  readResourceVersions,
  readScopeVersion,
} from '@server/lib/repositories/playerStateRepository.js';
import { sql } from 'drizzle-orm';

export async function readResourceWithMeta<TTopic extends ResourceTopic>(
  scope: ResourceScope,
  topic: TTopic,
  read: (tx: DbTransaction) => Promise<ResourceDataMap[TTopic]>,
  database: DbClient = db,
): Promise<ResourceReadResponse<TTopic>> {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    const data = await read(tx);
    RESOURCE_DATA_SCHEMAS[topic].parse(data);
    const [scopeVersion, resourceVersions] = await runDbTasks(tx, [
      () => readScopeVersion(scope, tx),
      () => readResourceVersions(scope, [topic], tx),
    ]);
    return {
      success: true,
      data,
      resource: {
        scope,
        topic,
        resourceVersion: resourceVersions[topic] ?? 0,
        scopeVersion,
      },
    };
  });
}

export async function readResourceWithResolvedScope<
  TTopic extends ResourceTopic,
>(
  topic: TTopic,
  read: (tx: DbTransaction) => Promise<{
    scope: ResourceScope;
    data: ResourceDataMap[TTopic];
  }>,
  database: DbClient = db,
): Promise<ResourceReadResponse<TTopic>> {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    const { scope, data } = await read(tx);
    RESOURCE_DATA_SCHEMAS[topic].parse(data);
    const [scopeVersion, resourceVersions] = await runDbTasks(tx, [
      () => readScopeVersion(scope, tx),
      () => readResourceVersions(scope, [topic], tx),
    ]);
    return {
      success: true,
      data,
      resource: {
        scope,
        topic,
        resourceVersion: resourceVersions[topic] ?? 0,
        scopeVersion,
      },
    };
  });
}
