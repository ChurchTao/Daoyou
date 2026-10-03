import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service.js';
@Injectable()
export class InternalCronGuard implements CanActivate {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get('CRON_SECRET');
    if (!secret) {
      if (this.config.get('NODE_ENV') === 'production')
        throw new HttpException(
          { success: false, error: 'CRON_SECRET is required in production' },
          500,
        );
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (request.get('authorization') !== `Bearer ${secret}`)
      throw new HttpException({ success: false, error: 'Unauthorized' }, 401);
    return true;
  }
}
