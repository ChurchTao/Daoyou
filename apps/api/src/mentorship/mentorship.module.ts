import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MentorshipController } from './mentorship.controller.js';
import { MentorshipService } from './mentorship.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MentorshipController],
  providers: [MentorshipService],
  exports: [MentorshipService],
})
export class MentorshipModule {}
