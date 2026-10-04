import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isAdminIdentity, isAdminUserId } from '@server/lib/auth/adminAccess.js';
import { fromNodeHeaders } from 'better-auth/node';
import type { Response } from 'express';
import type { GameRequest } from '../http/request.js';
import { ACCESS_POLICY, type AccessPolicy } from './access.js';
import { SessionService } from './session.service.js';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy =
      this.reflector.getAllAndOverride<AccessPolicy>(ACCESS_POLICY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'user';
    if (policy === 'public') return true;
    const request = context.switchToHttp().getRequest<GameRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const session = await this.sessions.getSession(
      fromNodeHeaders(request.headers),
    );
    session.headers?.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') response.setHeader(key, value);
    });
    for (const cookie of session.headers?.getSetCookie() ?? []) {
      response.append('Set-Cookie', cookie);
    }
    const user = session.response?.user;
    if (!user)
      throw new HttpException({ success: false, error: '未授权访问' }, 401);
    request.gameContext.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
    if (policy === 'admin' && !isAdminIdentity(user)) {
      throw new HttpException({ success: false, error: '无管理员权限' }, 403);
    }
    if (policy === 'account-admin' && !isAdminUserId(user.id)) {
      throw new HttpException(
        {
          success: false,
          error: '账号管理需要在 ADMIN_USER_IDS 中配置当前管理员用户 ID',
        },
        403,
      );
    }
    if (policy === 'active') {
      const ref = await this.sessions.getActiveCultivator(user);
      if (!ref)
        throw new HttpException(
          { success: false, error: '当前没有活跃角色' },
          404,
        );
      request.gameContext.activeCultivatorRef = ref;
    }
    return true;
  }
}
