import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  ExchangeArtifactSchema,
  type ExchangeArtifact,
} from '@daoyou/contracts/legacy/artifacts';
import {
  ExchangeManualSchema,
  type ExchangeManual,
} from '@daoyou/contracts/legacy/manuals';
import { Access, CurrentCultivator } from '../auth/access.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { migrationErrors } from './migration-errors.js';
import { MigrationService } from './migration.service.js';

const ManualErrors = migrationErrors('manual');
const ArtifactErrors = migrationErrors('artifact');

@Controller('api/artifact-migration')
@Access('active')
@UseFilters(ArtifactErrors)
export class ArtifactMigrationController {
  constructor(
    @Inject(MigrationService) private readonly migration: MigrationService,
  ) {}

  @Get('availability')
  availability(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.artifactAvailability(actor);
  }

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.artifacts(actor);
  }

  @Post('exchange')
  @HttpCode(200)
  exchange(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ExchangeArtifactSchema))
    input: ExchangeArtifact,
  ) {
    return this.migration.exchangeArtifact(actor, input);
  }
}

@Controller('api/manual-migration')
@Access('active')
@UseFilters(ManualErrors)
export class ManualMigrationController {
  constructor(
    @Inject(MigrationService) private readonly migration: MigrationService,
  ) {}

  @Get('availability')
  availability(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.manualAvailability(actor);
  }

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.manuals(actor);
  }

  @Post('exchange')
  @HttpCode(200)
  exchange(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ExchangeManualSchema))
    input: ExchangeManual,
  ) {
    return this.migration.exchangeManual(actor, input);
  }
}
