import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import type { z } from 'zod';
import { Access, CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AdminErrors } from './admin-errors.js';
import {
  CreateSchema,
  ListSchema,
  RevisionSchema,
  UpdateSchema,
} from './system-mails-input.js';
import { AdminSystemMailsService } from './system-mails.service.js';
@Controller('api/admin/system-mails')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminSystemMailsController {
  constructor(
    @Inject(AdminSystemMailsService)
    private readonly service: AdminSystemMailsService,
  ) {}
  @Get()
  list(
    @FirstQuery(new ZodPipe(ListSchema, 'legacy-unhandled'))
    query: z.infer<typeof ListSchema>,
  ) {
    return this.service.list(query);
  }
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }
  @Post()
  @HttpCode(200)
  create(
    @CurrentUser() user: AuthUser,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(CreateSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof CreateSchema>,
  ) {
    return this.service.create(user.id, input);
  }
  @Put(':id')
  update(
    @Param('id') id: string,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(UpdateSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof UpdateSchema>,
  ) {
    return this.service.update(id, input);
  }
  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Param('id') id: string,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(RevisionSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof RevisionSchema>,
  ) {
    return this.service.publish(id, input);
  }
  @Post(':id/stop')
  @HttpCode(200)
  stop(
    @Param('id') id: string,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(RevisionSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof RevisionSchema>,
  ) {
    return this.service.stop(id, input);
  }
}
