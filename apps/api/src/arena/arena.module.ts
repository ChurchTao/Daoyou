import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { ArenaBattleStartOrchestrator } from '@server/arena/application/ArenaBattleStartOrchestrator.js';
import { ArenaRoomService } from '@server/arena/application/ArenaRoomService.js';
import { CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore.js';
import { AuthModule } from '../auth/auth.module.js';
import { ArenaBattlesController } from './arena-battles.controller.js';
import { ArenaBattlesService } from './arena-battles.service.js';
import { ArenaRealtimeService } from './arena-realtime.service.js';
import { ArenaRoomsController } from './arena-rooms.controller.js';
import { ArenaRoomsService } from './arena-rooms.service.js';
import { ArenaGateway } from './arena.gateway.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ArenaRoomsController, ArenaBattlesController],
  providers: [
    { provide: ArenaRoomService, useFactory: () => new ArenaRoomService() },
    { provide: CombatV6ArenaStore, useFactory: () => new CombatV6ArenaStore() },
    {
      provide: ArenaBattleStartOrchestrator,
      useFactory: (rooms: ArenaRoomService) =>
        new ArenaBattleStartOrchestrator(rooms),
      inject: [ArenaRoomService],
    },
    ArenaRoomsService,
    ArenaBattlesService,
    ArenaRealtimeService,
    ArenaGateway,
  ],
  exports: [ArenaRealtimeService],
})
export class ArenaModule {}
