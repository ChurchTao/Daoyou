import { Module } from '@nestjs/common';
import { FateReshapeController } from './fate-reshape.controller.js';
import { FateReshapeService } from './fate-reshape.service.js';
import { IdentityReshapeController } from './identity-reshape.controller.js';
import { IdentityReshapeService } from './identity-reshape.service.js';
@Module({
  controllers: [FateReshapeController, IdentityReshapeController],
  providers: [FateReshapeService, IdentityReshapeService],
})
export class ReshapeModule {}
