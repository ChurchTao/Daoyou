import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { SponsorshipApplicationError } from '@server/sponsorship/application/SponsorshipApplicationService.js';
import {
  SponsorshipCheckoutRequestSchema,
  SponsorshipClaimRequestSchema,
  SponsorshipPublicQuerySchema,
  SponsorshipVisibilityRequestSchema,
  type SponsorshipCheckoutRequest,
  type SponsorshipClaimRequest,
} from '@daoyou/shared/contracts/sponsorship';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { SponsorshipService } from './sponsorship.service.js';
const SponsorshipErrors = apiErrorFilter((error) =>
  error instanceof SponsorshipApplicationError
    ? Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    : undefined,
);
const WebhookErrors = apiErrorFilter((error) => {
  console.warn('[sponsorship-webhook] rejected', {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return Response.json({ ec: 400, em: 'invalid webhook' }, { status: 400 });
});
@Controller('api/sponsorship')
@Access('active')
export class SponsorshipController {
  constructor(
    @Inject(SponsorshipService)
    private readonly sponsorship: SponsorshipService,
  ) {}
  @Post('providers/afdian/webhook')
  @Access('public')
  @HttpCode(200)
  @UseFilters(WebhookErrors)
  webhook(@JsonBody() input: unknown) {
    return this.sponsorship.webhook(input);
  }
  @Get('config')
  @Access('public')
  config() {
    return this.sponsorship.config();
  }
  @Get('public')
  @Access('public')
  publicProfiles(
    @FirstQuery(new ZodPipe(SponsorshipPublicQuerySchema, 'legacy-unhandled'))
    query: {
      page: number;
      pageSize: number;
    },
  ) {
    return this.sponsorship.publicProfiles(query);
  }
  @Get('me')
  merit(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.sponsorship.merit(actor);
  }
  @Patch('me/visibility')
  visibility(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(SponsorshipVisibilityRequestSchema, 'legacy-unhandled'),
    )
    input: { isPublic: boolean },
  ) {
    return this.sponsorship.visibility(actor, input.isPublic);
  }
  @Post('checkout-intents')
  @HttpCode(201)
  @UseFilters(SponsorshipErrors)
  checkout(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(SponsorshipCheckoutRequestSchema, 'legacy-unhandled'),
    )
    input: SponsorshipCheckoutRequest,
  ) {
    return this.sponsorship.checkout(actor, input);
  }
  @Get('checkout-intents/:id')
  checkoutStatus(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id') id: string,
  ) {
    return this.sponsorship.checkoutStatus(actor, id);
  }
  @Post('claims')
  @HttpCode(200)
  @UseFilters(SponsorshipErrors)
  claim(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(SponsorshipClaimRequestSchema, 'legacy-unhandled'),
    )
    input: SponsorshipClaimRequest,
  ) {
    return this.sponsorship.claim(actor, input);
  }
}
