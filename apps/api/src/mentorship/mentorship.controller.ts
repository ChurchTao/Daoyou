import {
  MentorshipMutationSchema,
  MentorshipProfileSchema,
  MentorshipRequestSchema,
  type MentorshipMutation,
  type MentorshipProfileInput,
  type MentorshipRequestInput,
} from '@daoyou/contracts/mentorship';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody, JsonBodyParseError } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { MentorshipService } from './mentorship.service.js';

const IdSchema = z.strictObject({ id: z.uuid() });
// Contracts and the API may resolve distinct Zod module instances.
function validationIssues(error: unknown): unknown[] | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('name' in error) ||
    error.name !== 'ZodError' ||
    !('issues' in error) ||
    !Array.isArray(error.issues)
  )
    return null;
  return error.issues;
}
@Controller('api/mentorship')
@Access('active')
@UseFilters(
  apiErrorFilter((error) => {
    if (error instanceof JsonBodyParseError)
      return Response.json(
        { error: '请求正文必须是有效JSON' },
        { status: 400 },
      );
    const issues = validationIssues(error);
    return issues
      ? Response.json({ error: '参数无效', details: issues }, { status: 400 })
      : undefined;
  }),
)
export class MentorshipController {
  constructor(
    @Inject(MentorshipService) private readonly mentorship: MentorshipService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  overview(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.mentorship.overview(actor);
  }
  @Get('mentors')
  @Header('Cache-Control', 'private, no-store')
  mentors(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.mentorship.mentors(actor);
  }
  @Get('requests')
  @Header('Cache-Control', 'private, no-store')
  async requests(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return { requests: (await this.mentorship.overview(actor)).requests };
  }
  @Put('profile')
  profile(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(MentorshipProfileSchema))
    input: MentorshipProfileInput,
  ) {
    return this.mentorship.updateProfile(actor, input);
  }
  @Post('requests')
  @HttpCode(200)
  request(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(MentorshipRequestSchema))
    input: MentorshipRequestInput,
  ) {
    return this.mentorship.request(actor, input);
  }
  @Post('requests/:id/accept')
  @HttpCode(200)
  accept(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(IdSchema)) params: z.infer<typeof IdSchema>,
    @JsonBody(new ZodPipe(MentorshipMutationSchema)) input: MentorshipMutation,
  ) {
    return this.mentorship.actRequest(actor, params.id, 'accept', input);
  }
  @Post('requests/:id/reject')
  @HttpCode(200)
  reject(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(IdSchema)) params: z.infer<typeof IdSchema>,
    @JsonBody(new ZodPipe(MentorshipMutationSchema)) input: MentorshipMutation,
  ) {
    return this.mentorship.actRequest(actor, params.id, 'reject', input);
  }
  @Post('requests/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(IdSchema)) params: z.infer<typeof IdSchema>,
    @JsonBody(new ZodPipe(MentorshipMutationSchema)) input: MentorshipMutation,
  ) {
    return this.mentorship.actRequest(actor, params.id, 'cancel', input);
  }
  @Post('relations/:id/dissolve')
  @HttpCode(200)
  dissolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(IdSchema)) params: z.infer<typeof IdSchema>,
    @JsonBody(new ZodPipe(MentorshipMutationSchema)) input: MentorshipMutation,
  ) {
    return this.mentorship.relationAction(actor, params.id, 'dissolve', input);
  }
  @Post('relations/:id/graduate')
  @HttpCode(200)
  graduate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(IdSchema)) params: z.infer<typeof IdSchema>,
    @JsonBody(new ZodPipe(MentorshipMutationSchema)) input: MentorshipMutation,
  ) {
    return this.mentorship.relationAction(actor, params.id, 'graduate', input);
  }
}
