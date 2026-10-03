import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import { ConfigurationModule } from './config/configuration.module.js';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { allowsLocalDevTools } from '@daoyou/shared/config/deployment';
import { AccountModule } from './account/account.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AlchemyModule } from './alchemy/alchemy.module.js';
import { ArenaModule } from './arena/arena.module.js';
import { AuctionModule } from './auction/auction.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BeastsModule } from './beasts/beasts.module.js';
import { BlackMarketModule } from './black-market/black-market.module.js';
import { CombatModule } from './combat/combat.module.js';
import { CommunityModule } from './community/community.module.js';
import { CultivatorModule } from './cultivator/cultivator.module.js';
import { DevToolsModule } from './dev-tools/dev-tools.module.js';
import { DivinationModule } from './divination/divination.module.js';
import { DungeonModule } from './dungeon/dungeon.module.js';
import { EnemiesModule } from './enemies/enemies.module.js';
import { EnlightenmentModule } from './enlightenment/enlightenment.module.js';
import { FeedbackModule } from './feedback/feedback.module.js';
import { ForgingModule } from './forging/forging.module.js';
import { GenesisModule } from './genesis/genesis.module.js';
import { HealthModule } from './health/health.module.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { NotFoundModule } from './http/not-found.module.js';
import { RequestContextInterceptor } from './http/request-context.interceptor.js';
import { HuntsModule } from './hunts/hunts.module.js';
import { InscriptionsModule } from './inscriptions/inscriptions.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { LegacyItemsModule } from './legacy-items/legacy-items.module.js';
import { MailModule } from './mail/mail.module.js';
import { ManualsModule } from './manuals/manuals.module.js';
import { MarketModule } from './market/market.module.js';
import { PlayerModule } from './player/player.module.js';
import { RankingsModule } from './rankings/rankings.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ReputationShopModule } from './reputation-shop/reputation-shop.module.js';
import { ReshapeModule } from './reshape/reshape.module.js';
import { RuntimeModule } from './runtime/runtime.module.js';
import { SectsModule } from './sects/sects.module.js';
import { SocialModule } from './social/social.module.js';
import { SpiritFieldModule } from './spirit-field/spirit-field.module.js';
import { SponsorshipModule } from './sponsorship/sponsorship.module.js';
import { StoryModule } from './story/story.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { TowerModule } from './tower/tower.module.js';

@Module({
  imports: [
    ConfigurationModule,
    ...(allowsLocalDevTools(getRuntimeEnvironment().APP_ENV, getRuntimeEnvironment().NODE_ENV)
      ? [DevToolsModule]
      : []),
    AuthModule,
    SponsorshipModule,
    GenesisModule,
    ReshapeModule,
    CommunityModule,
    EnemiesModule,
    RankingsModule,
    AccountModule,
    AdminModule,
    AuctionModule,
    BlackMarketModule,
    MarketModule,
    ReputationShopModule,
    SpiritFieldModule,
    AlchemyModule,
    EnlightenmentModule,
    ForgingModule,
    InscriptionsModule,
    ArenaModule,
    HealthModule,
    RuntimeModule,
    DivinationModule,
    RealtimeModule,
    PlayerModule,
    SocialModule,
    StoryModule,
    TasksModule,
    MailModule,
    CultivatorModule,
    FeedbackModule,
    CombatModule,
    SectsModule,
    BeastsModule,
    InventoryModule,
    LegacyItemsModule,
    ManualsModule,
    HuntsModule,
    DungeonModule,
    TowerModule,
    // Namespace authorization fallbacks must follow every concrete route.
    NotFoundModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
