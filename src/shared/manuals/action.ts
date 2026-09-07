import type { ManualAction } from '../contracts/combatV6Manuals';
import {
  forgetManualV1,
  learnManualV1,
  replaceManualV1,
} from '../engine/combat-v6/manuals/state';
import type {
  CultivatorManualStateV1,
  ManualStateChangeResult,
} from '../engine/combat-v6/manuals/types';
import type { InventoryItem } from '../inventory';
import { findItemDefinition } from '../items/registry';
import type { RealmType } from '../types/constants';

/** Shared preview and authoritative validation; no inventory mutation until validation succeeds. */
export function previewManualAction(
  state: CultivatorManualStateV1,
  realm: RealmType,
  action: ManualAction,
  item?: InventoryItem,
): ManualStateChangeResult {
  const input = { ...action, state, realm };
  if (action.action === 'forget')
    return forgetManualV1({
      ...input,
      expectedManualId: action.expectedManualId,
    });
  const manualId = item && findItemDefinition(item.definitionId)?.manualId;
  if (
    !item ||
    item.id !== action.item.id ||
    item.revision !== action.item.revision ||
    item.location !== 'bag' ||
    item.quantity < 1 ||
    !manualId
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'INVALID_MANUAL_STATE',
          message: '玉简已变化或未在储物袋，请刷新后重试',
        },
      ],
    };
  }
  return action.expectedManualId === null
    ? learnManualV1({ ...input, manualId })
    : replaceManualV1({
        ...input,
        manualId,
        expectedManualId: action.expectedManualId,
      });
}
