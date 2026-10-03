import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AdminController } from './admin.controller.js';
import { AdminFeedbackService } from './feedback.service.js';
import { AdminItemLibraryController } from './item-library.controller.js';
import { AdminItemLibraryService } from './item-library.service.js';
import { MonitoringService } from './monitoring.service.js';
import { AdminRedeemCodesController } from './redeem-codes.controller.js';
import { AdminRedeemCodesService } from './redeem-codes.service.js';
import { AdminReputationShopController } from './reputation-shop.controller.js';
import { AdminReputationShopService } from './reputation-shop.service.js';
import { AdminRewardItemsController } from './reward-items.controller.js';
import { AdminRewardItemsService } from './reward-items.service.js';
import { AdminSectShopController } from './sect-shop.controller.js';
import { AdminSectShopService } from './sect-shop.service.js';
import { SettingsService } from './settings.service.js';
import { AdminSponsorshipController } from './sponsorship.controller.js';
import { AdminSponsorshipService } from './sponsorship.service.js';
import { AdminSystemMailsController } from './system-mails.controller.js';
import { AdminSystemMailsService } from './system-mails.service.js';
import { AdminTowerController } from './tower.controller.js';
import { AdminTowerService } from './tower.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    AdminSystemMailsController,
    AdminItemLibraryController,
    AdminRedeemCodesController,
    AdminSponsorshipController,
    AdminController,
    AccountsController,
    AdminReputationShopController,
    AdminSectShopController,
    AdminRewardItemsController,
    AdminTowerController,
  ],
  providers: [
    AdminSystemMailsService,
    AdminItemLibraryService,
    AdminRedeemCodesService,
    AdminSponsorshipService,
    AccountsService,
    SettingsService,
    MonitoringService,
    AdminFeedbackService,
    AdminReputationShopService,
    AdminSectShopService,
    AdminRewardItemsService,
    AdminTowerService,
  ],
})
export class AdminModule {}
