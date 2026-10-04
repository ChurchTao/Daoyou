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
import { Access, CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { AdminErrors } from './admin-errors.js';
import { AdminSectShopService } from './sect-shop.service.js';

@Controller('api/admin/sect-shop')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminSectShopController {
  constructor(
    @Inject(AdminSectShopService) private readonly shop: AdminSectShopService,
  ) {}

  @Get()
  list(@FirstQuery() query: Record<string, string | undefined>) {
    return this.shop.list(query.status);
  }

  @Post()
  @HttpCode(200)
  create(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.shop.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.shop.update(user.id, id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shop.archive(user.id, id);
  }
}
