import {
  HttpException,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { storyGateOpen } from '@daoyou/game-domain/story/gates';
import { db } from '@server/lib/drizzle/db.js';
import type { GameRequest } from '../http/request.js';
import { StoryService } from './application/StoryService.js';

const STORY_GATE = Symbol('story-gate');

/**
 * 主线还没带到的玩法，服务端也不放行。
 * 只拦会改动数据的请求；读数据不拦，免得页面上挂着的只读部件报错。
 * 开没开和前端问的是同一张入口总表。
 */
@Injectable()
export class StoryGateGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GameRequest>();
    if (request.method === 'GET' || request.method === 'HEAD') return true;
    const gate =
      (Reflect.getMetadata(STORY_GATE, context.getHandler()) as
        | string
        | undefined) ??
      (Reflect.getMetadata(STORY_GATE, context.getClass()) as
        | string
        | undefined);
    const cultivatorId = request.gameContext.activeCultivatorRef?.cultivatorId;
    if (!gate || !cultivatorId) return true;
    const unlocked = await StoryService.unlocked(cultivatorId, db);
    if (storyGateOpen(unlocked, gate)) return true;
    throw new HttpException(
      { success: false, error: '主线还没带你到这里。跟着主线走，到时候自然会开。' },
      403,
    );
  }
}

/** 这一组接口归入口总表里的哪道门管。 */
export const StoryGate = (gate: string) =>
  applyDecorators(SetMetadata(STORY_GATE, gate), UseGuards(StoryGateGuard));
