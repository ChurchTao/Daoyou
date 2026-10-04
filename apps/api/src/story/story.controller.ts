import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  UseFilters,
  type PipeTransform,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { StoryService } from './story.service.js';

const CompleteSchema = z
  .object({ outcome: z.string().trim().min(1).max(40) })
  .strict();
const PerformanceErrors = apiErrorFilter((error) => {
  const message =
    error instanceof z.ZodError
      ? error.issues[0]?.message || '演出结果无效'
      : error instanceof Error
        ? error.message
        : '演出没能记下';
  return Response.json(
    { error: message },
    {
      status:
        error instanceof z.ZodError
          ? 400
          : message.includes('当前没有这场演出')
            ? 409
            : 400,
    },
  );
});
const GuideErrors = apiErrorFilter((error) => {
  const message = error instanceof Error ? error.message : '这课没能记下';
  return Response.json(
    { error: message },
    {
      status: message.includes('当前没有这场教学')
        ? 409
        : message.includes('没有这场教学')
          ? 404
          : 400,
    },
  );
});
class LessonIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 80)
      throw new HttpException({ error: '没有这场教学' }, 404);
    return value;
  }
}

@Controller('api/story')
@Access('active')
export class StoryController {
  constructor(@Inject(StoryService) private readonly story: StoryService) {}

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.story.read(actor);
  }

  @Post('performances/:scriptId/complete')
  @HttpCode(200)
  @UseFilters(PerformanceErrors)
  performance(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('scriptId') scriptId: string,
    @JsonBody({ fallback: null }, new ZodPipe(CompleteSchema))
    input: z.infer<typeof CompleteSchema>,
  ) {
    return this.story.performance(actor, scriptId, input.outcome);
  }

  @Post('guides/:lessonId/complete')
  @HttpCode(200)
  @UseFilters(GuideErrors)
  guide(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('lessonId', new LessonIdPipe()) lessonId: string,
  ) {
    return this.story.guide(actor, lessonId);
  }
}
