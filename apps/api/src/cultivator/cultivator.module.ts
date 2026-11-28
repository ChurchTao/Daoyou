import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { LlmModule } from '@server/llm/llm.module.js';
import { PlayerStateModule } from '@server/player/player-state.module.js';
import { AvatarController } from './avatar/avatar.controller.js';
import { AvatarRendererService } from './avatar/avatar-renderer.service.js';
import { AvatarStorageService } from './avatar/avatar-storage.service.js';
import { AvatarWorkerService } from './avatar/avatar-worker.service.js';
import { AvatarService } from './avatar/avatar.service.js';
import { CharacterCardController } from './character-card.controller.js';
import { CharacterCardService } from './character-card.service.js';
import { ConditionController } from './condition.controller.js';
import { ConditionService } from './condition.service.js';
import { CultivationController } from './cultivation.controller.js';
import { CultivatorQueriesService } from './cultivator-queries.service.js';
import { LifecycleController } from './lifecycle.controller.js';
import { LifecycleService } from './lifecycle.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { RetreatService } from './retreat.service.js';
import { YieldService } from './yield.service.js';

@Module({
  imports: [DatabaseModule, LlmModule, PlayerStateModule],
  controllers: [
    AvatarController,
    CharacterCardController,
    ProfileController,
    ConditionController,
    LifecycleController,
    CultivationController,
  ],
  providers: [
    AvatarService,
    AvatarStorageService,
    AvatarRendererService,
    AvatarWorkerService,
    CharacterCardService,
    CultivatorQueriesService,
    ProfileService,
    ConditionService,
    LifecycleService,
    RetreatService,
    YieldService,
  ],
  exports: [CharacterCardService, CultivatorQueriesService],
})
export class CultivatorModule {}
