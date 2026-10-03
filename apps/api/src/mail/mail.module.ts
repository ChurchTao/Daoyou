import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { MailController } from './mail.controller.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [MailController],
  providers: [MailService],
})
export class MailModule {}
