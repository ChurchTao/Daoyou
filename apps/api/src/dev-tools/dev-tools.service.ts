import { HttpException, Injectable } from '@nestjs/common';
import { patchDevCultivator } from '@server/dev-tools/application/DevCultivatorService.js';
import { resetDevDivination } from '@server/dev-tools/application/DevDivinationService.js';
import { clearDevInventoryBag } from '@server/dev-tools/application/DevInventoryService.js';
import { DivinationError } from '@server/divination/application/DivinationService.js';
import { grantDevResources } from '@server/forging/application/ForgingService.js';
import { InventoryError } from '@server/inventory/operations.js';
import { QiServiceError } from '@server/cultivator/application/QiService.js';
import { DevCultivatorPatchSchema } from '@daoyou/shared/contracts/devTools';
import { DevGrantSchema } from '@daoyou/shared/contracts/forging';
import { InventoryRuleError } from '@daoyou/shared/inventory';
import { z } from 'zod';

@Injectable()
export class DevToolsService {
  async grant(body: Uint8Array | undefined) {
    try {
      return {
        success: true,
        ...(await grantDevResources(
          DevGrantSchema.parse(JSON.parse(new TextDecoder().decode(body))),
        )),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException({ success: false, error: '发放参数无效' }, 400);
      if (
        error instanceof InventoryError ||
        error instanceof InventoryRuleError ||
        error instanceof QiServiceError
      )
        throw new HttpException({ success: false, error: error.message }, 409);
      throw error;
    }
  }

  async clearBag(id: string) {
    try {
      return {
        success: true,
        ...(await clearDevInventoryBag(z.uuid().parse(id))),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException({ success: false, error: '角色 ID 无效' }, 400);
      if (error instanceof InventoryError)
        throw new HttpException({ success: false, error: error.message }, 409);
      throw error;
    }
  }

  async resetDivination(id: string) {
    try {
      return {
        success: true,
        ...(await resetDevDivination(z.uuid().parse(id))),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException({ success: false, error: '角色 ID 无效' }, 400);
      if (error instanceof DivinationError)
        throw new HttpException(
          { success: false, error: error.message },
          error.status,
        );
      throw error;
    }
  }

  async patch(id: string, body: Uint8Array | undefined) {
    try {
      // The original endpoint validates the ID before decoding the request body.
      return {
        success: true,
        ...(await patchDevCultivator(
          z.uuid().parse(id),
          DevCultivatorPatchSchema.parse(
            JSON.parse(new TextDecoder().decode(body)),
          ),
        )),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException(
          { success: false, error: '角色调整参数无效' },
          400,
        );
      if (error instanceof InventoryError)
        throw new HttpException({ success: false, error: error.message }, 409);
      throw error;
    }
  }
}
