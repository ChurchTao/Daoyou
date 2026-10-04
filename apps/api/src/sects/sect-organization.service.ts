import type {
  SectDonationRequestSchema,
  SectTaskActionRequestSchema,
  SectTransferPreviewQuerySchema,
  SectTransferRequestSchema,
} from '@daoyou/contracts/sect';
import { SectShopBuyParamsSchema } from '@daoyou/contracts/shops/sect';
import { productionSectRuntime as runtime } from '@daoyou/game-rules/sect-organization/production';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { findMembership } from '@server/lib/repositories/sectRepository.js';
import type { CommittedCommand } from '@server/player/application/state/CommandExecutors.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import {
  readResourceWithMeta,
  readResourceWithResolvedScope,
} from '@server/player/application/state/ResourceReadService.js';
import { SectError } from '@server/sects/application/SectError.js';
import {
  createPostgresSectConstructionQueryContext,
  createPostgresSectEconomyContext,
  createPostgresSectMembershipQueryContext,
  createPostgresSectQueryContext,
} from '@server/sects/organization/PostgresSectOrganizationAdapters.js';
import { executeSectConstructionDonationCommand } from '@server/sects/organization/SectConstructionCommand.js';
import {
  executeSectShopPurchaseCommand,
  executeSectStipendClaimCommand,
} from '@server/sects/organization/SectEconomyCommand.js';
import {
  executeSectJoinCommand,
  executeSectPromotionCommand,
} from '@server/sects/organization/SectMembershipCommand.js';
import { executeSectTaskActionCommand } from '@server/sects/organization/SectTaskCommand.js';
import { previewSectTransfer } from '@server/sects/organization/SectTransferApplicationService.js';
import { executeSectTransferCommand } from '@server/sects/organization/SectTransferCommand.js';
import type { SectCommandArgs } from '@server/sects/organization/commandSupport.js';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import {
  requireSectIdempotency,
  type SectCommandRequest,
} from './sect-idempotency.js';
import {
  SECT_ORGANIZATION,
  type SectOrganization,
} from './sect-organization.provider.js';

@Injectable()
export class SectOrganizationService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(SECT_ORGANIZATION) private readonly organization: SectOrganization,
  ) {}

  infrastructure(actor: ActiveCultivatorRef) {
    return readResourceWithResolvedScope(
      'sect.infrastructure',
      async (q) => {
        const membership = await findMembership(actor.cultivatorId, q);
        if (!membership)
          throw new SectError('SECT_MEMBERSHIP_REQUIRED', '尚未拜入宗门', 404);
        return {
          scope: { kind: 'sect', id: membership.sectId },
          data: await this.organization.membership.getInfrastructureResource(
            actor.cultivatorId,
            createPostgresSectMembershipQueryContext({ q, runtime }),
          ),
        };
      },
      this.database,
    );
  }

  async stipend(actor: ActiveCultivatorRef) {
    const q = this.database;
    const cultivator = await q.query.cultivators.findFirst({
      columns: { id: true, realm: true },
      where: eq(cultivators.id, actor.cultivatorId),
    });
    if (!cultivator)
      throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在', 404);
    const data = await this.organization.membership.getStipendResource(
      { id: cultivator.id, realm: cultivator.realm as RealmType },
      createPostgresSectMembershipQueryContext({ q, runtime }),
    );
    return { success: true, data };
  }

  async promotionEvaluation(actor: ActiveCultivatorRef) {
    const q = this.database;
    const cultivator = await q.query.cultivators.findFirst({
      columns: { id: true, realm: true, realm_stage: true },
      where: eq(cultivators.id, actor.cultivatorId),
    });
    if (!cultivator)
      throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在', 404);
    const data =
      await this.organization.membership.getPromotionEvaluationResource(
        {
          id: cultivator.id,
          realm: cultivator.realm as RealmType,
          realm_stage: cultivator.realm_stage as RealmStage,
        },
        createPostgresSectMembershipQueryContext({ q, runtime }),
      );
    return { success: true, data };
  }

  tasks(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'sect.tasks',
      (q) =>
        this.organization.tasks.queries.execute(
          { cultivatorId: actor.cultivatorId },
          createPostgresSectQueryContext({ q, runtime }),
        ),
      this.database,
    );
  }

  async submissionCandidates(actor: ActiveCultivatorRef, taskId: string) {
    if (!taskId || taskId.length > 64)
      throw new HttpException({ success: false, error: '任务编号无效' }, 400);
    return {
      success: true,
      data: await this.organization.tasks.submissions.execute(
        { cultivatorId: actor.cultivatorId, taskId },
        createPostgresSectQueryContext({ q: this.database, runtime }),
      ),
    };
  }

  shop(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'sect.shop',
      (q) =>
        this.organization.economy.getShop(
          actor.cultivatorId,
          createPostgresSectEconomyContext({ q, runtime }),
        ),
      this.database,
    );
  }

  constructionMember(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'sect.construction-member',
      (q) =>
        this.organization.construction.getConstructionMember(
          actor.userId,
          actor.cultivatorId,
          createPostgresSectConstructionQueryContext({ q, runtime }),
        ),
      this.database,
    );
  }

  members(
    actor: ActiveCultivatorRef,
    query: { page: number; pageSize: number },
  ) {
    return readResourceWithResolvedScope(
      'sect.members',
      async (q) => {
        const membership = await findMembership(actor.cultivatorId, q);
        if (!membership)
          throw new SectError('SECT_MEMBERSHIP_REQUIRED', '尚未拜入宗门', 404);
        return {
          scope: { kind: 'sect', id: membership.sectId },
          data: await this.organization.membership.listMembers(
            actor.cultivatorId,
            query.page,
            query.pageSize,
            createPostgresSectMembershipQueryContext({ q, runtime }),
          ),
        };
      },
      this.database,
    );
  }

  async transferPreview(
    actor: ActiveCultivatorRef,
    query: z.infer<typeof SectTransferPreviewQuerySchema>,
  ) {
    return {
      success: true,
      data: await previewSectTransfer({
        cultivatorId: actor.cultivatorId,
        ...query,
        runtime,
        q: this.database,
      }),
    };
  }

  taskAction(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    taskId: string,
    actionKey: string,
    body: z.infer<typeof SectTaskActionRequestSchema>,
  ) {
    if (taskId.length > 64 || actionKey.length > 64)
      throw new HttpException(
        { success: false, error: '任务操作编号无效' },
        400,
      );
    return this.mutate(
      actor,
      request,
      'sect_task_action',
      { taskId, actionKey, input: body.input },
      (args) =>
        executeSectTaskActionCommand({
          ...args,
          taskId,
          actionKey,
          requestId: request.key ?? '',
          input: body.input,
        }),
    );
  }

  promote(actor: ActiveCultivatorRef, request: SectCommandRequest) {
    return this.mutate(
      actor,
      request,
      'sect_promotion',
      null,
      executeSectPromotionCommand,
    );
  }

  buy(actor: ActiveCultivatorRef, request: SectCommandRequest, id: string) {
    const parsed = SectShopBuyParamsSchema.safeParse({ id });
    if (!parsed.success)
      throw new HttpException({ success: false, error: '商品编号无效' }, 400);
    return this.mutate(
      actor,
      request,
      'sect_shop_purchase',
      parsed.data,
      (args) =>
        executeSectShopPurchaseCommand({ ...args, itemId: parsed.data.id }),
    );
  }

  donate(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    body: z.infer<typeof SectDonationRequestSchema>,
  ) {
    return this.mutate(
      actor,
      request,
      'sect_construction_donate',
      body,
      (args) => executeSectConstructionDonationCommand({ ...args, ...body }),
    );
  }

  claimStipend(actor: ActiveCultivatorRef, request: SectCommandRequest) {
    return this.mutate(
      actor,
      request,
      'sect_stipend_claim',
      null,
      executeSectStipendClaimCommand,
    );
  }

  transfer(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    body: z.infer<typeof SectTransferRequestSchema>,
  ) {
    return this.mutate(actor, request, 'sect_transfer', body, (args) =>
      executeSectTransferCommand({ ...args, ...body }),
    );
  }

  join(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    sectId: string,
  ) {
    return this.mutate(actor, request, 'sect_join', { sectId }, (args) =>
      executeSectJoinCommand({
        ...args,
        sectId,
        admission: (q) => this.organization.admission(q, runtime),
      }),
    );
  }

  private async mutate<T>(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    source: string,
    payload: unknown,
    run: (args: SectCommandArgs) => Promise<CommittedCommand<T>>,
  ) {
    const committed = await run({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source,
      idempotency: requireSectIdempotency(request, source, payload),
      runtime,
    });
    return toPlayerStateMutationResponse(committed);
  }
}
