import { InkButton, InkSelect } from '@app/components/ui';
import {
  useInventorySnapshot,
  useProductsSnapshot,
} from '@app/lib/player-state/selectors';
import type { SectTaskViewData } from '@shared/contracts/sect';
import { useMemo, useState } from 'react';
import { useSectTaskInteraction } from './SectTaskInteractionProvider';

export type SectTaskViewAction = SectTaskViewData['actions'][number];

export interface SectTaskActionRendererProps {
  task: SectTaskViewData;
  action: SectTaskViewAction;
}

export function AcceptAction({ task, action }: SectTaskActionRendererProps) {
  const { busy, execute } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      disabled={busy || !action.enabled}
      onClick={() => void execute(task, action, {}, `已领取「${task.presentation.title}」`)}
    >
      {action.enabled ? action.label : action.disabledReason ?? '尚未解锁'}
    </InkButton>
  );
}

export function BattleAction({ task, action }: SectTaskActionRendererProps) {
  const { busy, navigate } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      disabled={busy || !action.enabled}
      onClick={() =>
        navigate(
          `/game/sect/tasks/${encodeURIComponent(task.definitionId)}/battle?attemptId=${crypto.randomUUID()}`,
        )
      }
    >
      {action.enabled ? action.label : action.disabledReason ?? '尚未解锁'}
    </InkButton>
  );
}

export function SweepAction({ task, action }: SectTaskActionRendererProps) {
  const { busy, execute } = useSectTaskInteraction();
  return (
    <InkButton
      variant="primary"
      disabled={busy || !action.enabled}
      onClick={() =>
        void execute(task, action, {}, `「${task.presentation.title}」清扫场已开启`)
      }
    >
      {action.enabled ? action.label : action.disabledReason ?? '尚未解锁'}
    </InkButton>
  );
}

export function ItemDeliveryAction(props: SectTaskActionRendererProps) {
  const { busy, execute } = useSectTaskInteraction();
  const inventory = useInventorySnapshot();
  const products = useProductsSnapshot();
  const [itemId, setItemId] = useState('');
  const kind = props.action.parameters?.itemKind;
  const quantity = Number(props.action.parameters?.quantity ?? 1);
  const options = useMemo(() => {
    if (kind === 'pill')
      return inventory.consumables
        .filter((item): item is typeof item & { id: string } => Boolean(item.id))
        .map((item) => ({
          id: item.id,
          label: `${item.name} · ${item.quality} · ${item.quantity}枚`,
        }));
    if (kind === 'artifact')
      return products.artifacts
        .filter((item): item is typeof item & { id: string } => Boolean(item.id) && !item.isEquipped)
        .map((item) => ({ id: item.id, label: `${item.name} · ${item.quality}` }));
    if (kind === 'material')
      return inventory.materials.map((item) => ({
        id: item.id,
        label: `${item.name} · ${item.rank} · ${item.quantity}份`,
      }));
    return [];
  }, [inventory.consumables, inventory.materials, kind, products.artifacts]);

  return (
    <div className="mt-3">
      <InkSelect label="选择交付物" value={itemId} onChange={setItemId}>
        <option value="">请选择符合要求的物品</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </InkSelect>
      <InkButton
        variant="primary"
        disabled={busy || !props.action.enabled || !itemId}
        onClick={() =>
          void execute(
            props.task,
            props.action,
            { itemId, quantity },
            `「${props.task.presentation.title}」已完成`,
          )
        }
      >
        {props.action.enabled ? props.action.label : props.action.disabledReason ?? '尚未解锁'}
      </InkButton>
    </div>
  );
}
