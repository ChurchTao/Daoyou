import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RealtimeController],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
