import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { runWithContext } from '@server/lib/http/context.js';
import type { Response } from 'express';
import { Observable, finalize, of } from 'rxjs';
import type { GameRequest } from './request.js';
import { RequestWorkService } from './request-work.service.js';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(
    @Inject(RequestWorkService) private readonly work: RequestWorkService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<GameRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    if (response.destroyed) return of(undefined);
    return new Observable((subscriber) =>
      runWithContext(request.gameContext, () => {
        const done = this.work.begin();
        return next.handle().pipe(finalize(done)).subscribe(subscriber);
      }),
    );
  }
}
