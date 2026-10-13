import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';
import { RedPacketController } from './red-packet.controller.js';
import { WorldChatController } from './world-chat.controller.js';
import { WorldChatService } from './world-chat.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [WorldChatController, FriendsController, RedPacketController],
  providers: [WorldChatService, FriendsService],
})
export class SocialModule {}
