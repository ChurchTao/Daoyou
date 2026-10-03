import { Injectable } from '@nestjs/common';
import {
  readCombatAutoStrategy,
  resetCombatAutoStrategy,
  saveCombatAutoStrategy,
} from '@server/combat/application/CombatV6AutoStrategyService.js';
import type { AutoStrategy } from '@daoyou/shared/combat-v6/auto-strategy';

@Injectable()
export class AutoStrategyService {
  async read(owner: string) {
    return { success: true, data: await readCombatAutoStrategy(owner) };
  }
  async save(owner: string, pathId: string, strategy: AutoStrategy) {
    return {
      success: true,
      data: await saveCombatAutoStrategy(owner, pathId, strategy),
    };
  }
  async reset(owner: string, pathId: string) {
    return {
      success: true,
      data: await resetCombatAutoStrategy(owner, pathId),
    };
  }
}
