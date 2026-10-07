import { Global, Module } from '@nestjs/common';
import { RequestWorkService } from './request-work.service.js';
import { SseResponseService } from './sse-response.service.js';

@Global()
@Module({
  providers: [RequestWorkService, SseResponseService],
  exports: [RequestWorkService, SseResponseService],
})
export class HttpContextModule {}
