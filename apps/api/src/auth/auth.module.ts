import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessGuard } from './access.guard.js';
import { CaptchaController } from './captcha.controller.js';
import { CaptchaService } from './captcha.service.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [CaptchaController],
  providers: [
    CaptchaService,
    SessionService,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
