import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  enlightenManual,
  readEnlightenment,
} from '@server/enlightenment/application/EnlightenmentService.js';
import type { EnlightenmentRequest } from '@daoyou/shared/contracts/enlightenment';

@Injectable()
export class EnlightenmentService {
  async read(actor: ActiveCultivatorRef) {
    return { success: true, data: await readEnlightenment(actor) };
  }

  async mutate(actor: ActiveCultivatorRef, input: EnlightenmentRequest) {
    return { success: true, ...(await enlightenManual(actor, input)) };
  }
}
