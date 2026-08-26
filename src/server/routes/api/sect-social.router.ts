import { getExecutor } from '@server/lib/drizzle/db';
import {
  getValidatedJson,
  getValidatedQuery,
  requireActiveCultivatorRef,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { checkAndAcquireSectChatCooldown } from '@server/lib/redis/worldChatLimiter';
import {
  createSectChatMessage,
  listSectChatMessages,
} from '@server/lib/repositories/sectChatRepository';
import {
  countSectMembersAboveLifetimeContribution,
  findSectContributionRankingMember,
  listTopSectContributionRanking,
} from '@server/lib/repositories/sectOrganizationRepository';
import { findMembership } from '@server/lib/repositories/sectRepository';
import {
  ChatMessageApplicationError,
  createCultivatorChatMessage,
} from '@server/lib/services/chatMessageApplication';
import { readResourceWithResolvedScope } from '@server/lib/services/ResourceReadService';
import {
  SectChatListQuerySchema,
  WorldChatCreateMessageSchema,
  type SectChatListQuery,
  type WorldChatCreateMessageRequest,
} from '@shared/contracts/world-chat';
import type {
  SectContributionRankingData,
  SectContributionRankingEntry,
} from '@shared/contracts/sect';
import type { SectDiscipleRank, SectOffice } from '@shared/engine/sect';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get(
  '/chat/messages',
  requireActiveCultivatorRef(),
  validateQuery(SectChatListQuerySchema),
  async (c) => {
    const ref = c.get('activeCultivatorRef');
    if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    const membership = await findMembership(ref.cultivatorId, getExecutor());
    if (!membership) {
      return c.json({ success: false, error: '尚未拜入宗门' }, 404);
    }
    const query = getValidatedQuery<SectChatListQuery>(c);
    const result = await listSectChatMessages({
      sectId: membership.sectId,
      page: query.page,
      pageSize: query.pageSize,
    });
    return c.json({
      success: true,
      data: result.messages,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        hasMore: result.hasMore,
      },
    });
  },
);

router.post(
  '/chat/messages',
  requireActiveCultivatorRef(),
  validateJson(WorldChatCreateMessageSchema),
  async (c) => {
    const user = c.get('user');
    const ref = c.get('activeCultivatorRef');
    if (!user || !ref) {
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    }
    const membership = await findMembership(ref.cultivatorId, getExecutor());
    if (!membership) {
      return c.json({ success: false, error: '尚未拜入宗门' }, 404);
    }
    try {
      const message = await createCultivatorChatMessage({
        request: getValidatedJson<WorldChatCreateMessageRequest>(c),
        userId: user.id,
        cultivatorId: ref.cultivatorId,
        channel: 'sect',
        sectId: membership.sectId,
        acquireCooldown: checkAndAcquireSectChatCooldown,
        persist: createSectChatMessage,
      });
      return c.json({ success: true, data: message });
    } catch (error) {
      if (error instanceof ChatMessageApplicationError) {
        return c.json(
          {
            success: false,
            error: error.message,
            ...(error.remainingSeconds
              ? { remainingSeconds: error.remainingSeconds }
              : {}),
          },
          error.status,
        );
      }
      console.error('[sect-chat] create message failed', error);
      return c.json({ success: false, error: '发送失败，请稍后重试' }, 500);
    }
  },
);

router.get(
  '/contribution-ranking',
  requireActiveCultivatorRef(),
  async (c) => {
    const ref = c.get('activeCultivatorRef');
    if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json(
        await readResourceWithResolvedScope(
          'sect.contribution-ranking',
          async (q) => {
            const membership = await findMembership(ref.cultivatorId, q);
            if (!membership) {
              throw new Error('SECT_MEMBERSHIP_REQUIRED');
            }
            const rows = await listTopSectContributionRanking(
              membership.sectId,
              q,
            );
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
              (entry) => entry.cultivatorId === ref.cultivatorId,
            );
            if (!currentMember) {
              const currentRow = await findSectContributionRankingMember(
                membership.sectId,
                ref.cultivatorId,
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
                discipleRank:
                  currentRow.discipleRank as SectDiscipleRank,
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
        ),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'SECT_MEMBERSHIP_REQUIRED'
      ) {
        return c.json({ success: false, error: '尚未拜入宗门' }, 404);
      }
      console.error('[sect-ranking] read failed', error);
      return c.json({ success: false, error: '贡献榜读取失败' }, 500);
    }
  },
);

export default router;
