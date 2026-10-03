import {
  Catch,
  HttpException,
  Inject,
  type ArgumentsHost,
  type ExceptionFilter,
  type Type,
} from '@nestjs/common';
import { AppConfigService } from '@server/config/app-config.service.js';
import type { Response as ExpressResponse } from 'express';
import { ApiExceptionFilter } from './api-exception.filter.js';

/** Preserve each API's existing error contract while keeping controllers transport-only. */
export function apiErrorFilter(
  mapError: (error: unknown, config: AppConfigService) => Response | undefined,
): Type<ExceptionFilter> {
  @Catch()
  class ContractExceptionFilter extends ApiExceptionFilter {
    constructor(
      @Inject(AppConfigService) private readonly config: AppConfigService,
    ) {
      super();
    }
    override async catch(error: unknown, host: ArgumentsHost): Promise<void> {
      // Guard failures and explicit HTTP outcomes already carry their public contract.
      if (
        error instanceof HttpException ||
        (error instanceof Error &&
          'type' in error &&
          error.type === 'entity.too.large')
      )
        return super.catch(error, host);
      const mapped = mapError(error, this.config);
      if (!mapped) return super.catch(error, host);
      const response = host.switchToHttp().getResponse<ExpressResponse>();
      if (response.headersSent) {
        response.end();
        return;
      }
      mapped.headers.forEach((value, name) => response.setHeader(name, value));
      response.status(mapped.status).send(await mapped.text());
    }
  }
  return ContractExceptionFilter;
}
