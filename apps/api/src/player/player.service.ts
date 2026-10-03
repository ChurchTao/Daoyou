import type {
  PlayerResourceEventsResponse,
  PlayerResourcesResponse,
} from '@daoyou/shared/contracts/player';
import {
  requiresResourceEventReload,
  type ResourceScope,
} from '@daoyou/shared/contracts/resources';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators, sectMemberships } from '@server/lib/drizzle/schema.js';
import { listPlayerJournal } from '@server/lib/repositories/playerJournalRepository.js';
import {
  readResourceEventWindow,
  RESOURCE_EVENT_PAGE_LIMIT,
} from '@server/lib/repositories/playerStateRepository.js';
import {
  parsePlayerResourceKeys,
  readPlayerResourcesSnapshot,
} from '@server/player/application/PlayerResourceReaderService.js';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class PlayerService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async journal(
    cultivatorId: string,
    query: Parameters<typeof listPlayerJournal>[1],
  ) {
    return {
      success: true,
      data: await listPlayerJournal(cultivatorId, query),
    };
  }

  async resources(
    userId: string,
    rawKeys: string,
  ): Promise<PlayerResourcesResponse> {
    let keys;
    try {
      keys = parsePlayerResourceKeys(rawKeys);
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error instanceof Error ? error.message : '玩家资源 keys 无效',
        },
        400,
      );
    }
    return {
      success: true,
      data: await readPlayerResourcesSnapshot({ userId, keys }),
    };
  }

  async events(
    userId: string,
    scope: ResourceScope,
    after: number,
  ): Promise<PlayerResourceEventsResponse> {
    const active = await this.database.query.cultivators.findFirst({
      columns: { id: true },
      where: and(
        eq(cultivators.userId, userId),
        eq(cultivators.status, 'active'),
      ),
    });
    if (
      !(await this.canReadScope(
        { userId, cultivatorId: active?.id ?? null },
        scope,
      ))
    ) {
      throw new HttpException(
        { success: false, error: '无权读取该资源作用域' },
        403,
      );
    }
    const window = await readResourceEventWindow(scope, after);
    return {
      success: true,
      data: {
        after,
        scope,
        currentScopeVersion: window.currentScopeVersion,
        earliestAvailableVersion: window.earliestAvailableVersion,
        changes: window.changes.slice(0, RESOURCE_EVENT_PAGE_LIMIT),
        requiresReload:
          window.hasIncompatibleEvents ||
          requiresResourceEventReload(window, after, RESOURCE_EVENT_PAGE_LIMIT),
      },
    };
  }

  private async canReadScope(
    ref: { userId: string; cultivatorId: string | null },
    scope: ResourceScope,
  ): Promise<boolean> {
    if (scope.kind === 'account') return scope.id === ref.userId;
    if (scope.kind === 'cultivator')
      return Boolean(ref.cultivatorId && scope.id === ref.cultivatorId);
    if (scope.kind === 'global') return scope.id === 'global';
    if (!ref.cultivatorId) return false;
    const membership = await this.database.query.sectMemberships.findFirst({
      columns: { id: true },
      where: and(
        eq(sectMemberships.cultivatorId, ref.cultivatorId),
        eq(sectMemberships.sectId, scope.id),
        eq(sectMemberships.status, 'active'),
      ),
    });
    return Boolean(membership);
  }
}
