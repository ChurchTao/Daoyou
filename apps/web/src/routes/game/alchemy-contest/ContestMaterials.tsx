import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { InkButton } from '@app/components/ui/InkButton';
import { InkQuantityInput } from '@app/components/ui/InkQuantityInput';
import type { ContestMaterialView } from '@daoyou/contracts/alchemy/contest';
import { useState } from 'react';
import type { ContestDraft, ContestSession } from './presentation';

function materialItem(material: ContestMaterialView, quantity: number) {
  const { name, rank, type, element, description } = material;
  return {
    definitionId: 'material.v1',
    name,
    quantity,
    instanceData: { name, rank, type, element, description },
  };
}

export function MaterialDoseAction({
  name,
  max,
  dose,
  confirm,
  remove,
  close,
}: {
  name: string;
  max: number;
  dose: number;
  confirm: (dose: number) => void;
  remove?: () => void;
  close: () => void;
}) {
  const [amount, setAmount] = useState(String(dose || 1));
  const parsed = Number(amount);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= max;
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        confirm(parsed);
        close();
      }}
    >
      <InkQuantityInput
        label={`${name}投入份量`}
        value={amount}
        onChange={setAmount}
        max={max}
        showLabel
        size="md"
      />
      <div className="flex flex-wrap gap-x-3">
        <InkButton variant="primary" type="submit" disabled={!valid}>
          {dose ? '调整份量' : '投入丹炉'}
        </InkButton>
        {remove && (
          <InkButton
            variant="secondary"
            onClick={() => {
              remove();
              close();
            }}
          >
            移出丹炉
          </InkButton>
        )}
      </div>
    </form>
  );
}

export function ContestMaterialRack({
  session,
  draft,
  locked,
  maxDose,
  setDose,
}: {
  session: ContestSession;
  draft: ContestDraft;
  locked: boolean;
  maxDose: (id: string) => number;
  setDose: (id: string, dose: number) => void;
}) {
  return (
    <>
      <p className="text-ink-secondary mb-3 text-sm leading-6">
        悬停或长按查看材料
      </p>
      <InventoryGrid className="grid-cols-4 sm:grid-cols-4 xl:grid-cols-4">
        {session.materials.map((material) => {
          const id = material.id;
          const quantity = session.remaining[id] ?? 0;
          const dose =
            draft.doses.find(({ materialId }) => materialId === id)?.dose ?? 0;
          const max = maxDose(id);
          const canAdd = !locked && dose < max;
          return (
            <ItemSlot
              key={id}
              item={materialItem(material, quantity)}
              selected={dose > 0}
              badge={dose ? `已投${dose}` : undefined}
              quantityLabel="库存"
              onQuickAction={canAdd ? () => setDose(id, dose + 1) : undefined}
              quickOnTouch={canAdd}
            >
              {locked || max <= 0
                ? () => (
                    <p className="text-ink-secondary">
                      {quantity === 0 ? '这味材料已用完。' : '本炉暂不能加料。'}
                    </p>
                  )
                : (close) => (
                    <MaterialDoseAction
                      key={dose}
                      name={material.name}
                      max={max}
                      dose={dose}
                      close={close}
                      confirm={(amount) => setDose(id, amount)}
                    />
                  )}
            </ItemSlot>
          );
        })}
      </InventoryGrid>
    </>
  );
}

export function ContestFurnaceSlots({
  session,
  draft,
  maxDose,
  setDose,
  openRack,
  locked,
  positions,
}: {
  session: ContestSession;
  draft: ContestDraft;
  maxDose: (id: string) => number;
  setDose: (id: string, dose: number) => void;
  openRack: () => void;
  locked: boolean;
  positions: [number, number][];
}) {
  return positions.map(([x, y], index) => {
    const selected = draft.doses[index];
    const material = session.materials.find(
      ({ id }) => id === selected?.materialId,
    );
    return (
      <div
        className="contest-ring-slot"
        style={{ left: `${x}%`, top: `${y}%` }}
        key={index}
      >
        <div
          key={material?.id ?? 'empty'}
          className={material ? 'contest-slot-arrive' : undefined}
        >
          <ItemSlot
            className="w-full"
            item={material ? materialItem(material, selected.dose) : undefined}
            emptyIcon="＋"
            emptyLabel="投入材料"
            quantityLabel="投入"
            onQuickAction={material ? () => setDose(material.id, 0) : openRack}
            disabled={locked}
            quickOnTouch
          >
            {material && !locked
              ? (close) => (
                  <MaterialDoseAction
                    key={selected.dose}
                    name={material.name}
                    max={maxDose(material.id)}
                    dose={selected.dose}
                    close={close}
                    confirm={(dose) => setDose(material.id, dose)}
                    remove={() => setDose(material.id, 0)}
                  />
                )
              : undefined}
          </ItemSlot>
        </div>
      </div>
    );
  });
}
