import type {
  AdminOnlineCharactersQuery,
  AdminOnlineCharactersResponse,
  AdminOnlineTrendRange,
  AdminOnlineTrendResponse,
  AdminOnlineUsersResponse,
} from '@daoyou/contracts/admin/online-users';
import { productionSectRuntime } from '@daoyou/game-rules/sect-organization/production';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators, sectMemberships } from '@server/lib/drizzle/schema.js';
import { PresenceHistoryService } from '@server/presence/presence-history.service.js';
import { PresenceService } from '@server/presence/presence.service.js';
import { and, asc, eq, ilike, sql } from 'drizzle-orm';

const PAGE_SIZE = 25;

@Injectable()
export class MonitoringService {
  constructor(
    @Inject(PresenceService) private readonly presence: PresenceService,
    @Inject(PresenceHistoryService)
    private readonly history: PresenceHistoryService,
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
  ) {}

  async onlineUsers(): Promise<AdminOnlineUsersResponse> {
    return { success: true, data: await this.presence.getSnapshot() };
  }

  async onlineTrend(
    range: AdminOnlineTrendRange,
  ): Promise<AdminOnlineTrendResponse> {
    try {
      return {
        success: true,
        data: await this.history.getTrend(range === '1h' ? 60 : 24 * 60),
      };
    } catch (error) {
      console.warn('[presence] failed to read online trend', { error });
      throw new ServiceUnavailableException({
        success: false,
        error: '暂时无法读取在线趋势',
      });
    }
  }

  async onlineCharacters({
    search,
    page,
  }: AdminOnlineCharactersQuery): Promise<AdminOnlineCharactersResponse> {
    const { source, generatedAt, cultivatorIds } =
      await this.presence.getOnlineCultivatorsSnapshot();
    if (page > Math.ceil(cultivatorIds.size / PAGE_SIZE)) {
      return {
        success: true,
        data: { source, generatedAt, items: [], hasNext: false },
      };
    }

    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const rows = await this.database
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        sectId: sectMemberships.sectId,
      })
      .from(cultivators)
      .leftJoin(
        sectMemberships,
        and(
          eq(sectMemberships.cultivatorId, cultivators.id),
          eq(sectMemberships.status, 'active'),
        ),
      )
      .where(
        and(
          eq(cultivators.status, 'active'),
          sql`${cultivators.id} = any(${sql.param([...cultivatorIds])}::uuid[])`,
          search ? ilike(cultivators.name, pattern) : undefined,
        ),
      )
      .orderBy(asc(cultivators.name), asc(cultivators.id))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE);

    return {
      success: true,
      data: {
        source,
        generatedAt,
        items: rows.slice(0, PAGE_SIZE).map(({ sectId, ...character }) => ({
          ...character,
          sectName: sectId
            ? (productionSectRuntime.registry.get(sectId)?.definition.name ??
              sectId)
            : null,
        })),
        hasNext: rows.length > PAGE_SIZE,
      },
    };
  }
}
