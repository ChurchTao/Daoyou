import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import { Access, CurrentUser } from '@server/auth/access.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import { z } from 'zod';
import { TransferService } from './transfer.service.js';

const TrustInput = z.strictObject({ serverId: z.string().min(1).max(160), signingPublicKey: z.string().min(1).max(4096) });
const EnabledInput = z.strictObject({ enabled: z.boolean() });
const RejectInput = z.strictObject({ note: z.string().max(1000).default('') });

@Controller('api/admin/transfers')
@Access('admin')
export class TransferAdminController {
  constructor(@Inject(TransferService) private readonly service: TransferService) {}

  @Get()
  list() { return this.service.reviewList(); }

  @Get('identity')
  identity() { return this.service.localIdentity(); }

  @Get('trusted-servers')
  trusted() { return this.service.trustedServers(); }

  @Post('trusted-servers')
  @HttpCode(200)
  trust(@CurrentUser() user: AuthUser, @JsonBody(new ZodPipe(TrustInput)) input: z.infer<typeof TrustInput>) {
    return this.service.trustServer(user.id, input.serverId, input.signingPublicKey);
  }

  @Post('trusted-servers/:id/enabled')
  @HttpCode(200)
  enabled(@Param('id') id: string, @JsonBody(new ZodPipe(EnabledInput)) input: z.infer<typeof EnabledInput>) {
    return this.service.setTrustEnabled(id, input.enabled);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.approve(user.id, id); }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @JsonBody(new ZodPipe(RejectInput)) input: z.infer<typeof RejectInput>) {
    return this.service.reject(user.id, id, input.note);
  }
}
