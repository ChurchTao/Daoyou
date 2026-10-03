import { Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import {
  AccountSetPasswordRequestSchema,
  type AccountSetPasswordRequest,
  type AccountSetPasswordResponse,
} from '@daoyou/shared/contracts/account';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { SessionService } from '../auth/session.service.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';

@Controller('api/account')
export class AccountController {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Post('password')
  @HttpCode(200)
  async setPassword(
    @Req() request: Request,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(AccountSetPasswordRequestSchema),
    )
    body: AccountSetPasswordRequest,
  ): Promise<AccountSetPasswordResponse> {
    const result = await this.sessions.setPassword(
      fromNodeHeaders(request.headers),
      body.newPassword,
    );
    return { success: true, data: { status: result.status } };
  }
}
