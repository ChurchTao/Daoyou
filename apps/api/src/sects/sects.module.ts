import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { PresenceModule } from '@server/presence/presence.module.js';
import { SectCombatController } from './sect-combat.controller.js';
import { SectCombatService } from './sect-combat.service.js';
import { sectOrganizationProvider } from './sect-organization.provider.js';
import { SectOrganizationService } from './sect-organization.service.js';
import { SectSocialController } from './sect-social.controller.js';
import { SectSocialService } from './sect-social.service.js';
import { SectsController } from './sects.controller.js';
import { SectsService } from './sects.service.js';

@Module({
  imports: [DatabaseModule, PresenceModule],
  controllers: [SectsController, SectCombatController, SectSocialController],
  providers: [
    sectOrganizationProvider,
    SectsService,
    SectCombatService,
    SectOrganizationService,
    SectSocialService,
  ],
})
export class SectsModule {}
