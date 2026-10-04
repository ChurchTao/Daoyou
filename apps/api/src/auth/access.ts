import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { GameRequest } from '../http/request.js';

export type AccessPolicy =
  'public' | 'user' | 'active' | 'admin' | 'account-admin';
export const ACCESS_POLICY = Symbol('access-policy');
export const Access = (policy: AccessPolicy) =>
  SetMetadata(ACCESS_POLICY, policy);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<GameRequest>().gameContext.user,
);

export const CurrentCultivator = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<GameRequest>().gameContext
      .activeCultivatorRef,
);
