import { Module } from '@nestjs/common';
import {
  PlayerCommandExecutor,
  playerCommandExecutor,
  SystemCommandExecutor,
  systemCommandExecutor,
} from '@server/player/application/state/CommandExecutors.js';

import {
  ResourceEngine,
  resourceEngine,
} from './application/state/ResourceEngine.js';

// Framework-independent callers and Nest use cases share the same coordinators.
@Module({
  providers: [
    { provide: ResourceEngine, useValue: resourceEngine },
    { provide: PlayerCommandExecutor, useValue: playerCommandExecutor },
    { provide: SystemCommandExecutor, useValue: systemCommandExecutor },
  ],
  exports: [PlayerCommandExecutor, SystemCommandExecutor, ResourceEngine],
})
export class PlayerStateModule {}
