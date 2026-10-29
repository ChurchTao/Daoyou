import {
  inventoryFilterActive,
  matchesInventoryFilters,
  type InventoryFilter,
} from '@app/components/feature/items/inventoryFilterModel';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout/InkModal';
import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkQuantityInput } from '@app/components/ui/InkQuantityInput';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import {
  MAX_CRAFT_MATERIAL_QUANTITY,
  type ItemGrant,
} from '@daoyou/game-domain/inventory';
import type { InscriptionRequest } from '@daoyou/contracts/inscriptions';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { daoFormationInscriptionOf } from '@daoyou/game-content/equipment/base';
import { daoFormationMaxLevel } from '@daoyou/game-rules/equipment/projection';
import type { DaoFormationInscriptionStateV1 } from '@daoyou/game-domain/equipment';
import { type InscriptionDrawPreview, type InscriptionMaterialRef, type InscriptionRef } from '@daoyou/game-domain/inscriptions';
import { inscriptionMaterialProblem, MAX_INSCRIPTION_STRENGTHEN_TIMES, prepareInscriptionDraw, prepareInscriptionSockets, prepareInscriptionStrengthen, type InscriptionSocketStep } from '@daoyou/game-rules/inscriptions/rules';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import { EQUIPMENT_ATTRIBUTE_NAMES } from '@daoyou/game-domain/equipment';
import { InventoryEquipmentSchema } from '@daoyou/game-rules/inventory/equipment';
import {
  INSCRIPTION_DRAW_MAX_LEVEL,
  INSCRIPTION_MAX_LEVEL,
  inscriptionItemId,
} from '@daoyou/game-content/items/inscriptions';
import { cn } from '@app/lib/cn';
import { useEffect, useState } from 'react';
import { CraftInventoryPanel } from '../items/CraftInventoryPanel';
import { InventoryItems } from '../items/InventoryItems';
import { ItemSlot } from '../items/ItemSlot';
import type { DisplayItem } from '../items/presentation/types.js';
import { useInscriptionSession } from './useInscriptionSession';

type Item = InventoryView['items'][number];
type Tab = 'draw' | 'strengthen' | 'engrave';
const modes = [
  { value: 'draw', label: '绘制' },
  { value: 'strengthen', label: '合成' },
  { value: 'engrave', label: '烙印' },
];
const positions = [
  'left-[12%] top-[23%]',
  'left-[88%] top-[23%]',
  'left-[12%] top-[72%]',
  'left-[88%] top-[72%]',
];
const emptyMaterials = (): (InscriptionMaterialRef | null)[] => [
  null,
  null,
  null,
  null,
];
const refOf = (item: Item): InscriptionRef => ({
  id: item.id,
  revision: item.revision,
});
function formationText(value: DaoFormationInscriptionStateV1 | null) {
  if (!value) return '空孔';
  const pattern = daoFormationInscriptionOf(value.patternId)!;
  return `${pattern.name} · ${value.level}级 · ${EQUIPMENT_ATTRIBUTE_NAMES[pattern.attr]} +${pattern.valuePerLevel * value.level}`;
}
type SocketDraft = {
  inscription?: InscriptionRef;
  action: 'engrave' | 'strengthen_socket';
};
const emptySockets = (): [SocketDraft, SocketDraft] => [
  { action: 'engrave' },
  { action: 'engrave' },
];

function drawOutputText(preview: InscriptionDrawPreview) {
  const summary = preview.outputs
    .map((output) => `${output.level}级 ×${output.quantity}`)
    .join('、');
  return `预计产出 ${summary}，类型随机`;
}

function MaterialDoseForm({
  name,
  placed,
  max,
  disabled,
  onSubmit,
}: {
  name: string;
  placed?: number;
  max: number;
  disabled: boolean;
  onSubmit: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(String(placed ?? 1));
  const amount = Number(quantity);
  const valid =
    quantity !== '' &&
    Number.isInteger(amount) &&
    amount >= 1 &&
    amount <= max;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || disabled) return;
        onSubmit(amount);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>投入份量</span>
        <InkQuantityInput
          label={`${name}投入份量`}
          value={quantity}
          onChange={setQuantity}
          max={max}
          disabled={disabled}
        />
      </div>
      <InkButton type="submit" disabled={disabled || !valid}>
        {placed ? '调整份量' : '投入绘阵'}
      </InkButton>
    </form>
  );
}

function GrantItems({ grants }: { grants: ItemGrant[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {grants.map((grant) => (
        <ItemSlot
          key={grant.definitionId}
          item={{
            ...grant,
            name: itemDefinition(grant.definitionId).name,
            instanceData: null,
          }}
          quantityLabel="产出"
        />
      ))}
    </div>
  );
}

export function InscriptionRoom({ ownerId }: { ownerId: string }) {
  const session = useInscriptionSession(ownerId);
  const [tab, setTab] = useState<Tab>('draw');
  const [materials, setMaterials] = useState(emptyMaterials);
  const [pair, setPair] = useState<(InscriptionRef | null)[]>([null, null]);
  const [strengthenTimes, setStrengthenTimes] = useState(1);
  const [activeSlot, setActiveSlot] = useState(0);
  const [equipmentRef, setEquipmentRef] = useState<InscriptionRef>();
  const [sockets, setSockets] = useState(emptySockets);
  const [picker, setPicker] = useState<'equipment' | 'inscription'>(
    'equipment',
  );
  const [bagOpen, setBagOpen] = useState(false);
  const [source, setSource] = useState<'bag' | 'storage'>('bag');
  const [filter, setFilter] = useState<InventoryFilter>({ kind: 'material' });
  const storage = useCraftStorage(filter, source === 'storage');
  const [chosenItems, setChosenItems] = useState<Map<string, Item>>(new Map());
  const [selectionError, setSelectionError] = useState('');
  const [confirmation, setConfirmation] = useState<{
    input: InscriptionRequest;
    lines: string[];
    warning?: string;
  }>();
  const inventory = session.bag.data;
  useEffect(() => {
    if (session.result?.action === 'inscribe') setSockets(emptySockets());
  }, [session.result]);
  const pickerView = source === 'bag' ? inventory : storage.view;
  const pickerError = source === 'bag' ? session.bag.error : storage.error;
  const pickerLocked =
    session.locked ||
    !pickerView ||
    (source === 'storage' && storage.loading) ||
    !!pickerError;
  const items = [
    ...chosenItems.values(),
    ...(inventory?.items ?? []),
    ...(inventory?.equippedItems ?? []),
    ...(storage.view?.items ?? []),
  ];
  const byId = new Map(items.map((item) => [item.id, item]));
  const equipmentItem = equipmentRef ? byId.get(equipmentRef.id) : undefined;
  const equipment = equipmentItem
    ? InventoryEquipmentSchema.parse(equipmentItem.instanceData)
    : undefined;
  const live = (ref: InscriptionRef | null | undefined) =>
    ref ? byId.get(ref.id) : undefined;
  let draw: InscriptionDrawPreview | undefined;
  let strengthenGrant: { name: string; level: number; quantity: number } | undefined;
  let socketLines: string[] = [];
  let input: InscriptionRequest | undefined;
  let problem: string | null = session.view?.blockedReason ?? null;
  const maxTimes = (() => {
    const first = live(pair[0]);
    const second = live(pair[1]);
    if (!first || !second || first.definitionId !== second.definitionId)
      return 0;
    const available =
      first.id === second.id
        ? Math.floor(first.quantity / 2)
        : Math.min(first.quantity, second.quantity);
    return Math.min(MAX_INSCRIPTION_STRENGTHEN_TIMES, available);
  })();
  const times = Math.min(Math.max(1, strengthenTimes), Math.max(1, maxTimes));
  try {
    if (tab === 'draw') {
      const refs = materials.flatMap((ref) => {
        const item = live(ref);
        if (!ref || !item) return [];
        const quantity = Math.min(
          ref.quantity,
          item.quantity,
          MAX_CRAFT_MATERIAL_QUANTITY,
        );
        return quantity >= 1
          ? [{ id: item.id, revision: item.revision, quantity }]
          : [];
      });
      if (!refs.length) problem ??= '放入材料，开始绘阵';
      else {
        draw = prepareInscriptionDraw(items, refs).preview;
        input = {
          action: 'draw',
          requestId: '',
          materials: refs,
          expectedCost: draw.cost,
          expectedTenths: draw.totalTenths,
        };
      }
    } else if (tab === 'strengthen') {
      const first = live(pair[0]);
      const second = live(pair[1]);
      if (!first || !second) problem ??= '放入两枚同种同级阵纹';
      else if (maxTimes < 1) problem ??= '同种同级阵纹不足两枚';
      else {
        const refs: InscriptionMaterialRef[] =
          first.id === second.id
            ? [{ id: first.id, revision: first.revision, quantity: times * 2 }]
            : [
                { id: first.id, revision: first.revision, quantity: times },
                { id: second.id, revision: second.revision, quantity: times },
              ];
        const plan = prepareInscriptionStrengthen(items, refs);
        const definition = itemDefinition(plan.grant.definitionId);
        strengthenGrant = {
          name: definition.name,
          level: definition.kind === 'inscription' ? definition.level! : times,
          quantity: plan.grant.quantity,
        };
        input = {
          action: 'strengthen',
          requestId: '',
          inscriptions: refs,
          expectedCost: plan.cost,
        };
      }
    } else if (!equipment || !equipmentItem)
      problem ??= '选择道装，再把阵纹放入孔位';
    else {
      const steps = ([0, 1] as const).flatMap((index) => {
        const draft = sockets[index];
        const inscription = live(draft.inscription);
        if (!inscription) return [];
        const old = equipment.formationInscriptions[index];
        const definition = itemDefinition(inscription.definitionId);
        const level =
          definition.kind === 'inscription' ? definition.level! : 0;
        socketLines.push(
          draft.action === 'strengthen_socket' && old
            ? `第${index + 1}孔合成至 ${old.level + 1}级`
            : old
              ? `第${index + 1}孔覆盖为 ${definition.name} · ${level}级`
              : `第${index + 1}孔烙印 ${definition.name} · ${level}级`,
        );
        return [
          {
            socket: index,
            inscription: { id: inscription.id, revision: inscription.revision },
            mode: draft.action,
            replace: draft.action === 'engrave' && !!old,
          },
        ];
      });
      if (!steps.length) problem ??= '两个孔可以一次烙印';
      else {
        const ruleSteps: InscriptionSocketStep[] = steps.map((step) => ({
          socket: step.socket,
          inscription: step.inscription,
          action: step.mode,
          replace: step.replace,
        }));
        const plan = prepareInscriptionSockets(
          items,
          { id: equipmentItem.id, revision: equipmentItem.revision },
          ruleSteps,
        );
        input = {
          action: 'inscribe',
          requestId: '',
          equipment: { id: equipmentItem.id, revision: equipmentItem.revision },
          steps,
          expectedCost: plan.cost,
        };
      }
    }
  } catch (error) {
    problem ??= error instanceof Error ? error.message : '请重新选择物品';
  }
  if (input && session.view) {
    if (session.view.qi < input.expectedCost.qi) problem ??= '天地灵气不足';
    if (session.view.spiritStones < input.expectedCost.spiritStones)
      problem ??= '灵石不足';
  }
  function openBag(target?: 'equipment' | 'inscription') {
    if (target) {
      setPicker(target);
      setFilter({ kind: target });
    }
    if (window.matchMedia('(max-width: 767px)').matches) setBagOpen(true);
    else document.getElementById('inscription-materials')?.focus();
  }
  function itemProblem(item: Item): string | null {
    if (tab === 'draw') return inscriptionMaterialProblem(item);
    const def = itemDefinition(item.definitionId);
    if (tab === 'engrave' && picker === 'equipment')
      return def.kind === 'equipment' ? null : '请选择道装';
    if (def.kind !== 'inscription') return '请选择阵纹';
    if (tab === 'strengthen') {
      if (def.level === INSCRIPTION_MAX_LEVEL) return '已达最高等级';
      const firstRef = pair.find((ref) => ref !== null && live(ref));
      const first = firstRef ? live(firstRef) : undefined;
      if (first && first.definitionId !== item.definitionId)
        return '需同种同级阵纹';
      if (pair.filter((ref) => ref?.id === item.id).length >= item.quantity)
        return '可用数量不足';
    }
    if (tab === 'engrave' && !equipment) return '请先放入道装';
    if (tab === 'engrave' && equipment) {
      const pattern = daoFormationInscriptionOf(def.patternId!)!;
      if (!pattern.allowedSlots.includes(equipment.slot))
        return '不适用于此部位';
      if (def.level! > daoFormationMaxLevel(equipment.equipmentLevel))
        return '超过每孔等级上限';
      const draft = sockets[activeSlot as 0 | 1] ?? sockets[0];
      const used = sockets.filter(
        (slot, index) =>
          index !== activeSlot && slot.inscription?.id === item.id,
      ).length;
      if (used >= item.quantity) return '可用数量不足';
      if (draft.action === 'strengthen_socket') {
        const old = equipment.formationInscriptions[activeSlot as 0 | 1];
        if (!old || old.patternId !== def.patternId || old.level !== def.level)
          return '需与孔内阵纹同种同级';
        if (old.level >= daoFormationMaxLevel(equipment.equipmentLevel))
          return '此孔已达等级上限';
      }
    }
    return null;
  }
  function remember(item: Item) {
    setChosenItems((current) => new Map(current).set(item.id, item));
  }
  function placeMaterial(item: Item, quantity: number, closeDrawer: boolean) {
    if (pickerLocked) return;
    const reason = itemProblem(item);
    if (reason) {
      setSelectionError(reason);
      return;
    }
    const max = Math.min(item.quantity, MAX_CRAFT_MATERIAL_QUANTITY);
    const amount = Math.min(max, Math.floor(quantity));
    if (!Number.isInteger(amount) || amount < 1) {
      setSelectionError(`每个材料格最多投入 ${MAX_CRAFT_MATERIAL_QUANTITY} 份`);
      return;
    }
    const occupied = (ref: InscriptionMaterialRef | null) => {
      const item = live(ref);
      return !!ref && !!item && ref.quantity >= 1 && item.quantity >= 1;
    };
    const existing = materials.findIndex(
      (ref) => ref?.id === item.id && occupied(ref),
    );
    const index =
      existing >= 0
        ? existing
        : !occupied(materials[activeSlot])
          ? activeSlot
          : materials.findIndex((ref) => !occupied(ref));
    if (index < 0) {
      setSelectionError('四个材料格已满，请先移出材料');
      return;
    }
    setSelectionError('');
    setMaterials((old) =>
      old.map((ref, i) => (i === index ? { ...refOf(item), quantity: amount } : ref)),
    );
    remember(item);
    if (closeDrawer) setBagOpen(false);
  }
  function choose(item: Item) {
    if (pickerLocked) return;
    if (tab === 'draw') {
      const placed =
        materials.find((ref) => ref?.id === item.id && live(ref))?.quantity ??
        0;
      placeMaterial(item, placed + 1, false);
      return;
    }
    const reason = itemProblem(item);
    if (reason) {
      setSelectionError(reason);
      return;
    }
    setSelectionError('');
    if (tab === 'strengthen') {
      const occupied = (ref: InscriptionRef | null) => !!live(ref);
      const index = !occupied(pair[activeSlot])
        ? activeSlot
        : pair.findIndex((ref) => !occupied(ref));
      if (index < 0) {
        setSelectionError('请先移出一枚阵纹');
        return;
      }
      setStrengthenTimes(1);
      setPair((old) => old.map((ref, i) => (i === index ? refOf(item) : ref)));
    } else if (picker === 'equipment') {
      setEquipmentRef(refOf(item));
      setSockets(emptySockets());
      setActiveSlot(0);
      setPicker('inscription');
      setFilter({ kind: 'inscription' });
    } else {
      const index = activeSlot === 1 ? 1 : 0;
      setSockets((old) =>
        old.map((slot, i) =>
          i === index ? { ...slot, inscription: refOf(item) } : slot,
        ) as [SocketDraft, SocketDraft],
      );
    }
    remember(item);
    setBagOpen(false);
  }
  function confirm() {
    if (!input || problem || session.locked) return;
    const lines: string[] = [];
    let warning: string | undefined;
    const describe = (ref: InscriptionRef, quantity: number) => {
      const item = byId.get(ref.id);
      const location = item?.location === 'storage' ? '储藏室' : '储物袋';
      const definition = item && itemDefinition(item.definitionId);
      const level =
        definition?.kind === 'inscription' ? ` · ${definition.level}级` : '';
      return `${location} · ${item?.name}${level} ×${quantity}`;
    };
    if (input.action === 'draw') {
      lines.push(...input.materials.map((ref) => describe(ref, ref.quantity)));
      if (draw) lines.push(drawOutputText(draw));
      if (draw?.remainderTenths)
        warning = '本次投入含有无法成纹的余料，将一并消耗。';
    } else if (input.action === 'strengthen') {
      lines.push(
        ...input.inscriptions.map((ref) => describe(ref, ref.quantity)),
      );
      if (strengthenGrant)
        lines.push(
          `得到 ${strengthenGrant.name} · ${strengthenGrant.level}级 ×${strengthenGrant.quantity}`,
        );
    } else if (input.action === 'inscribe') {
      lines.push(
        `${equipmentItem!.location === 'storage' ? '储藏室' : equipmentItem!.location === 'equipped' ? '已穿戴' : '储物袋'} · ${equipmentItem!.name}`,
        ...socketLines,
        ...input.steps.map(
          (step) => `消耗：${describe(step.inscription, 1)}`,
        ),
      );
      if (input.steps.some((step) => step.replace))
        warning = '覆盖后旧阵纹消失，不会返还。';
    } else {
      lines.push(
        `${equipmentItem!.location === 'storage' ? '储藏室' : equipmentItem!.location === 'equipped' ? '已穿戴' : '储物袋'} · ${equipmentItem!.name}`,
      );
    }
    setConfirmation({
      input: { ...input, requestId: crypto.randomUUID() },
      lines,
      warning,
    });
  }
  function dismissResult() {
    setSelectionError('');
    session.continueWork();
  }
  const materialPicker = (
    <CraftInventoryPanel
      source={source}
      onSource={(value) => {
        if (value === 'storage') storage.reload();
        setSource(value);
      }}
      view={pickerView}
      loading={source === 'bag' ? session.bag.isRefreshing : storage.loading}
      error={pickerError}
      filter={filter}
      onFilter={(value) => {
        setFilter(value);
        storage.setPage(0);
      }}
      onPage={storage.setPage}
      onReload={() => {
        if (source === 'bag') session.reload();
        else storage.reload();
      }}
    >
      {tab === 'draw' && draw && (
        <p className="text-xs">
          {drawOutputText(draw)}
          {draw.remainderTenths > 0 ? '。余料会一并消耗' : ''}
        </p>
      )}
      {tab === 'engrave' && (
        <p className="text-ink-secondary text-xs">
          {picker === 'equipment'
            ? '选择道装'
            : `选择第${activeSlot + 1}孔的阵纹。两个孔可以一次烙印。`}
        </p>
      )}
      {tab === 'engrave' &&
        picker === 'equipment' &&
        !!inventory?.equippedItems.length && (
          <div className="space-y-2">
            <p className="text-ink-secondary text-xs">已穿戴</p>
            <div className="grid grid-cols-3 gap-2">
              {inventory.equippedItems.map((item) => (
                <ItemSlot
                  key={item.id}
                  item={item}
                  disabled={pickerLocked}
                  onQuickAction={() => choose(item)}
                  quickOnTouch
                >
                  {(close) => (
                    <InkButton
                      disabled={pickerLocked}
                      onClick={() => {
                        choose(item);
                        close();
                      }}
                    >
                      选择道装
                    </InkButton>
                  )}
                </ItemSlot>
              ))}
            </div>
          </div>
        )}
      <InventoryItems
        items={
          source === 'bag' && inventoryFilterActive(filter)
            ? (pickerView?.items ?? []).filter((item) =>
                matchesInventoryFilters(item, filter),
              )
            : (pickerView?.items ?? [])
        }
        location={source}
        compact={source === 'bag' && inventoryFilterActive(filter)}
        quickTouchHint
        slotProps={(item) => {
          const reason = item ? itemProblem(item) : null;
          const placed =
            tab === 'draw' && item
              ? materials.find((ref) => ref?.id === item.id && live(ref))
                  ?.quantity
              : undefined;
          return {
            disabled: pickerLocked || !!reason,
            quickOnTouch: true,
            badge: placed
              ? `已投${placed}`
              : item && !reason
                ? '可选'
                : undefined,
            onQuickAction: item ? () => choose(item) : undefined,
            children: item
              ? (close) => (
                  <>
                    {reason && <p className="text-ink-secondary">{reason}</p>}
                    {tab === 'draw' && !reason ? (
                      <MaterialDoseForm
                        key={placed ?? 0}
                        name={item.name}
                        placed={placed}
                        max={Math.min(
                          item.quantity,
                          MAX_CRAFT_MATERIAL_QUANTITY,
                        )}
                        disabled={pickerLocked}
                        onSubmit={(quantity) => {
                          placeMaterial(item, quantity, true);
                          close();
                        }}
                      />
                    ) : (
                      <InkButton
                        disabled={pickerLocked || !!reason}
                        onClick={() => {
                          choose(item);
                          close();
                        }}
                      >
                        选择
                      </InkButton>
                    )}
                  </>
                )
              : undefined,
          };
        }}
      />
    </CraftInventoryPanel>
  );
  const operationLabel =
    tab === 'draw'
      ? '绘制阵纹'
      : tab === 'strengthen' ||
          sockets.some((slot) => slot.action === 'strengthen_socket' && slot.inscription)
        ? '合成阵纹'
        : input?.action === 'inscribe' && input.steps.length === 2
          ? '烙印两孔'
          : input?.action === 'inscribe' && input.steps.some((step) => step.replace)
            ? '覆盖烙印'
            : '烙印阵纹';
  type BoardSlot = {
    label: string;
    position: string;
    item?: DisplayItem;
    selected?: boolean;
    disabled?: boolean;
    badge?: string;
    actionLabel?: string;
    choose: () => void;
    merge?: () => void;
  };
  function selectSocket(index: 0 | 1, action: 'engrave' | 'strengthen_socket') {
    setActiveSlot(index);
    setSockets((old) =>
      old.map((slot, i) =>
        i === index
          ? slot.action === action
            ? slot
            : { action, inscription: undefined }
          : slot,
      ) as [SocketDraft, SocketDraft],
    );
    setSelectionError('');
    openBag('inscription');
  }
  const boardSlots: BoardSlot[] =
    tab === 'draw'
      ? materials.map((ref, index) => {
          const item = live(ref);
          const quantity =
            ref && item ? Math.min(ref.quantity, item.quantity) : 0;
          return {
            label: '放入材料',
            position: positions[index],
            item: item && quantity > 0 ? { ...item, quantity } : undefined,
            choose: () => {
              setActiveSlot(index);
              if (item)
                setMaterials((old) =>
                  old.map((ref, i) => (i === index ? null : ref)),
                );
              else openBag();
            },
          };
        })
      : tab === 'strengthen'
        ? pair.map((ref, index) => {
            const item = ref ? byId.get(ref.id) : undefined;
            return {
              label: '放入阵纹',
              position:
                index === 0 ? 'left-[23%] top-[46%]' : 'left-[77%] top-[46%]',
              item: item ? { ...item, quantity: 1 } : undefined,
              choose: () => {
                setActiveSlot(index);
                if (item)
                  setPair((old) =>
                    old.map((ref, i) => (i === index ? null : ref)),
                  );
                else openBag();
              },
            };
          })
        : [
            {
              label: '放入道装',
              position: 'left-[50%] top-[22%]',
              item: equipmentItem,
              selected: picker === 'equipment',
              actionLabel: '更换道装',
              choose: () => openBag('equipment'),
            },
            ...([0, 1] as const).map((index): BoardSlot => {
              const old = equipment?.formationInscriptions[index];
              const draft = sockets[index];
              const incoming = live(draft.inscription);
              const definitionId = old
                ? inscriptionItemId(old.patternId, old.level)
                : undefined;
              return {
                label: `第${index + 1}孔`,
                position:
                  index === 0 ? 'left-[23%] top-[68%]' : 'left-[77%] top-[68%]',
                item: incoming
                  ? { ...incoming, quantity: 1 }
                  : definitionId
                    ? {
                        definitionId,
                        name: itemDefinition(definitionId).name,
                        quantity: 1,
                        instanceData: null,
                      }
                    : undefined,
                disabled: !equipment,
                selected:
                  !!equipment &&
                  picker === 'inscription' &&
                  activeSlot === index,
                badge: incoming
                  ? draft.action === 'strengthen_socket'
                    ? '待合成'
                    : '待烙印'
                  : undefined,
                actionLabel: incoming ? '移出待用阵纹' : '放入阵纹',
                choose: () => {
                  if (incoming) {
                    setSockets((current) =>
                      current.map((slot, i) =>
                        i === index
                          ? { action: 'engrave', inscription: undefined }
                          : slot,
                      ) as [SocketDraft, SocketDraft],
                    );
                    return;
                  }
                  selectSocket(index, 'engrave');
                },
                merge:
                  old &&
                  !incoming &&
                  old.level < daoFormationMaxLevel(equipment!.equipmentLevel)
                    ? () => selectSocket(index, 'strengthen_socket')
                    : undefined,
              };
            }),
          ];
  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-5 text-sm">
        <p className="text-ink-secondary leading-6">
          研材入墨，运笔成纹。以灵材绘阵，将阵纹烙入随身道装。
        </p>
        {(session.error || selectionError) && (
          <p role="alert" className="text-crimson">
            {selectionError || session.error}{' '}
            <InkButton
              disabled={session.pending}
              onClick={() => {
                setSelectionError('');
                session.reload();
              }}
            >
              重新核对
            </InkButton>
          </p>
        )}
        {session.unresolved && !session.pending && (
          <div role="status" className="space-y-2">
            <p>有一次操作尚待核对，请先确认本次结果。</p>
            <InkButton onClick={() => void session.submit()}>
              核对本次结果
            </InkButton>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-4">
            {session.result && (
              <div className="space-y-3" aria-live="polite">
                <p className="text-teal">
                  {session.result.action === 'draw'
                    ? '阵纹已成，优先收入储物袋，满时存入储藏室。'
                    : session.result.action === 'strengthen'
                      ? '合成完成，产物优先入袋，满时存入储藏室。可以继续合成。'
                      : '孔位已更新，可以继续烙印。'}
                </p>
                {!!session.result.grants.length && (
                  <GrantItems grants={session.result.grants} />
                )}
                <p className="text-ink-secondary text-xs">
                  本次消耗{' '}
                  <span className="font-mono">{session.result.cost.qi}</span>{' '}
                  天地灵气 ·{' '}
                  <SpiritStones amount={session.result.cost.spiritStones} />
                </p>
                <InkButton onClick={dismissResult}>知道了</InkButton>
              </div>
            )}
            <>
                <fieldset
                  className="mx-auto flex w-fit gap-1"
                  aria-label="阵纹操作方式"
                >
                  <legend className="sr-only">阵纹操作方式</legend>
                  {modes.map((mode) => (
                    <label key={mode.value} className="cursor-pointer">
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="inscription-mode"
                        value={mode.value}
                        checked={tab === mode.value}
                        disabled={session.locked}
                        onChange={() => {
                          setTab(mode.value as Tab);
                          setFilter({
                            kind:
                              mode.value === 'draw'
                                ? 'material'
                                : mode.value === 'strengthen'
                                  ? 'inscription'
                                  : 'equipment',
                          });
                          setActiveSlot(0);
                          setSelectionError('');
                        }}
                      />
                      <span className="border-ink/20 text-ink-secondary peer-checked:border-crimson/50 peer-checked:text-crimson peer-checked:bg-crimson/5 peer-focus-visible:outline-ink block rounded border px-5 py-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50">
                        {mode.label}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div
                  className="relative mx-auto aspect-square w-full max-w-lg"
                  aria-label={`${modes.find((mode) => mode.value === tab)!.label}操作台`}
                >
                  <GameImage
                    src="/assets/inscriptions/drawing-board.webp"
                    alt="笔砚与水墨绘阵盘"
                    width={960}
                    height={960}
                    className="pointer-events-none absolute inset-[6%] size-[88%] object-contain"
                    draggable={false}
                  />
                  {boardSlots.map((slot, index) => (
                    <div
                      key={`${tab}-${index}`}
                      className={cn(
                        'absolute w-[23%] -translate-x-1/2 -translate-y-1/2',
                        slot.position,
                      )}
                      role="group"
                      aria-label={slot.label}
                    >
                      <ItemSlot
                        item={slot.item}
                        className="w-full"
                        quantityLabel="投入"
                        emptyLabel={slot.label}
                        emptyIcon="＋"
                        selected={slot.selected}
                        badge={slot.badge}
                        disabled={session.locked || slot.disabled}
                        onQuickAction={slot.choose}
                        quickOnTouch
                      >
                        {slot.item
                          ? (close) => (
                              <div className="flex flex-wrap gap-3">
                                {tab === 'draw' && (
                                  <div className="flex w-full flex-wrap items-center gap-2 text-sm">
                                    <span>投入数量</span>
                                    <InkQuantityInput
                                      label={`第${index + 1}格投入数量`}
                                      max={Math.min(
                                        byId.get(materials[index]!.id)!.quantity,
                                        MAX_CRAFT_MATERIAL_QUANTITY,
                                      )}
                                      value={materials[index]!.quantity}
                                      disabled={session.locked}
                                      onChange={(value) => {
                                        const quantity = Number(value);
                                        if (!Number.isInteger(quantity) || quantity < 1)
                                          return;
                                        setMaterials((old) =>
                                          old.map((ref, i) =>
                                            i === index && ref
                                              ? { ...ref, quantity }
                                              : ref,
                                          ),
                                        );
                                      }}
                                    />
                                  </div>
                                )}
                                <InkButton
                                  disabled={session.locked || slot.disabled}
                                  onClick={() => {
                                    slot.choose();
                                    close();
                                  }}
                                >
                                  {slot.actionLabel ?? '移出'}
                                </InkButton>
                                {slot.merge && (
                                  <InkButton
                                    disabled={session.locked}
                                    onClick={() => {
                                      slot.merge!();
                                      close();
                                    }}
                                  >
                                    孔内合成
                                  </InkButton>
                                )}
                              </div>
                            )
                          : undefined}
                      </ItemSlot>
                      {tab === 'engrave' && index > 0 && slot.item && (
                        <p className="bg-paper/90 mt-1 text-center text-xs">
                          第{index}孔
                        </p>
                      )}
                    </div>
                  ))}
                  {session.pending && (
                    <p
                      role="status"
                      className="absolute inset-x-[29%] top-[45%] text-center"
                    >
                      运转阵盘……
                    </p>
                  )}
                </div>
                <footer className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="space-y-1 text-xs">
                    {draw && (
                      <p>
                        {drawOutputText(draw)}
                        {draw.remainderTenths > 0 ? '。余料会一并消耗' : ''}
                      </p>
                    )}
                    {strengthenGrant && (
                      <p>
                        合成后得到 {strengthenGrant.name} · {strengthenGrant.level}
                        级 ×
                        <span className="font-mono">
                          {strengthenGrant.quantity}
                        </span>
                      </p>
                    )}
                    {tab === 'strengthen' && maxTimes > 1 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>合成次数</span>
                        <InkQuantityInput
                          label="合成次数"
                          max={maxTimes}
                          value={times}
                          disabled={session.locked}
                          onChange={(value) => {
                            const next = Number(value);
                            if (Number.isInteger(next)) setStrengthenTimes(next);
                          }}
                        />
                      </div>
                    )}
                    {!!socketLines.length && <p>{socketLines.join('；')}</p>}
                    {input && (
                      <p>
                        <span className="font-mono">
                          {input.expectedCost.qi}
                        </span>{' '}
                        天地灵气 ·{' '}
                        <SpiritStones amount={input.expectedCost.spiritStones} />
                      </p>
                    )}
                    <p className="text-ink-secondary" role="status">
                      {session.pending
                        ? '正在处理……'
                        : !session.view
                          ? '正在核对资源……'
                          : problem}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <InkButton
                      className="md:hidden"
                      disabled={session.locked}
                      onClick={() => openBag()}
                    >
                      选择物品
                    </InkButton>
                    <InkButton
                      variant="primary"
                      pending={session.pending}
                      disabled={session.locked || !!problem || !input}
                      onClick={confirm}
                    >
                      {operationLabel}
                    </InkButton>
                  </div>
                </footer>
            </>
          </section>
          <aside
            id="inscription-materials"
            tabIndex={-1}
            className="border-ink/10 hidden min-w-0 border-l pl-5 focus-visible:outline-none md:block"
          >
            {materialPicker}
          </aside>
        </div>
        <details className="border-ink/10 border-t pt-3 text-xs leading-6">
          <summary className="text-ink-secondary cursor-pointer">
            绘阵之理
          </summary>
          <div className="text-ink-secondary mt-3 space-y-2">
            <p>
              矿石、妖兽材料、辅助材料、天材地宝均可入墨。每4份绘成一级阵纹，高一级所需份数变为三倍，优先绘成高等级阵纹，最高{INSCRIPTION_DRAW_MAX_LEVEL}级。天地灵气按投入份数开方计，最少1点、最多40点，四件神品天材地宝正好40点；每1份消耗1灵石，均向上取整，余料也计入费用。只产出主产物和副产物两个等级，其余材料溢散。
            </p>
            <p>
              九种阵纹等概率独立生成。同种同级按两枚一组合成，单次最多{MAX_INSCRIPTION_STRENGTHEN_TIMES}次，绘制与合成均必定成功，最高{INSCRIPTION_MAX_LEVEL}级，合成费用仍逐级翻倍。两个孔可以一次烙印。阵纹适用部位及等级须符合道装孔上限。
            </p>
            <p>
              已烙印阵纹可消耗储物袋或储藏室中同种同级阵纹进行孔内合成。阵纹不能拆卸，覆盖时旧阵纹不返还。产出优先入袋，满时存入储藏室。
            </p>
          </div>
        </details>
        <InkDetailDrawer
          isOpen={bagOpen}
          title="选择物品"
          onClose={() => setBagOpen(false)}
          size="md"
        >
          {materialPicker}
        </InkDetailDrawer>
        <InkModal
          isOpen={!!confirmation}
          title="确认操作"
          onClose={() => setConfirmation(undefined)}
          footer={
            <div className="flex justify-end gap-3">
              <InkButton onClick={() => setConfirmation(undefined)}>
                取消
              </InkButton>
              <InkButton
                disabled={session.locked}
                onClick={() => {
                  if (confirmation) {
                    void session.submit(confirmation.input);
                    setConfirmation(undefined);
                  }
                }}
              >
                确认
              </InkButton>
            </div>
          }
        >
          {confirmation && (
            <div className="space-y-3 text-sm">
              {confirmation.lines.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
              <p>
                消耗{' '}
                <span className="font-mono">
                  {confirmation.input.expectedCost.qi}
                </span>{' '}
                天地灵气 ·{' '}
                <SpiritStones amount={confirmation.input.expectedCost.spiritStones} />
              </p>
              {confirmation.warning && (
                <p className="text-crimson">{confirmation.warning}</p>
              )}
            </div>
          )}
        </InkModal>
      </div>
    </GameSceneFrame>
  );
}
