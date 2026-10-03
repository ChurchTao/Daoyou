import {
  Catch,
  HttpException,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  async catch(error: unknown, host: ArgumentsHost): Promise<void> {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    if (response.headersSent) {
      response.end();
      return;
    }
    const lock = redisLockErrorResponse(error);
    if (lock) {
      lock.headers.forEach((value, name) => response.setHeader(name, value));
      response.status(lock.status).send(await lock.text());
      return;
    }
    if (error instanceof Error && 'type' in error) {
      if (error.type === 'entity.too.large') {
        response.status(413).json({ success: false, error: '请求内容过大' });
        return;
      }
    }
    if (error instanceof HttpException) {
      const originalBody = error.getResponse();
      const message =
        typeof originalBody === 'object'
          ? (originalBody as { message?: unknown }).message
          : originalBody;
      if (
        error instanceof NotFoundException &&
        typeof message === 'string' &&
        message.startsWith('Cannot ')
      ) {
        const path = request.path;
        if (!/^\/(api|internal)(\/|$)/.test(path)) {
          response
            .status(302)
            .setHeader('Location', 'https://client.daoyou.org');
          response.end();
          return;
        }
        response.status(404).json({ success: false, error: '接口不存在' });
        return;
      }
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(
          typeof body === 'string' ? { success: false, error: body } : body,
        );
      return;
    }
    console.error('Unhandled API error:', error);
    response.status(500).json({
      success: false,
      error: '服务器内部错误',
    });
  }
}
