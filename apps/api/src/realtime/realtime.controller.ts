import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { Access } from '../auth/access.js';
import { RealtimeService } from './realtime.service.js';

@Injectable()
class RealtimeHttpGuard implements CanActivate {
  constructor(
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const result = await this.realtime.reserveConnection(
      fromNodeHeaders(request.headers),
    );
    try {
      result.headers?.forEach((value, name) => {
        if (name.toLowerCase() !== 'set-cookie')
          response.setHeader(name, value);
      });
      for (const cookie of result.headers?.getSetCookie() ?? [])
        response.append('Set-Cookie', cookie);
      if ('status' in result)
        throw new HttpException(
          { success: false, error: result.message },
          result.status,
        );
      return true;
    } finally {
      // A plain HTTP request never owns a live WebSocket reservation.
      if ('reservation' in result) result.reservation.release();
    }
  }
}

@Controller('api/realtime')
// This guard preserves the realtime route's origin-before-session order.
@Access('public')
@UseGuards(RealtimeHttpGuard)
export class RealtimeController {
  @Get()
  @HttpCode(404)
  withoutUpgrade() {
    return { success: false, error: '接口不存在' };
  }
}
