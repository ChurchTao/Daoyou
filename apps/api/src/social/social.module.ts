import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DirectMessagesController } from './direct-messages.controller.js';
import { DirectMessagesService } from './direct-messages.service.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';
import { RedPacketController } from './red-packet.controller.js';
import { SocialController } from './social.controller.js';
import { SocialService } from './social.service.js';
import { WorldChatController } from './world-chat.controller.js';
import { WorldChatService } from './world-chat.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    WorldChatController,
    FriendsController,
    RedPacketController,
    SocialController,
    DirectMessagesController,
  ],
  providers: [
    WorldChatService,
    FriendsService,
    SocialService,
    DirectMessagesService,
  ],
})
export class SocialModule {}
