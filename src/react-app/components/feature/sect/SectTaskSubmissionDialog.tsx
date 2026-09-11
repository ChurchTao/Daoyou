import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { InkButton, InkInput, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { fetchSectSubmissionCandidates } from '@app/lib/sect/sectClient';
import type { InventoryView } from '@shared/contracts/inventory';
import type {
  SectSubmissionCandidatesData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import { describeSectDeliveryRequirement } from '@shared/engine/sect';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SectTaskViewAction } from './SectTaskActions';
import { useSectTaskInteraction } from './SectTaskInteractionProvider';

type BagItem = InventoryView['items'][number];
export function SectTaskSubmissionDialog(props: {
  open: boolean;
  task: SectTaskViewData;
  action: SectTaskViewAction;
  onClose(): void;
}) {
  return props.open ? <OpenSubmission key={props.task.id} {...props} /> : null;
}

function OpenSubmission({
  task,
  action,
  onClose,
}: {
  task: SectTaskViewData;
  action: SectTaskViewAction;
  onClose(): void;
}) {
  const bagQuery = useInventoryBag();
  const bag = bagQuery.data;
  const bagUnavailable = !bag || bagQuery.isRefreshing || !!bagQuery.error;
  const [data, setData] = useState<SectSubmissionCandidatesData>();
  const [selections, setSelections] = useState<
    Array<{ item: BagItem; quantity: string }>
  >([]);
  const [error, setError] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(undefined);
  const { busy, execute } = useSectTaskInteraction();
  const requirement = data?.requirement ?? task.requirement;
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const candidates = await fetchSectSubmissionCandidates(task.definitionId);
      setData(candidates);
      setSelections([]);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取失败');
    } finally {
      setLoading(false);
    }
  }, [task.definitionId]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  if (!requirement) return null;
  const total = selections.reduce((sum, s) => sum + Number(s.quantity), 0);
  function reasonFor(item: BagItem) {
    const candidate = data?.items.find((c) => c.item.id === item.id);
    return candidate?.eligible
      ? ''
      : (candidate?.violations.map((v) => v.message).join('；') ??
          '此物不符合委托类型');
  }
  function choose(item: BagItem) {
    if (pending.current || busy || loading || bagUnavailable) return;
    const reason = reasonFor(item);
    if (reason) {
      setError(reason);
      return;
    }
    setError('');
    setSelections((current) => {
      if (current.some((s) => s.item.id === item.id))
        return current.filter((s) => s.item.id !== item.id);
      const selection = { item, quantity: '1' };
      return requirement!.kind === 'material'
        ? [...current, selection]
        : [selection];
    });
  }
  const valid =
    !bagUnavailable &&
    !loading &&
    total === requirement.quantity &&
    selections.length > 0 &&
    selections.every(
      (s) =>
        bag!.items.some(
          (item) => item.id === s.item.id && item.revision === s.item.revision,
        ) &&
        Number.isInteger(Number(s.quantity)) &&
        Number(s.quantity) > 0 &&
        Number(s.quantity) <= s.item.quantity,
    );
  async function submit() {
    if (!valid || pending.current || busy) return;
    const items = selections.map((s) => ({
      itemId: s.item.id,
      revision: s.item.revision,
      quantity: Number(s.quantity),
    }));
    const key = JSON.stringify(items);
    if (attempt.current?.key !== key)
      attempt.current = { key, id: crypto.randomUUID() };
    pending.current = true;
    try {
      const result = await execute(
        task,
        action,
        { items },
        undefined,
        attempt.current.id,
      );
      if (result) onClose();
      else {
        bagQuery.invalidate();
        await refresh();
      }
    } finally {
      pending.current = false;
    }
  }
  const inventory = (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>
          随身物品 <span className="font-mono">{bag?.used ?? '—'} / 40</span>
        </span>
        <InkButton
          disabled={busy || loading}
          onClick={() => {
            void bagQuery.reload();
            void refresh();
          }}
        >
          刷新选物
        </InkButton>
      </div>
      <InventoryItems
        items={bag?.items ?? []}
        slotProps={(item) => ({
          disabled: !item || busy || loading || bagUnavailable,
          badge: item && !reasonFor(item) ? '可选' : undefined,
          selected: !!item && selections.some((s) => s.item.id === item.id),
          onQuickAction:
            item && !reasonFor(item) ? () => choose(item) : undefined,
          children: item
            ? (close) => (
                <div className="space-y-2">
                  {reasonFor(item) ? (
                    <p className="text-sm">{reasonFor(item)}</p>
                  ) : null}
                  <InkButton
                    disabled={
                      busy || loading || bagUnavailable || !!reasonFor(item)
                    }
                    onClick={() => {
                      choose(item);
                      close();
                    }}
                  >
                    选择／移出
                  </InkButton>
                </div>
              )
            : undefined,
        })}
      />
    </div>
  );
  return (
    <InkModal
      isOpen
      title={`移交 · ${task.presentation.title}`}
      className="max-w-5xl"
      onClose={() => {
        if (!busy && !pending.current) {
          if (bagOpen) setBagOpen(false);
          else onClose();
        }
      }}
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
          <p className="text-sm leading-7">
            {describeSectDeliveryRequirement(requirement)}
          </p>
          {loading ? <p className="text-sm">正在查验随身物品…</p> : null}
          {error || bagQuery.error ? (
            <InkNotice tone="warning">{error || bagQuery.error}</InkNotice>
          ) : null}
          <div className="lg:hidden">
            <InkButton
              disabled={busy || loading}
              onClick={() => setBagOpen(true)}
            >
              选择随身物品
            </InkButton>
          </div>
          {selections.map(({ item, quantity }) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-16 shrink-0">
                <ItemSlot item={item} className="w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{item.name}</p>
                <InkInput
                  label="交付数量"
                  type="number"
                  min={1}
                  max={Math.min(item.quantity, requirement.quantity)}
                  value={quantity}
                  disabled={busy}
                  onChange={(value) =>
                    setSelections((current) =>
                      current.map((s) =>
                        s.item.id === item.id ? { ...s, quantity: value } : s,
                      ),
                    )
                  }
                />
              </div>
              <InkButton disabled={busy} onClick={() => choose(item)}>
                移出
              </InkButton>
            </div>
          ))}
          <p className="text-ink-secondary text-sm">
            已选{' '}
            <span className="font-mono">
              {total} / {requirement.quantity}
            </span>
            ；超出最低要求不会增加奖励。
          </p>
          <div className="flex justify-end gap-3">
            <InkButton disabled={busy} onClick={onClose}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              disabled={busy || loading || !valid}
              pending={busy}
              onClick={() => void submit()}
            >
              确认交付
            </InkButton>
          </div>
        </div>
        <section className="hidden min-w-0 lg:block" aria-label="随身物品">
          {inventory}
        </section>
      </div>
      <InkDetailDrawer
        isOpen={bagOpen}
        onClose={() => setBagOpen(false)}
        title="随身物品"
        size="sm"
      >
        {inventory}
      </InkDetailDrawer>
    </InkModal>
  );
}
