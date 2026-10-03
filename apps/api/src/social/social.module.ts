import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';
import { WorldChatController } from './world-chat.controller.js';
import { WorldChatService } from './world-chat.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [WorldChatController, FriendsController],
  providers: [WorldChatService, FriendsService],
})
export class SocialModule {}
