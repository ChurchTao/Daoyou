import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout/InkModal';
import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { InscriptionRequest } from '@shared/contracts/inscriptions';
import type { InventoryView } from '@shared/contracts/inventory';
import { daoFormationInscriptionOf } from '@shared/engine/combat-v6/equipment/content';
import { daoFormationMaxLevel } from '@shared/engine/combat-v6/equipment/inscriptions';
import type { DaoFormationInscriptionStateV1 } from '@shared/engine/combat-v6/equipment/types';
import {
  inscriptionMaterialProblem,
  prepareInscriptionDraw,
  prepareInscriptionEquipment,
  prepareInscriptionStrengthen,
  type InscriptionDrawPreview,
  type InscriptionMaterialRef,
  type InscriptionRef,
} from '@shared/inscriptions/rules';
import { itemDefinition, type ItemGrant } from '@shared/inventory';
import {
  EQUIPMENT_ATTRIBUTE_NAMES,
  InventoryEquipmentSchema,
} from '@shared/inventory/equipment';
import { inscriptionItemId } from '@shared/items/definitions/inscriptions';
import { cn } from '@shared/lib/cn';
import { useState } from 'react';
import { InventoryHeader } from '../items/InventoryHeader';
import { InventoryItems } from '../items/InventoryItems';
import { ItemSlot } from '../items/ItemSlot';
import type { DisplayItem } from '../items/itemPresentation';
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
  const [activeSlot, setActiveSlot] = useState(0);
  const [equipmentRef, setEquipmentRef] = useState<InscriptionRef>();
  const [socket, setSocket] = useState<0 | 1>(0);
  const [inscriptionRef, setInscriptionRef] = useState<InscriptionRef>();
  const [socketAction, setSocketAction] = useState<
    'engrave' | 'strengthen_socket'
  >('engrave');
  const [picker, setPicker] = useState<'equipment' | 'inscription'>(
    'equipment',
  );
  const [bagOpen, setBagOpen] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [confirmation, setConfirmation] = useState<{
    input: InscriptionRequest;
    lines: string[];
    warning?: string;
  }>();
  const inventory = session.bag.data;
  const items = [
    ...(inventory?.items ?? []),
    ...(inventory?.equippedItems ?? []),
  ];
  const byId = new Map(items.map((item) => [item.id, item]));
  const equipmentItem = equipmentRef ? byId.get(equipmentRef.id) : undefined;
  const equipment = equipmentItem
    ? InventoryEquipmentSchema.parse(equipmentItem.instanceData)
    : undefined;
  const selectedInscription = inscriptionRef
    ? byId.get(inscriptionRef.id)
    : undefined;
  let draw: InscriptionDrawPreview | undefined;
  let input: InscriptionRequest | undefined;
  let problem: string | null = session.view?.blockedReason ?? null;
  try {
    if (tab === 'draw') {
      const refs = materials.filter((m): m is InscriptionMaterialRef => !!m);
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
      if (!pair[0] || !pair[1]) problem ??= '放入两枚同种同级阵纹';
      else {
        const refs: InscriptionMaterialRef[] =
          pair[0].id === pair[1].id
            ? [{ ...pair[0], quantity: 2 }]
            : pair.map((ref) => ({ ...ref!, quantity: 1 }));
        const plan = prepareInscriptionStrengthen(items, refs);
        input = {
          action: 'strengthen',
          requestId: '',
          inscriptions: refs,
          expectedCost: plan.cost,
        };
      }
    } else if (!equipmentRef || !inscriptionRef)
      problem ??= '选择道装、孔位和阵纹';
    else {
      const plan = prepareInscriptionEquipment(
        items,
        equipmentRef,
        socket,
        inscriptionRef,
        socketAction,
        true,
      );
      const base = {
        requestId: '',
        equipment: equipmentRef,
        socket,
        inscription: inscriptionRef,
        expectedCost: plan.cost,
      };
      input =
        socketAction === 'engrave'
          ? {
              ...base,
              action: 'engrave',
              replace: !!equipment?.formationInscriptions[socket],
            }
          : { ...base, action: 'strengthen_socket' };
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
    if (target) setPicker(target);
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
      if (def.level === 11) return '已达最高等级';
      const firstRef = pair.find((ref) => ref !== null);
      const first = firstRef ? byId.get(firstRef.id) : undefined;
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
      if (socketAction === 'strengthen_socket') {
        const old = equipment.formationInscriptions[socket];
        if (!old || old.patternId !== def.patternId || old.level !== def.level)
          return '需与孔内阵纹同种同级';
        if (old.level >= daoFormationMaxLevel(equipment.equipmentLevel))
          return '此孔已达等级上限';
      }
    }
    return null;
  }
  function choose(item: Item) {
    if (session.locked) return;
    const reason = itemProblem(item);
    if (reason) {
      setSelectionError(reason);
      return;
    }
    setSelectionError('');
    if (tab === 'draw') {
      const existing = materials.findIndex((ref) => ref?.id === item.id);
      const index =
        existing >= 0
          ? existing
          : !materials[activeSlot]
            ? activeSlot
            : materials.indexOf(null);
      if (index < 0) {
        setSelectionError('四个材料格已满，请先移出材料');
        return;
      }
      const quantity = (materials[index]?.quantity ?? 0) + 1;
      if (quantity > item.quantity) {
        setSelectionError('该材料数量不足');
        return;
      }
      setMaterials((old) =>
        old.map((ref, i) => (i === index ? { ...refOf(item), quantity } : ref)),
      );
    } else if (tab === 'strengthen') {
      const index = !pair[activeSlot] ? activeSlot : pair.indexOf(null);
      if (index < 0) {
        setSelectionError('请先移出一枚阵纹');
        return;
      }
      setPair((old) => old.map((ref, i) => (i === index ? refOf(item) : ref)));
    } else if (picker === 'equipment') {
      setEquipmentRef(refOf(item));
      setInscriptionRef(undefined);
      setSocket(0);
      setSocketAction('engrave');
      setPicker('inscription');
    } else setInscriptionRef(refOf(item));
    setBagOpen(false);
  }
  function confirm() {
    if (!input || problem || session.locked) return;
    const lines: string[] = [];
    let warning: string | undefined;
    if (input.action === 'draw') {
      lines.push(
        ...input.materials.map(
          (ref) => `${byId.get(ref.id)?.name} ×${ref.quantity}`,
        ),
      );
      if (draw!.remainderTenths)
        warning = '本次投入含有无法成纹的余料，将一并消耗。';
    } else if (input.action === 'strengthen') {
      lines.push(
        ...input.inscriptions.map(
          (ref) => `${byId.get(ref.id)?.name} ×${ref.quantity}`,
        ),
      );
    } else {
      lines.push(
        `${equipmentItem!.name} · 第${socket + 1}孔`,
        `原阵纹：${formationText(equipment!.formationInscriptions[socket])}`,
        `消耗：${selectedInscription!.name} ×1`,
      );
      if (input.action === 'engrave' && input.replace)
        warning = '覆盖后旧阵纹消失，不会返还。';
    }
    setConfirmation({
      input: { ...input, requestId: crypto.randomUUID() },
      lines,
      warning,
    });
  }
  function clear() {
    setMaterials(emptyMaterials());
    setPair([null, null]);
    setActiveSlot(0);
    setEquipmentRef(undefined);
    setInscriptionRef(undefined);
    setPicker('equipment');
    setSelectionError('');
    session.continueWork();
  }
  const materialPicker = (
    <div className="space-y-3 text-sm">
      <InventoryHeader capacity={<>{inventory?.used ?? '—'} / 40</>} />
      {tab === 'engrave' && (
        <p className="text-ink-secondary text-xs">
          {picker === 'equipment' ? '选择道装' : `选择第${socket + 1}孔的阵纹`}
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
                  disabled={session.locked}
                  onQuickAction={() => choose(item)}
                  quickOnTouch
                >
                  {(close) => (
                    <InkButton
                      disabled={session.locked}
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
        items={inventory?.items ?? []}
        quickTouchHint
        slotProps={(item) => {
          const reason = item ? itemProblem(item) : null;
          return {
            disabled: session.locked || !!reason,
            quickOnTouch: true,
            badge: item && !reason ? '可选' : undefined,
            onQuickAction: item ? () => choose(item) : undefined,
            children: item
              ? (close) => (
                  <>
                    {reason && <p className="text-ink-secondary">{reason}</p>}
                    <InkButton
                      disabled={session.locked || !!reason}
                      onClick={() => {
                        choose(item);
                        close();
                      }}
                    >
                      选择
                    </InkButton>
                  </>
                )
              : undefined,
          };
        }}
      />
    </div>
  );
  const operationLabel =
    tab === 'draw'
      ? '绘制阵纹'
      : tab === 'strengthen' || socketAction === 'strengthen_socket'
        ? '合成阵纹'
        : equipment?.formationInscriptions[socket]
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
    setSocket(index);
    setSocketAction(action);
    setInscriptionRef(undefined);
    setSelectionError('');
    openBag('inscription');
  }
  const boardSlots: BoardSlot[] =
    tab === 'draw'
      ? materials.map((ref, index) => {
          const item = ref ? byId.get(ref.id) : undefined;
          return {
            label: '放入材料',
            position: positions[index],
            item: item ? { ...item, quantity: ref!.quantity } : undefined,
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
              const incoming =
                socket === index ? selectedInscription : undefined;
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
                  !!equipment && picker === 'inscription' && socket === index,
                badge: incoming
                  ? socketAction === 'strengthen_socket'
                    ? '待合成'
                    : '待烙印'
                  : undefined,
                actionLabel: incoming ? '移出待用阵纹' : '放入阵纹',
                choose: () => selectSocket(index, 'engrave'),
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
            {session.result ? (
              <div className="space-y-4" aria-live="polite">
                <p className="text-teal">
                  {session.result.action === 'draw'
                    ? '阵纹已成，收入储物袋。'
                    : session.result.action === 'engrave'
                      ? '烙印完成。'
                      : '合成完成。'}
                </p>
                {!!session.result.grants.length && (
                  <GrantItems grants={session.result.grants} />
                )}
                <p className="text-ink-secondary text-xs">
                  本次消耗{' '}
                  <span className="font-mono">{session.result.cost.qi}</span>{' '}
                  天地灵气 ·{' '}
                  <span className="font-mono">
                    {session.result.cost.spiritStones}
                  </span>{' '}
                  灵石
                </p>
                <InkButton variant="primary" onClick={clear}>
                  继续
                </InkButton>
              </div>
            ) : (
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
                                  <label className="flex w-full items-center gap-2 text-sm">
                                    <span>投入数量</span>
                                    <input
                                      aria-label={`第${index + 1}格投入数量`}
                                      className="min-w-0 flex-1 py-1 font-mono"
                                      type="number"
                                      min={1}
                                      max={
                                        byId.get(materials[index]!.id)!.quantity
                                      }
                                      value={materials[index]!.quantity}
                                      disabled={session.locked}
                                      onChange={(event) => {
                                        const quantity = Number(
                                          event.target.value,
                                        );
                                        setMaterials((old) =>
                                          old.map((ref, i) =>
                                            i === index && ref
                                              ? { ...ref, quantity }
                                              : ref,
                                          ),
                                        );
                                      }}
                                    />
                                  </label>
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
                    {input && (
                      <p>
                        <span className="font-mono">
                          {input.expectedCost.qi}
                        </span>{' '}
                        天地灵气 ·{' '}
                        <span className="font-mono">
                          {input.expectedCost.spiritStones}
                        </span>{' '}
                        灵石
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
            )}
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
              矿石、妖兽材料、辅助材料、天材地宝均可入墨。每4份绘成一级阵纹，高一级所需份数翻倍，优先绘成高等级阵纹，最高11级。每512份消耗1点天地灵气，最少1点、最多100点；每1份消耗1灵石，均向上取整，余料也计入费用；最多产出三个等级组，其余材料随绘制消耗。
            </p>
            <p>
              九种阵纹等概率独立生成。同种同级可两两合成，绘制与合成均必定成功。阵纹适用部位及等级须符合道装要求。
            </p>
            <p>
              已烙印阵纹可消耗背包中同种同级阵纹进行孔内合成。阵纹不能拆卸，覆盖时旧阵纹不返还。
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
                <span className="font-mono">
                  {confirmation.input.expectedCost.spiritStones}
                </span>{' '}
                灵石
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
