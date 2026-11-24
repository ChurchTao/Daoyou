import { ContestStartSchema } from '@daoyou/contracts/alchemy/contest';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import { AdminErrors } from '@server/admin/admin-errors.js';
import { Access } from '@server/auth/access.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import { AlchemyContestPreparation } from './application/AlchemyContestPreparation.js';

@Controller('api/admin/alchemy-contest')
@Access('admin')
@UseFilters(AdminErrors)
export class AlchemyContestAdminController {
  constructor(
    @Inject(AlchemyContestPreparation)
    private readonly preparation: AlchemyContestPreparation,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  status() {
    return this.preparation.adminStatus();
  }

  @Post('prepare')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  prepare(
    @JsonBody(new ZodPipe(ContestStartSchema)) command: { week: string },
  ) {
    return this.preparation.prepare(command.week);
  }
}
