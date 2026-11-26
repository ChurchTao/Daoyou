import { Module } from '@nestjs/common';
import { normalizeIp, seconds, ThrottlerModule } from '@nestjs/throttler';
import { getRequestIp } from '@server/lib/http/requestIp.js';
import { redisThrottlerStorage } from '@server/lib/redis/throttler-storage.js';
import { fromNodeHeaders } from 'better-auth/node';
import type { Response } from 'express';
import { isIP } from 'node:net';
import type { GameRequest } from './request.js';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 60, ttl: seconds(60), blockDuration: 0 }],
      storage: redisThrottlerStorage,
      getTracker: (req) => {
        const request = req as GameRequest;
        const userId = request.gameContext.user?.id;
        if (userId) return `user:${userId}`;

        const forwardedIp = getRequestIp(fromNodeHeaders(request.headers));
        const ip =
          forwardedIp && isIP(forwardedIp)
            ? forwardedIp
            : request.socket.remoteAddress;
        return `ip:${ip ? normalizeIp(ip) : 'unknown'}`;
      },
      errorMessage: (context, detail) => {
        context
          .switchToHttp()
          .getResponse<Response>()
          .setHeader('Cache-Control', 'no-store');
        console.info('[route-rate-limit] blocked', {
          controller: context.getClass().name,
          handler: context.getHandler().name,
          limit: detail.limit,
          retryAfterSeconds: detail.timeToBlockExpire,
        });
        return '请求过于频繁，请稍后再试';
      },
    }),
  ],
})
export class RateLimitModule {}
