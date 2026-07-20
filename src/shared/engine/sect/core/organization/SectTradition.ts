import {
  StandardSectRules,
  type CultivatorSectState,
  type SectAbilitySlots,
} from '../domain';
import { SectDomainError } from './domain';

/**
 * Aggregate for a member's learned tradition. Content specifications validate
 * definitions; this aggregate owns the resulting state transitions.
 */
export class SectTradition {
  private constructor(private readonly state: CultivatorSectState) {}

  static rehydrate(state: CultivatorSectState): SectTradition {
    return new SectTradition(structuredClone(state));
  }

  snapshot(): CultivatorSectState {
    return structuredClone(this.state);
  }

  setMethodLevel(methodId: string, level: number): void {
    if (!methodId || !Number.isSafeInteger(level) || level <= 0)
      throw new SectDomainError('心法状态无效');
    const current = this.state.methods[methodId] ?? 0;
    if (level <= current) throw new SectDomainError('心法等级只能提高');
    this.state.methods[methodId] = level;
  }

  unlockPathLayer(
    pathId: string,
    layerId: string,
    defaultTacticId: string,
  ): void {
    let path = this.state.paths.find((entry) => entry.pathId === pathId);
    if (!path) {
      path = {
        pathId,
        unlockedLayerIds: [],
        tacticId: defaultTacticId,
        activeMeridianSlot: 1,
        meridianLoadouts: StandardSectRules.meridianLoadoutSlots.map(
          (slot) => ({
            slot,
            nodeIds: [],
            version: 1,
          }),
        ),
      };
      this.state.paths.push(path);
      this.state.activePathId ??= pathId;
    }
    if (path.unlockedLayerIds.includes(layerId))
      throw new SectDomainError('流派层级已经解锁');
    path.unlockedLayerIds.push(layerId);
  }

  activatePath(pathId: string): void {
    this.requirePath(pathId);
    this.state.activePathId = pathId;
  }

  setMeridianLoadout(pathId: string, slot: 1 | 2 | 3, nodeIds: string[]): void {
    const path = this.requirePath(pathId);
    const current = path.meridianLoadouts.find((entry) => entry.slot === slot);
    const next = {
      slot,
      nodeIds: [...nodeIds],
      version: (current?.version ?? 0) + 1,
    };
    path.meridianLoadouts = [
      ...path.meridianLoadouts.filter((entry) => entry.slot !== slot),
      next,
    ].sort((left, right) => left.slot - right.slot);
  }

  activateMeridianLoadout(pathId: string, slot: 1 | 2 | 3): void {
    const path = this.requirePath(pathId);
    if (!path.meridianLoadouts.some((entry) => entry.slot === slot))
      throw new SectDomainError('经脉方案不存在');
    path.activeMeridianSlot = slot;
  }

  setTactic(pathId: string, tacticId: string): void {
    this.requirePath(pathId).tacticId = tacticId;
  }

  setAbilityLoadout(slots: SectAbilitySlots): void {
    if (slots.length !== StandardSectRules.activeAbilitySlotCount)
      throw new SectDomainError(
        `神通栏必须包含${StandardSectRules.activeAbilitySlotCount}个固定槽位`,
      );
    const selected = slots.filter((id): id is string => id !== null);
    if (new Set(selected).size !== selected.length)
      throw new SectDomainError('神通栏不能包含重复神通');
    this.state.abilityLoadout = [...slots] as SectAbilitySlots;
  }

  private requirePath(pathId: string) {
    const path = this.state.paths.find((entry) => entry.pathId === pathId);
    if (!path) throw new SectDomainError('尚未习得该流派');
    return path;
  }
}
