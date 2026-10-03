import { HttpException, Injectable, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: ZodType<T>,
    // Middleware validation runs outside route-local domain error handling.
    private readonly errorContract?: 'legacy-unhandled',
  ) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (
        this.errorContract === 'legacy-unhandled' &&
        error instanceof ZodError
      ) {
        // Hono's app.onError intercepts these before jsonError can map them to 400.
        throw new HttpException(
          { success: false, error: '服务器内部错误' },
          500,
        );
      }
      throw error;
    }
  }
}
