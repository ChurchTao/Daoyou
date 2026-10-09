import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  InquiryActionRequestSchema,
  InquiryLeaveRequestSchema,
  InquiryOpenRequestSchema,
  InquiryVerdictRequestSchema,
} from '@daoyou/contracts/inquiry';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { streamInquiryNarration } from './narration.js';
import { InquiryService } from './inquiry.service.js';

function wantsStream(request: Request) {
  return (request.headers.accept ?? '').includes('text/event-stream');
}

function sendEvent(response: Response, event: string, data: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function beginStream(response: Response) {
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();
}

function errorMessage(error: unknown) {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'error' in body) {
      const value = (body as { error?: unknown }).error;
      if (typeof value === 'string') return value;
    }
  }
  return error instanceof Error ? error.message : '探查没有完成';
}

@Controller('api/inquiry')
@Access('active')
export class InquiryController {
  constructor(@Inject(InquiryService) private readonly inquiry: InquiryService) {}

  @Get('state')
  state(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.inquiry.state(actor.cultivatorId);
  }

  @Post('runs')
  @HttpCode(200)
  async open(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
    @Res() response: Response,
    @JsonBody(new ZodPipe(InquiryOpenRequestSchema))
    input: z.infer<typeof InquiryOpenRequestSchema>,
  ) {
    if (!wantsStream(request)) {
      try {
        response.json(
          await this.inquiry.open(actor.userId, actor.cultivatorId, input.mapNodeId),
        );
      } catch (error) {
        response.status(error instanceof HttpException ? error.getStatus() : 500).json({
          success: false,
          error: errorMessage(error),
        });
      }
      return;
    }
    beginStream(response);
    try {
      await this.inquiry.openWithEvents(
        actor.userId,
        actor.cultivatorId,
        input.mapNodeId,
        (event, data) => sendEvent(response, event, data),
      );
    } catch (error) {
      sendEvent(response, 'error', { error: errorMessage(error) });
    } finally {
      response.end();
    }
  }

  @Post('actions')
  @HttpCode(200)
  async act(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Req() request: Request,
    @Res() response: Response,
    @JsonBody(new ZodPipe(InquiryActionRequestSchema))
    input: z.infer<typeof InquiryActionRequestSchema>,
  ) {
    let detailed: Awaited<ReturnType<InquiryService['actDetailed']>>;
    try {
      detailed = await this.inquiry.actDetailed(
        actor.userId,
        actor.cultivatorId,
        input,
      );
    } catch (error) {
      response.status(error instanceof HttpException ? error.getStatus() : 500).json({
        success: false,
        error: errorMessage(error),
      });
      return;
    }
    if (!wantsStream(request) || !detailed.stream) {
      response.json(detailed.response);
      return;
    }
    beginStream(response);
    try {
      sendEvent(response, 'state', detailed.response);
      const text = await streamInquiryNarration(
        {
          caseFile: detailed.stream.caseFile,
          fallback: detailed.stream.fallback,
          lines: detailed.stream.lines,
        },
        (token) => sendEvent(response, 'token', { text: token }),
      );
      await this.inquiry.rememberNarration(
        detailed.stream.cultivatorId,
        detailed.stream.runId,
        detailed.stream.revision,
        detailed.stream.key,
        text,
      );
      sendEvent(response, 'prose', { text });
    } catch (error) {
      sendEvent(response, 'error', { error: errorMessage(error) });
    } finally {
      response.end();
    }
  }

  @Post('verdict')
  @HttpCode(200)
  verdict(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(InquiryVerdictRequestSchema))
    input: z.infer<typeof InquiryVerdictRequestSchema>,
  ) {
    return this.inquiry.verdict(actor.userId, actor.cultivatorId, input);
  }

  @Post('leave')
  @HttpCode(200)
  leave(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(InquiryLeaveRequestSchema))
    input: z.infer<typeof InquiryLeaveRequestSchema>,
  ) {
    return this.inquiry.leave(actor.userId, actor.cultivatorId, input);
  }
}
