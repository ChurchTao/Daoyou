import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { DivinationError } from '@server/divination/application/DivinationService.js';
import type { Response } from 'express';

@Catch(DivinationError)
export class DivinationExceptionFilter implements ExceptionFilter {
  catch(error: DivinationError, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(error.status)
      .json({ error: error.message });
  }
}
