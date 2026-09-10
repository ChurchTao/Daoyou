import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkButton } from '@app/components/ui/InkButton';
import type { InventoryView } from '@shared/contracts/inventory';
import { compileDaoEquipmentSpecialLoadoutV1 } from '@shared/engine/combat-v6/equipment/compiler';
import type {
  DaoEquipmentInstanceV1,
  DaoEquipmentLoadoutV1,
  DaoEquipmentSlot,
} from '@shared/engine/combat-v6/equipment/types';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';

type Item = InventoryView['items'][number];
const columns: DaoEquipmentSlot[][] = [
  ['head', 'weapon', 'belt'],
  ['necklace', 'armor', 'footwear'],
];
const icons = {
  head: '👑',
  weapon: '⚔️',
  belt: '🎗️',
  necklace: '📿',
  armor: '🥋',
  footwear: '👢',
};

export function EquipmentAction({
  item,
  equipped,
  level,
  pending,
  onEquip,
}: {
  item: Item;
  equipped: Item[];
  level?: number;
  pending: boolean;
  onEquip: () => void;
}) {
  const loadout: DaoEquipmentLoadoutV1 = {};
  for (const entry of equipped) {
    const equipment = entry.instanceData as DaoEquipmentInstanceV1;
    if (entry.id !== item.id) loadout[equipment.slot] = equipment;
  }
  const equipment = item.instanceData as DaoEquipmentInstanceV1;
  if (!item.equipped) loadout[equipment.slot] = equipment;
  const result =
    level === undefined
      ? undefined
      : compileDaoEquipmentSpecialLoadoutV1(loadout, level);
  const reason =
    result && !result.ok
      ? result.diagnostics.find((d) => d.severity === 'error')?.message
      : undefined;
  return (
    <div className="space-y-2">
      {reason ? <p className="text-ink-secondary text-xs">{reason}</p> : null}
      <InkButton disabled={pending || !result || !result.ok} onClick={onEquip}>
        {item.equipped
          ? '卸下'
          : equipped.some(
                (entry) =>
                  (entry.instanceData as DaoEquipmentInstanceV1).slot ===
                  equipment.slot,
              )
            ? '替换当前道装'
            : '装备'}
      </InkButton>
    </div>
  );
}

export function EquipmentRack({
  items,
  gender,
  pending,
  level,
  onSlot,
  onUnequip,
}: {
  items: Item[];
  gender?: '男' | '女';
  pending: boolean;
  level?: number;
  onSlot: (slot: DaoEquipmentSlot) => void;
  onUnequip: (item: Item) => Promise<void>;
}) {
  const bySlot = new Map(
    items.map((item) => [
      (item.instanceData as DaoEquipmentInstanceV1).slot,
      item,
    ]),
  );
  return (
    <section
      aria-label="已穿戴道装"
      className="border-ink/15 min-w-0 border-b pb-4 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0"
    >
      <div className="relative mx-auto grid h-64 max-w-80 grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-2 lg:h-[30rem] lg:max-w-none lg:grid-cols-[6rem_minmax(0,1fr)_6rem]">
        {gender ? (
          <img
            src={`/assets/inventory/cultivator-${gender === '女' ? 'female' : 'male'}-ink.webp`}
            alt=""
            width={640}
            height={960}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-65"
          />
        ) : null}
        {columns.map((slots, column) => (
          <div
            key={column}
            className={`relative z-10 grid gap-3 lg:gap-10 ${column === 1 ? 'col-start-3' : ''}`}
          >
            {slots.map((slot) => {
              const item = bySlot.get(slot);
              return (
                <div key={slot}>
                  <ItemSlot
                    item={item}
                    emptyLabel={EQUIPMENT_SLOT_NAMES[slot]}
                    emptyIcon={icons[slot]}
                    disabled={pending}
                    badge={item ? '穿' : undefined}
                    className="block w-full"
                    onQuickAction={!item ? () => onSlot(slot) : undefined}
                  >
                    {item
                      ? (close) => (
                          <EquipmentAction
                            item={item}
                            equipped={items}
                            level={level}
                            pending={pending}
                            onEquip={() => {
                              close();
                              void onUnequip(item);
                            }}
                          />
                        )
                      : undefined}
                  </ItemSlot>
                  <p
                    aria-hidden={!item}
                    className={`text-ink-secondary mt-1 hidden h-4 text-center text-xs leading-4 lg:block ${item ? '' : 'invisible'}`}
                  >
                    {EQUIPMENT_SLOT_NAMES[slot]}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
