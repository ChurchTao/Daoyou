import { Controller, Get, Header, Inject, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FirstQuery } from '../http/first-query.js';
import { Access } from './access.js';
import { CaptchaService } from './captcha.service.js';

@Controller('api/captcha')
@Access('public')
export class CaptchaController {
  constructor(
    @Inject(CaptchaService) private readonly captcha: CaptchaService,
  ) {}

  @Get('config')
  @Header('Cache-Control', 'no-store')
  config() {
    return this.captcha.config();
  }

  @Get('challenge')
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  challenge(@FirstQuery('action') action: string = '') {
    return this.captcha.challenge(action);
  }
}
