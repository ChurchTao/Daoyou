import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import {
  DivinationError,
  drawDivination,
  interpretDivination,
  readDivination,
} from '@server/divination/application/DivinationService.js';
import { InventoryError } from '@server/inventory/operations.js';
import type { DivinationStreamEvent } from '@daoyou/shared/contracts/divination';

@Injectable()
export class DivinationService {
  read(actor: ActiveCultivatorRef) {
    return readDivination(actor);
  }

  draw(
    actor: ActiveCultivatorRef,
    direction: Parameters<typeof drawDivination>[1],
  ) {
    return drawDivination(actor, direction);
  }

  async interpret(
    actor: ActiveCultivatorRef,
    drawId: string,
    signal: AbortSignal,
    emit: (event: DivinationStreamEvent) => Promise<void>,
  ) {
    try {
      await interpretDivination(actor, drawId, signal, emit);
    } catch (error) {
      console.warn('[divination] interpretation incomplete', { drawId, error });
      await emit({
        type: 'error',
        message: redisLockErrorResponse(error)
          ? '此签正在处理，请稍后重新查看。'
          : error instanceof DivinationError || error instanceof InventoryError
            ? error.message
            : '解签暂未完成，请稍后继续。',
      });
    }
  }
}
