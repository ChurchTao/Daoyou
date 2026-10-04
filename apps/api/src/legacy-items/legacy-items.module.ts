import {
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import type { NextFunction, Request, Response } from 'express';
import { LegacyInventoryController } from './inventory.controller.js';
import { LegacyInventoryService } from './inventory.service.js';
import {
  ArtifactMigrationController,
  ManualMigrationController,
} from './migration.controller.js';
import { MigrationService } from './migration.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    LegacyInventoryController,
    ArtifactMigrationController,
    ManualMigrationController,
  ],
  providers: [MigrationService, LegacyInventoryService],
})
export class LegacyItemsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply before access guards, including denied and unknown migration requests.
    consumer
      .apply((_request: Request, response: Response, next: NextFunction) => {
        response.setHeader('Cache-Control', 'no-store');
        next();
      })
      .forRoutes(
        { path: 'api/artifact-migration{/*path}', method: RequestMethod.ALL },
        { path: 'api/manual-migration{/*path}', method: RequestMethod.ALL },
      );
  }
}
