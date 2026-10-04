import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import {
  AdminAccountBanRequestSchema,
  AdminAccountChangeEmailRequestSchema,
  AdminAccountListQuerySchema,
  type AdminAccountBanRequest,
  type AdminAccountChangeEmailRequest,
  type AdminAccountListQuery,
} from '@daoyou/contracts/admin/accounts';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { Access, CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AccountsService } from './accounts.service.js';
import { AdminErrors } from './admin-errors.js';

function authHeaders(response: Response) {
  return (headers: Headers) => {
    headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') response.setHeader(key, value);
    });
    for (const cookie of headers.getSetCookie())
      response.append('Set-Cookie', cookie);
  };
}

@Controller('api/admin/accounts')
@Access('account-admin')
@UseFilters(AdminErrors)
export class AccountsController {
  constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
  ) {}

  @Get()
  list(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @FirstQuery(new ZodPipe(AdminAccountListQuerySchema, 'legacy-unhandled'))
    query: AdminAccountListQuery,
  ) {
    return this.accounts.list(
      fromNodeHeaders(request.headers),
      query,
      authHeaders(response),
    );
  }

  @Post(':userId/change-email')
  @HttpCode(200)
  changeEmail(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() actor: AuthUser,
    @Param('userId') userId: string,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(AdminAccountChangeEmailRequestSchema, 'legacy-unhandled'),
    )
    input: AdminAccountChangeEmailRequest,
  ) {
    return this.accounts.changeEmail(
      fromNodeHeaders(request.headers),
      actor,
      userId,
      input,
      authHeaders(response),
    );
  }

  @Post(':userId/ban')
  @HttpCode(200)
  ban(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() actor: AuthUser,
    @Param('userId') userId: string,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(AdminAccountBanRequestSchema, 'legacy-unhandled'),
    )
    input: AdminAccountBanRequest,
  ) {
    return this.accounts.ban(
      fromNodeHeaders(request.headers),
      actor,
      userId,
      input,
      authHeaders(response),
    );
  }

  @Post(':userId/unban')
  @HttpCode(200)
  unban(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() actor: AuthUser,
    @Param('userId') userId: string,
  ) {
    return this.accounts.unban(
      fromNodeHeaders(request.headers),
      actor,
      userId,
      authHeaders(response),
    );
  }

  @Post(':userId/revoke-sessions')
  @HttpCode(200)
  revokeSessions(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() actor: AuthUser,
    @Param('userId') userId: string,
  ) {
    return this.accounts.revokeSessions(
      fromNodeHeaders(request.headers),
      actor,
      userId,
      authHeaders(response),
    );
  }
}
