import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import { Controller, Get, Header, Inject, UseFilters } from '@nestjs/common';
import { Access } from '@server/auth/access.js';
import { apiErrorFilter } from '@server/http/error-filter.js';
import { FirstQuery } from '@server/http/first-query.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import { z, ZodError } from 'zod';
import { HomeRumorsService } from './application/HomeRumorsService.js';

@Controller('api/player/home-rumors')
@Access('active')
@UseFilters(
  apiErrorFilter((error) =>
    error instanceof ZodError
      ? Response.json(
          { success: false, error: '境界参数无效' },
          { status: 400 },
        )
      : undefined,
  ),
)
export class HomeRumorsController {
  constructor(
    @Inject(HomeRumorsService) private readonly rumors: HomeRumorsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  read(
    @FirstQuery('realm', new ZodPipe(z.enum(REALM_VALUES).optional()))
    realm?: RealmType,
  ) {
    return this.rumors.read(realm);
  }
}
