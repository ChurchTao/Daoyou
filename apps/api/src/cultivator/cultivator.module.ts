import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
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
  imports: [DatabaseModule],
  controllers: [
    ProfileController,
    ConditionController,
    LifecycleController,
    CultivationController,
  ],
  providers: [
    CultivatorQueriesService,
    ProfileService,
    ConditionService,
    LifecycleService,
    RetreatService,
    YieldService,
  ],
  exports: [CultivatorQueriesService],
})
export class CultivatorModule {}
