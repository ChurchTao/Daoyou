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
import { AdminItemLibraryService } from './item-library.service.js';

@Controller('api/admin/item-library')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminItemLibraryController {
  constructor(
    @Inject(AdminItemLibraryService)
    private readonly service: AdminItemLibraryService,
  ) {}
  @Get()
  list(@FirstQuery() query: Record<string, string | undefined>) {
    return this.service.list(query);
  }
  @Post('materials/generate')
  @HttpCode(200)
  generateMaterials(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.generateMaterials(user.id, body);
  }
  @Post('seeds/generate')
  @HttpCode(200)
  generateSeeds(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.generateSeeds(user.id, body);
  }
  @Get('materials/daily-generation-settings')
  settings() {
    return this.service.settings();
  }
  @Put('materials/daily-generation-settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.updateSettings(user.id, body);
  }
  @Post()
  @HttpCode(200)
  create(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.create(user.id, body);
  }
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.update(user.id, id, body);
  }
  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.archive(user.id, id);
  }
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }
}
