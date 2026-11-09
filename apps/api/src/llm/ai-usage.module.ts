import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { HttpContextModule } from '@server/http/http-context.module.js';
import { AiUsageService } from './ai-usage.service.js';

@Module({
  imports: [DatabaseModule, HttpContextModule],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}
