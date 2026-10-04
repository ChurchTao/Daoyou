import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  SectDonationRequestSchema,
  SectMembersQuerySchema,
  SectTaskActionRequestSchema,
  SectTransferPreviewQuerySchema,
  SectTransferRequestSchema,
} from '@daoyou/contracts/sect';
import type { Request } from 'express';
import type { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { SectErrors } from './sect-errors.js';
import type { SectCommandRequest } from './sect-idempotency.js';
import { SectOrganizationService } from './sect-organization.service.js';
import { SectsService } from './sects.service.js';

function commandRequest(request: Request): SectCommandRequest {
  return {
    key: request.get('Idempotency-Key'),
    method: request.method,
    path: request.path,
  };
}

@Controller('api/sects')
@Access('active')
@UseFilters(SectErrors)
export class SectsController {
  constructor(
    @Inject(SectsService) private readonly sects: SectsService,
    @Inject(SectOrganizationService)
    private readonly organization: SectOrganizationService,
  ) {}

  @Get('current/context')
  context(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.sects.context(actor.cultivatorId);
  }

  @Get('current/infrastructure')
  infrastructure(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.organization.infrastructure(actor);
  }

  @Get('current/stipend')
  stipend(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.organization.stipend(actor);
  }

  @Get('current/promotion-evaluation')
  promotionEvaluation(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.organization.promotionEvaluation(actor);
  }

  @Get('current/tasks')
  tasks(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.organization.tasks(actor);
  }

  @Get('current/tasks/:taskId/submission-candidates')
  submissionCandidates(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('taskId') taskId: string,
  ) {
    return this.organization.submissionCandidates(actor, taskId);
  }

  @Get('current/shop')
  shop(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.organization.shop(actor);
  }

  @Get('current/construction-member')
  constructionMember(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.organization.constructionMember(actor);
  }

  @Get('current/members')
  members(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(SectMembersQuerySchema, 'legacy-unhandled'))
    query: z.infer<typeof SectMembersQuerySchema>,
  ) {
    return this.organization.members(actor, query);
  }

  @Post('current/tasks/:taskId/actions/:actionKey')
  @HttpCode(200)
  taskAction(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
    @Param('taskId') taskId: string,
    @Param('actionKey') actionKey: string,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(SectTaskActionRequestSchema, 'legacy-unhandled'),
    )
    body: z.infer<typeof SectTaskActionRequestSchema>,
  ) {
    return this.organization.taskAction(
      actor,
      commandRequest(request),
      taskId,
      actionKey,
      body,
    );
  }

  @Post('current/promotion')
  @HttpCode(200)
  promote(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
  ) {
    return this.organization.promote(actor, commandRequest(request));
  }

  @Post('current/shop/:id/buy')
  @HttpCode(200)
  buy(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    return this.organization.buy(actor, commandRequest(request), id);
  }

  @Post('current/construction/donate')
  @HttpCode(200)
  donate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(SectDonationRequestSchema, 'legacy-unhandled'),
    )
    body: z.infer<typeof SectDonationRequestSchema>,
  ) {
    return this.organization.donate(actor, commandRequest(request), body);
  }

  @Post('current/stipend/claim')
  @HttpCode(200)
  claimStipend(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
  ) {
    return this.organization.claimStipend(actor, commandRequest(request));
  }

  @Get('current/transfer/preview')
  transferPreview(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(SectTransferPreviewQuerySchema, 'legacy-unhandled'))
    query: z.infer<typeof SectTransferPreviewQuerySchema>,
  ) {
    return this.organization.transferPreview(actor, query);
  }

  @Post('current/transfer')
  @HttpCode(200)
  transfer(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(SectTransferRequestSchema, 'legacy-unhandled'),
    )
    body: z.infer<typeof SectTransferRequestSchema>,
  ) {
    return this.organization.transfer(actor, commandRequest(request), body);
  }

  @Post(':sectId/join')
  @HttpCode(200)
  join(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
    @Param('sectId') sectId: string,
  ) {
    return this.organization.join(actor, commandRequest(request), sectId);
  }

}
