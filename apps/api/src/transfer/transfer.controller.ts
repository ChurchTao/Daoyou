import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import type { ActiveCultivatorRef, AuthUser } from '@server/lib/auth/types.js';
import { Access, CurrentCultivator, CurrentUser } from '@server/auth/access.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import { z } from 'zod';
import { TransferService } from './transfer.service.js';

const ChallengeInput = z.strictObject({ challenge: z.string().min(1).max(15_000) });
const PackageInput = z.strictObject({ package: z.string().min(1).max(500_000) });
const ReceiptInput = z.strictObject({ receipt: z.string().min(1).max(4096) });

@Controller('api/transfer')
@Access('user')
export class TransferController {
  constructor(@Inject(TransferService) private readonly service: TransferService) {}

  @Post('requests')
  @HttpCode(200)
  issue(@CurrentUser() user: AuthUser) { return this.service.issue(user.id); }

  @Get('requests')
  requests(@CurrentUser() user: AuthUser) { return this.service.ownRequests(user.id); }

  @Post('requests/:id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @JsonBody(new ZodPipe(PackageInput)) input: z.infer<typeof PackageInput>) {
    return this.service.submit(user.id, id, input.package);
  }

  @Post('requests/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.cancel(user.id, id);
  }

  @Post('exports')
  @HttpCode(200)
  @Access('active')
  export(@CurrentCultivator() actor: ActiveCultivatorRef, @JsonBody(new ZodPipe(ChallengeInput)) input: z.infer<typeof ChallengeInput>) {
    return this.service.export(actor.userId, actor.cultivatorId, input.challenge);
  }

  @Get('exports')
  exports(@CurrentUser() user: AuthUser) { return this.service.ownExport(user.id); }

  @Post('exports/:id/receipt')
  @HttpCode(200)
  receipt(@CurrentUser() user: AuthUser, @Param('id') id: string, @JsonBody(new ZodPipe(ReceiptInput)) input: z.infer<typeof ReceiptInput>) {
    return this.service.resolveExport(user.id, id, input.receipt);
  }
}
