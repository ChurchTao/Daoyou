import type { ManualAction } from '../contracts/combatV6Manuals';
import { changeManual } from '../engine/combat-v6/manuals/state';
import type {
  CultivatorManualStateV1,
  ManualStateChangeResult,
} from '../engine/combat-v6/manuals/types';
import type { InventoryItem } from '../inventory';
import { findItemDefinition } from '../items/registry';
import type { RealmType } from '../types/constants';

/** Shared preview and authoritative validation, before any resource or inventory mutation. */
export function previewManualAction(
  state: CultivatorManualStateV1,
  realm: RealmType,
  action: ManualAction,
  resources: { experience: number; insight: number },
  item?: InventoryItem,
): ManualStateChangeResult {
  if (
    'item' in action &&
    (!item ||
      item.id !== action.item.id ||
      item.revision !== action.item.revision ||
      item.location !== 'bag' ||
      item.quantity < 1 ||
      findItemDefinition(item.definitionId)?.manualId !== action.manualId)
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'INVALID_MANUAL_STATE',
          message: '需要储物袋中的同名功法玉简，请刷新核对',
        },
      ],
    };
  }
  return changeManual({ ...action, state, realm, resources });
}
