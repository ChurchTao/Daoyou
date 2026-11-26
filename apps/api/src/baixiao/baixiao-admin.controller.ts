import {
  BaixiaoAdminListQuerySchema,
  BaixiaoImportSchema,
  BaixiaoQuestionStatusSchema,
  type BaixiaoAdminListQuery,
} from '@daoyou/contracts/baixiao/meet';
import type { BaixiaoQuestionData } from '@daoyou/game-domain/baixiao/meet';
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
import { FirstQuery } from '@server/http/first-query.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import { BaixiaoQuestionBank } from './application/BaixiaoQuestionBank.js';

@Controller('api/admin/baixiao-meet')
@Access('admin')
@UseFilters(AdminErrors)
export class BaixiaoAdminController {
  constructor(
    @Inject(BaixiaoQuestionBank) private readonly bank: BaixiaoQuestionBank,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  status() {
    return this.bank.status();
  }

  @Get('questions')
  @Header('Cache-Control', 'no-store')
  list(
    @FirstQuery(new ZodPipe(BaixiaoAdminListQuerySchema))
    query: BaixiaoAdminListQuery,
  ) {
    return this.bank.list(query);
  }

  @Get('practice')
  @Header('Cache-Control', 'no-store')
  practice() {
    return this.bank.practice();
  }

  @Post('import')
  @HttpCode(200)
  importQuestions(
    @JsonBody({ fallback: undefined }, new ZodPipe(BaixiaoImportSchema))
    command: {
      questions: BaixiaoQuestionData[];
    },
  ) {
    return this.bank.importQuestions(command.questions);
  }

  @Post('status')
  @HttpCode(200)
  async setStatus(
    @JsonBody({ fallback: undefined }, new ZodPipe(BaixiaoQuestionStatusSchema))
    command: {
      ids: string[];
      status: 'published' | 'retired';
    },
  ) {
    await this.bank.setStatus(command.ids, command.status);
    return { ok: true };
  }
}
