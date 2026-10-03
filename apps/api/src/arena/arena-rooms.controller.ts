import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  ArenaCreateRoomSchema,
  ArenaJoinRoomSchema,
  ArenaReadyCommandSchema,
  ArenaStartCommandSchema,
} from '@daoyou/shared/contracts/arena';
import type { Response } from 'express';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ArenaRoomsService } from './arena-rooms.service.js';

const RoomIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^arena-[A-Za-z0-9-]+$/);
const EmptySchema = z.object({}).strict();

@Controller('api/arena')
@Access('active')
export class ArenaRoomsController {
  constructor(
    @Inject(ArenaRoomsService) private readonly rooms: ArenaRoomsService,
  ) {}

  @Get('room')
  current(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.rooms.current(actor);
  }

  @Get('rooms/:roomId')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('roomId', new ZodPipe(RoomIdSchema)) roomId: string,
  ) {
    return this.rooms.read(actor, roomId);
  }

  @Post('rooms')
  @HttpCode(201)
  create(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ArenaCreateRoomSchema))
    _input: z.infer<typeof ArenaCreateRoomSchema>,
  ) {
    void _input;
    return this.rooms.create(actor);
  }

  @Post('rooms/join')
  @HttpCode(200)
  join(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ArenaJoinRoomSchema))
    input: z.infer<typeof ArenaJoinRoomSchema>,
  ) {
    return this.rooms.join(actor, input);
  }

  @Post('rooms/:roomId/ready')
  @HttpCode(200)
  ready(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('roomId', new ZodPipe(RoomIdSchema)) roomId: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(ArenaReadyCommandSchema))
    input: z.infer<typeof ArenaReadyCommandSchema>,
  ) {
    return this.rooms.change(actor, roomId, {
      kind: 'ready',
      ready: input.ready,
    });
  }

  @Post('rooms/:roomId/touch')
  @HttpCode(200)
  touch(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('roomId', new ZodPipe(RoomIdSchema)) roomId: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(EmptySchema))
    _input: z.infer<typeof EmptySchema>,
  ) {
    void _input;
    return this.rooms.change(actor, roomId, { kind: 'touch' });
  }

  @Post('rooms/:roomId/switch-team')
  @HttpCode(200)
  switchTeam(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('roomId', new ZodPipe(RoomIdSchema)) roomId: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(EmptySchema))
    _input: z.infer<typeof EmptySchema>,
  ) {
    void _input;
    return this.rooms.change(actor, roomId, { kind: 'switch-team' });
  }

  @Post('rooms/:roomId/start')
  @HttpCode(200)
  async start(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('roomId', new ZodPipe(RoomIdSchema)) roomId: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(ArenaStartCommandSchema))
    input: z.infer<typeof ArenaStartCommandSchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.rooms.start(actor, roomId, input.requestId);
    response.status(result.status);
    return result.body;
  }

  @Post('rooms/:roomId/leave')
  @HttpCode(200)
  leave(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('roomId', new ZodPipe(RoomIdSchema)) roomId: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(EmptySchema))
    _input: z.infer<typeof EmptySchema>,
  ) {
    void _input;
    return this.rooms.leave(actor, roomId);
  }
}
