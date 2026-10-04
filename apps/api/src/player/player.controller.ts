import { Controller, Get, Inject } from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import { RESOURCE_SCOPE_KINDS } from '@daoyou/contracts/resources';
import { z } from 'zod';
import { CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { PlayerService } from './player.service.js';

const ResourcesQuery = z.object({ keys: z.string().min(1).max(256) });
const EventsQuery = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  scopeKind: z.enum(RESOURCE_SCOPE_KINDS),
  scopeId: z.string().min(1).max(128),
});

@Controller('api/player')
export class PlayerController {
  constructor(@Inject(PlayerService) private readonly player: PlayerService) {}

  @Get('resources')
  resources(
    @CurrentUser() user: AuthUser,
    @FirstQuery(new ZodPipe(ResourcesQuery))
    query: z.infer<typeof ResourcesQuery>,
  ) {
    return this.player.resources(user.id, query.keys);
  }

  @Get('resources/events')
  events(
    @CurrentUser() user: AuthUser,
    @FirstQuery(new ZodPipe(EventsQuery)) query: z.infer<typeof EventsQuery>,
  ) {
    return this.player.events(
      user.id,
      { kind: query.scopeKind, id: query.scopeId },
      query.after,
    );
  }
}
