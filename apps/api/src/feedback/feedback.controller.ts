import { Controller, HttpCode, Inject, Post, UseFilters } from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import {
  FeedbackCreateRequestSchema,
  type FeedbackCreateRequest,
} from '@daoyou/contracts/feedback';
import { ZodError } from 'zod';
import { Access, CurrentUser } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { FeedbackService } from './feedback.service.js';

const FeedbackErrors = apiErrorFilter((error) => {
  if (error instanceof ZodError) return undefined;
  console.error('Create feedback error:', error);
  return Response.json(
    { success: false, error: '提交反馈失败，请稍后重试' },
    { status: 500 },
  );
});

@Controller('api/feedback')
@Access('user')
export class FeedbackController {
  constructor(
    @Inject(FeedbackService) private readonly feedback: FeedbackService,
  ) {}

  @Post()
  @HttpCode(200)
  @UseFilters(FeedbackErrors)
  create(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: undefined }, new ZodPipe(FeedbackCreateRequestSchema))
    input: FeedbackCreateRequest,
  ) {
    return this.feedback.create(user.id, input);
  }
}
