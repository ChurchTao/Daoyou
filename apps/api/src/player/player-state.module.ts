import { Module } from '@nestjs/common';
import {
  PlayerCommandExecutor,
  playerCommandExecutor,
  SystemCommandExecutor,
  systemCommandExecutor,
} from '@server/player/application/state/CommandExecutors.js';

// Framework-independent callers and Nest use cases share the same coordinators.
@Module({
  providers: [
    { provide: PlayerCommandExecutor, useValue: playerCommandExecutor },
    { provide: SystemCommandExecutor, useValue: systemCommandExecutor },
  ],
  exports: [PlayerCommandExecutor, SystemCommandExecutor],
})
export class PlayerStateModule {}
