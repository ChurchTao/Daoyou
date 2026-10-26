import {
  CharacterCardSettingsSchema,
  type CharacterCardSettings,
} from '@daoyou/contracts/player/card';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { CharacterCardService } from './character-card.service.js';

const CardErrors = apiErrorFilter((error) => {
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: error.issues[0]?.message ?? '名片设置无效' },
      { status: 400 },
    );
});

@Controller('api/cultivator')
@Access('active')
@UseFilters(CardErrors)
export class CharacterCardController {
  constructor(
    @Inject(CharacterCardService) private readonly cards: CharacterCardService,
  ) {}

  @Get('card/settings')
  @Header('Cache-Control', 'no-store')
  settings(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.cards.settings(actor);
  }

  @Put('card/settings')
  @HttpCode(200)
  save(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(CharacterCardSettingsSchema))
    input: CharacterCardSettings,
  ) {
    return this.cards.save(actor, input);
  }

  @Get(':id/card')
  @Header('Cache-Control', 'no-store')
  card(@Param('id', new ZodPipe(z.uuid())) id: string) {
    return this.cards.card(id);
  }
}
