import type {
  SectContributionRankingData,
  SectContributionRankingEntry,
} from '@daoyou/shared/contracts/sect';
import type {
  SectChatListQuery,
  WorldChatCreateMessageRequest,
} from '@daoyou/shared/contracts/world-chat';
import type { SectDiscipleRank, SectOffice } from '@daoyou/shared/engine/sect';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { checkAndAcquireSectChatCooldown } from '@server/lib/redis/worldChatLimiter.js';
import { listSectChatMessages } from '@server/lib/repositories/sectChatRepository.js';
import {
  countSectMembersAboveLifetimeContribution,
  findSectContributionRankingMember,
  listTopSectContributionRanking,
} from '@server/lib/repositories/sectOrganizationRepository.js';
import { findMembership } from '@server/lib/repositories/sectRepository.js';
import { readResourceWithResolvedScope } from '@server/player/application/state/ResourceReadService.js';
import { createAndPublishSectChatMessage } from '@server/social/application/chatDelivery.js';
import {
  ChatMessageApplicationError,
  createCultivatorChatMessage,
} from '@server/social/application/chatMessageApplication.js';

@Injectable()
export class SectSocialService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(actor: ActiveCultivatorRef, query: SectChatListQuery) {
    const membership = await this.membership(actor);
    const result = await listSectChatMessages({
      sectId: membership.sectId,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      success: true,
      data: result.messages,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        hasMore: result.hasMore,
      },
    };
  }

  async create(
    actor: ActiveCultivatorRef,
    request: WorldChatCreateMessageRequest,
  ) {
    // Membership lookup failures retain the global error contract, as before.
    const membership = await this.membership(actor);
    try {
      const message = await createCultivatorChatMessage({
        request,
        database: this.database,
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        channel: 'sect',
        sectId: membership.sectId,
        acquireCooldown: checkAndAcquireSectChatCooldown,
        persist: createAndPublishSectChatMessage,
      });
      return { success: true, data: message };
    } catch (error) {
      if (error instanceof ChatMessageApplicationError)
        throw new HttpException(
          {
            success: false,
            error: error.message,
            ...(error.remainingSeconds
              ? { remainingSeconds: error.remainingSeconds }
              : {}),
          },
          error.status,
        );
      console.error('[sect-chat] create message failed', error);
      throw new HttpException(
        { success: false, error: '发送失败，请稍后重试' },
        500,
      );
    }
  }

  private async membership(actor: ActiveCultivatorRef) {
    const membership = await findMembership(actor.cultivatorId, this.database);
    if (!membership)
      throw new HttpException({ success: false, error: '尚未拜入宗门' }, 404);
    return membership;
  }

  contributionRanking(actor: ActiveCultivatorRef) {
    return readResourceWithResolvedScope(
      'sect.contribution-ranking',
      async (q) => {
        const membership = await findMembership(actor.cultivatorId, q);
        if (!membership) {
          throw new Error('SECT_MEMBERSHIP_REQUIRED');
        }
        const rows = await listTopSectContributionRanking(membership.sectId, q);
        let previousContribution: number | undefined;
        let rank = 0;
        const entries = rows.map((row, index): SectContributionRankingEntry => {
          if (row.lifetimeContribution !== previousContribution) {
            rank = index + 1;
            previousContribution = row.lifetimeContribution;
          }
          return {
            rank,
            cultivatorId: row.cultivatorId,
            name: row.name,
            discipleRank: row.discipleRank as SectDiscipleRank,
            office: row.office as SectOffice,
            contribution: row.lifetimeContribution,
          };
        });
        let currentMember = entries.find(
          (entry) => entry.cultivatorId === actor.cultivatorId,
        );
        if (!currentMember) {
          const currentRow = await findSectContributionRankingMember(
            membership.sectId,
            actor.cultivatorId,
            q,
          );
          if (!currentRow) {
            throw new Error('SECT_MEMBERSHIP_REQUIRED');
          }
          currentMember = {
            rank:
              (await countSectMembersAboveLifetimeContribution(
                membership.sectId,
                currentRow.lifetimeContribution,
                q,
              )) + 1,
            cultivatorId: currentRow.cultivatorId,
            name: currentRow.name,
            discipleRank: currentRow.discipleRank as SectDiscipleRank,
            office: currentRow.office as SectOffice,
            contribution: currentRow.lifetimeContribution,
          };
        }
        return {
          scope: { kind: 'sect', id: membership.sectId },
          data: {
            metric: 'lifetime_contribution',
            generatedAt: new Date().toISOString(),
            entries: entries.slice(0, 20),
            currentMember,
          } satisfies SectContributionRankingData,
        };
      },
      this.database,
    );
  }
}
