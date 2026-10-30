import { Injectable } from '@nestjs/common';
import {
  activateCombatAutoStrategy,
  readCombatAutoStrategy,
  removeCombatAutoStrategySlot,
  resetCombatAutoStrategy,
  saveCombatAutoStrategy,
} from '@server/combat/application/CombatV6AutoStrategyService.js';
import type {
  AutoStrategy,
  AutoStrategySlotIndex,
} from '@daoyou/game-domain/combat/auto';

@Injectable()
export class AutoStrategyService {
  async read(owner: string) {
    return { success: true, data: await readCombatAutoStrategy(owner) };
  }
  async save(
    owner: string,
    pathId: string,
    slot: AutoStrategySlotIndex | undefined,
    strategy: AutoStrategy,
  ) {
    return {
      success: true,
      data: await saveCombatAutoStrategy(owner, pathId, slot, strategy),
    };
  }
  async activate(owner: string, pathId: string, slot: AutoStrategySlotIndex) {
    return {
      success: true,
      data: await activateCombatAutoStrategy(owner, pathId, slot),
    };
  }
  async reset(owner: string, pathId: string) {
    return {
      success: true,
      data: await resetCombatAutoStrategy(owner, pathId),
    };
  }
  async removeSlot(owner: string, pathId: string, slot: AutoStrategySlotIndex) {
    return {
      success: true,
      data: await removeCombatAutoStrategySlot(owner, pathId, slot),
    };
  }
}
