import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { AlchemyServiceError } from '@server/alchemy/application/AlchemyServiceError.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AlchemyFormulasService } from './alchemy-formulas.service.js';
import {
  DiscoveryConfirmSchema,
  FormulaAnalyzeSchema,
  FormulaIdParamSchema,
  FormulaListQuerySchema,
} from './alchemy-input.js';

function formulaErrors(message: string, includeDetails = true) {
  return apiErrorFilter((error) => {
    if (error instanceof z.ZodError)
      return Response.json(
        { error: error.issues[0]?.message || '请求参数格式错误' },
        { status: 400 },
      );
    if (error instanceof AlchemyServiceError)
      return Response.json(
        {
          error: error.message,
          ...(includeDetails ? (error.details ?? {}) : {}),
        },
        { status: error.status },
      );
    return Response.json({ error: message }, { status: 500 });
  });
}

@Controller('api/alchemy')
@Access('active')
export class AlchemyFormulasController {
  constructor(
    @Inject(AlchemyFormulasService)
    private readonly formulas: AlchemyFormulasService,
  ) {}

  @Get('materials')
  materials(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.formulas.materials(actor.cultivatorId);
  }

  @Get('formulas')
  @UseFilters(formulaErrors('丹方列表读取失败，请稍后再试。', false))
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery() query: Record<string, string | undefined>,
  ) {
    const input = FormulaListQuerySchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search || undefined,
      family: query.family || undefined,
    });
    return this.formulas.list(actor.cultivatorId, input);
  }

  @Delete('formulas/:formulaId')
  @UseFilters(formulaErrors('丹方删除失败，请稍后再试。'))
  remove(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(FormulaIdParamSchema))
    params: z.infer<typeof FormulaIdParamSchema>,
  ) {
    return this.formulas.remove(actor.cultivatorId, params.formulaId);
  }

  @Post('formulas/:formulaId/analyze')
  @HttpCode(200)
  @UseFilters(formulaErrors('推演药路失败，请稍后再试。'))
  analyze(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(FormulaIdParamSchema))
    params: z.infer<typeof FormulaIdParamSchema>,
    @JsonBody(new ZodPipe(FormulaAnalyzeSchema))
    input: z.infer<typeof FormulaAnalyzeSchema>,
  ) {
    return this.formulas.analyze(actor.cultivatorId, params.formulaId, input);
  }

  @Post('formulas/discovery/confirm')
  @HttpCode(200)
  @UseFilters(formulaErrors('丹方确认失败，请稍后再试。'))
  confirm(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DiscoveryConfirmSchema))
    input: z.infer<typeof DiscoveryConfirmSchema>,
  ) {
    return this.formulas.confirm(actor.cultivatorId, input);
  }
}
