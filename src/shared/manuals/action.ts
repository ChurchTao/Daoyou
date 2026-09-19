import type { ManualAction } from '../contracts/combatV6Manuals';
import {
  CHARACTER_MANUALS_V1,
  manualRule,
} from '../engine/combat-v6/manuals/content';
import { changeManual } from '../engine/combat-v6/manuals/state';
import type {
  CultivatorManualStateV1,
  ManualStateChangeResult,
} from '../engine/combat-v6/manuals/types';
import type { InventoryItem } from '../inventory';
import { findItemDefinition } from '../items/registry';
import type { RealmType } from '../types/constants';

/** Learning costs one jade; successive bottlenecks cost two, then three. */
export function manualJadeCost(
  state: CultivatorManualStateV1,
  action: Pick<ManualAction, 'action' | 'manualId'>,
): number {
  if (action.action === 'learn') return 1;
  if (action.action !== 'unlock') return 0;
  const manual = CHARACTER_MANUALS_V1.find((m) => m.id === action.manualId);
  const learned = state.learned.find((m) => m.manualId === action.manualId);
  if (!manual || !learned) return 0;
  const index = manualRule(manual).bottlenecks.indexOf(learned.level);
  return index < 0 ? 0 : index + 2;
}

/** Shared preview and authoritative validation, before any resource or inventory mutation. */
export function previewManualAction(
  state: CultivatorManualStateV1,
  realm: RealmType,
  action: ManualAction,
  resources: { experience: number; insight: number },
  item?: InventoryItem,
): ManualStateChangeResult {
  const jadeCost = manualJadeCost(state, action);
  if (
    'item' in action &&
    (!item ||
      item.id !== action.item.id ||
      item.revision !== action.item.revision ||
      item.location !== 'bag' ||
      item.quantity < jadeCost ||
      findItemDefinition(item.definitionId)?.manualId !== action.manualId)
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'INVALID_MANUAL_STATE',
          message: `需要储物袋中数量足够的同名功法玉简（本次 ${jadeCost} 本），请刷新核对`,
        },
      ],
    };
  }
  return changeManual({ ...action, state, realm, resources });
}
