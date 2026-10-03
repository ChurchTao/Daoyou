import {
  Controller,
  Get,
  Inject,
  Param,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { ProductsService } from './products.service.js';

const ProductsErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  console.error('旧产物请求失败:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});

@Controller('api/v2/products')
@Access('active')
@UseFilters(ProductsErrors)
export class ProductsController {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}

  @Get()
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery() query: Record<string, string | undefined>,
  ) {
    return this.products.list(actor, query);
  }


  @Get(':id')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id') id: string,
  ) {
    return this.products.read(actor, id);
  }

}
