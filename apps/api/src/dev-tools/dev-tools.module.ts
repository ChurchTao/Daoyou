import { allowsLocalDevTools } from '@daoyou/contracts/dev-tools-access';
import {
  Inject,
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { AppConfigService } from '@server/config/app-config.service.js';
import type { NextFunction, Request, Response } from 'express';
import { DevToolsController } from './dev-tools.controller.js';
import { DevToolsService } from './dev-tools.service.js';

@Module({ controllers: [DevToolsController], providers: [DevToolsService] })
export class DevToolsModule implements NestModule {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_request: Request, response: Response, next: NextFunction) => {
        if (
          !allowsLocalDevTools(
            this.config.get('APP_ENV'),
            this.config.get('NODE_ENV'),
          )
        ) {
          response.status(404).json({ success: false, error: '接口不存在' });
          return;
        }
        response.setHeader('Cache-Control', 'no-store');
        next();
      })
      .forRoutes({ path: 'api/dev{/*path}', method: RequestMethod.ALL });
  }
}
