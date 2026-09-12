import { RoomView, type RoomActorView } from '@app/components/feature/room';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout/InkModal';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { getLevelRealmStage } from '@shared/config/realmProgression';
import { daoEquipmentBaseRange, daoEquipmentTemplateOf } from '@shared/engine/combat-v6/equipment/content';
import { DAO_EQUIPMENT_FORGING } from '@shared/engine/combat-v6/equipment/forging-content';
import { EQUIPMENT_ATTRIBUTE_NAMES } from '@shared/inventory/equipment';
import { itemDefinition } from '@shared/inventory';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import { ForgingFurnace } from './ForgingFurnace';
import { ForgingInventory, type ForgeFilter } from './ForgingInventory';
import { useForgingSession, type ForgeItem } from './useForgingSession';

const boostPercent = Number((DAO_EQUIPMENT_FORGING.boostPerMaterial * 100).toFixed(6));
const maxBoostPercent = Number((DAO_EQUIPMENT_FORGING.boostPerMaterial * 5 * 100).toFixed(6));

const facilities: RoomActorView[] = [
  {
    id: 'furnace',
    sigil: '炉',
    name: '地火器炉',
    identity: '铸造设施',
    responsibility: '依图定形，借地火锻成道装',
    appearance: 'facility',
  },
  {
    id: 'archive',
    sigil: '卷',
    name: '道装图录',
    identity: '图纸设施',
    responsibility: '翻阅随身图纸，择一卷开炉',
    appearance: 'facility',
  },
  {
    id: 'guide',
    sigil: '碑',
    name: '铸器碑',
    identity: '指引设施',
    responsibility: '辨灵材之性，知铸器之理',
    appearance: 'facility',
  },
];
const compactQuery = '(max-width: 767px)';
function subscribeCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
const readCompact = () => window.matchMedia(compactQuery).matches;
const readServerCompact = () => false;

export function ForgingRoom() {
  const session = useForgingSession();
  const [facility, setFacility] = useState('');
  const [filter, setFilter] = useState<ForgeFilter>('all');
  const [selected, setSelected] = useState<string>();
  const { pushToast } = useInkUI();
  const [revealed, setRevealed] = useState(false);
  const [drawer, setDrawer] = useState<'bag' | 'confirm'>();
  const compact = useSyncExternalStore(
    subscribeCompact,
    readCompact,
    readServerCompact,
  );
  const bagRef = useRef<HTMLElement>(null);
  const blocker = useBlocker(session.pending);
  const resetBlockedNavigation =
    blocker.state === 'blocked' ? blocker.reset : undefined;
  useEffect(() => {
    resetBlockedNavigation?.();
  }, [resetBlockedNavigation]);
  useBeforeUnload((event) => {
    if (session.pending) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  function openBag(next: ForgeFilter) {
    setFilter(next);
    if (compact) setDrawer('bag');
    else bagRef.current?.focus();
  }
  function choose(item: ForgeItem) {
    setSelected(item.id);
    const message = session.choose(item);
    if (message) pushToast({ message });
  }
  const bag = (
    <ForgingInventory
      session={session}
      filter={filter}
      onFilter={setFilter}
      selected={selected}
      onChoose={choose}
    />
  );
  const blueprints =
    session.inventory?.items.filter(
      (item) => itemDefinition(item.definitionId).kind === 'blueprint',
    ) ?? [];
  const { result } = session;
  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-4 text-sm">
        {session.error ? (
          <p role="alert" className="text-crimson">
            {session.error}{' '}
            <InkButton
              disabled={session.pending}
              onClick={() => {
                session.reload();
              }}
            >
              重新核对
            </InkButton>
          </p>
        ) : null}
        {!facility ? (
          <RoomView
            description="地火映壁，炉中尚有余温。图卷与铸器碑分列两侧，择一处走近。"
            actors={facilities}
            onSelect={setFacility}
            prompt="选择一处设施"
          />
        ) : (
          <>
            <header className="border-ink/10 flex items-center justify-between gap-3 border-b pb-3">
              <h3 className="font-medium">
                {facilities.find((entry) => entry.id === facility)?.name}
              </h3>
              <InkButton
                disabled={session.pending}
                onClick={() => setFacility('')}
              >
                返回炼器室
              </InkButton>
            </header>
            {facility === 'furnace' ? (
              <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <section className="min-w-0">
                  {compact ? (
                    <div className="flex justify-end">
                      <InkButton
                        disabled={session.locked}
                        onClick={() => openBag('all')}
                      >
                        储物袋
                      </InkButton>
                    </div>
                  ) : null}
                  <ForgingFurnace
                    session={session}
                    onOpenBag={openBag}
                    revealed={revealed}
                    onReveal={() => {
                      setRevealed(true);
                      pushToast({
                        message: '打造成功，道装已收入储物袋。',
                        tone: 'success',
                      });
                    }}
                  />
                  {result ? (
                    revealed ? (
                      <section
                        className="mt-4 space-y-3 text-center"
                        aria-live="polite"
                      >
                        <p className="text-ink-secondary text-xs">
                          {
                            getLevelRealmStage(result.equipment.equipmentLevel)
                              .realm
                          }{' '}
                          · 已收入储物袋
                        </p>
                        <div className="flex justify-center gap-4">
                          <InkButton
                            variant="primary"
                            disabled={!session.view}
                            onClick={() => {
                              session.continueForging();
                              setRevealed(false);
                              setSelected(undefined);
                            }}
                          >
                            继续铸造
                          </InkButton>
                        </div>
                      </section>
                    ) : (
                      <p
                        role="status"
                        className="text-ink-secondary my-4 text-center text-xs"
                      >
                        炉光渐敛，道装成形……
                      </p>
                    )
                  ) : (
                    <>
                      <p
                        className="text-ink-secondary my-4 min-h-6 text-center text-xs"
                        role="status"
                      >
                        {session.pending
                          ? '地火正盛，灵材入炉，静候成器……'
                          : (session.problem ?? '图材相合，可引地火。')}
                      </p>
                      <footer className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                        <div className="space-y-1 text-xs">
                          <p>
                            {session.cost
                              ? `${session.cost.spiritStones.toLocaleString()} 灵石 · ${session.cost.qi} 天地灵气`
                              : '选择图纸后确定本次消耗'}
                          </p>
                          <div className="text-ink-secondary flex items-center gap-2">
                            {session.cost
                              ? `${session.cost.quantity} 份灵材 · ${session.cost.rank}起`
                              : '一卷图纸，最多五份灵材'}
                            <InkTooltip label="材料增益规则">
                              每份材料增加 {boostPercent} 个百分点，同类最多
                              {maxBoostPercent}%。矿石增益白字择优；天材地宝增益器蕴数量择优；辅助与妖兽材料增益已有附灵数值择优。材料平均品阶越高，白字上下限越高；平均超出门槛两阶封顶。器诀独立随机。
                            </InkTooltip>
                          </div>
                        </div>
                        <InkButton
                          variant="primary"
                          pending={session.pending}
                          pendingLabel="铸造中……"
                          disabled={session.locked || !!session.problem}
                          onClick={() => setDrawer('confirm')}
                        >
                          开炉铸造
                        </InkButton>
                      </footer>
                    </>
                  )}
                </section>
                {!compact ? (
                  <aside
                    ref={bagRef}
                    tabIndex={-1}
                    aria-label="炼器物品栏"
                    className="border-ink/10 min-w-0 border-l pl-5 focus-visible:outline-none"
                  >
                    {bag}
                  </aside>
                ) : null}
              </div>
            ) : facility === 'archive' ? (
              <div className="space-y-3">
                {!session.view ? (
                  <p>正在翻阅图纸……</p>
                ) : !blueprints.length ? (
                  <p className="text-ink-secondary">储物袋中暂无道装图纸。</p>
                ) : (
                  blueprints.map((item) => (
                    <div
                      key={item.id}
                      className="border-ink/10 flex items-center justify-between gap-3 border-b py-3"
                    >
                      <div>
                        <p>
                          {item.name} ×{item.quantity}
                        </p>
                        <p className="text-ink-secondary text-xs">
                          {session.itemProblem(item)}
                        </p>
                      </div>
                      <InkButton
                        disabled={session.locked || !!session.itemProblem(item)}
                        onClick={() => {
                          choose(item);
                          setFacility('furnace');
                        }}
                      >
                        带入器炉
                      </InkButton>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="max-w-2xl space-y-6 py-3 text-sm leading-7">
                <section>
                  <h3 className="mb-2 font-medium">依图定形</h3>
                  <p className="text-ink-secondary">
                    图纸决定道装的境界与槽位，不可铸造高于人物境界的图纸。目前开放炼气至化神道装。每炉需要一卷图纸与规定数量、品质的材料。
                  </p>
                </section>
                <section>
                  <h3 className="mb-2 font-medium">灵材各有所长</h3>
                  <p className="text-ink-secondary">
                    材料刚好达到品阶门槛时使用基础范围，平均高出两阶时达到最高范围，中间逐步提升。矿石偏重白字面板；天材地宝偏重器蕴数量；辅助与妖兽材料偏重附灵数值。同类可叠加择优概率，每份
                    {boostPercent}%，最多 {maxBoostPercent}%。器诀独立随机。
                  </p>
                </section>
                <section>
                  <h3 className="mb-2 font-medium">开炉成器</h3>
                  <p className="text-ink-secondary">
                    铸造只使用储物袋中的图纸与灵材，旧材料需先从洞府宝库取出。确认开炉时消耗图纸、材料、灵石与天地灵气，成品自动入包。炉前放入、移出不扣除物品。
                  </p>
                </section>
              </div>
            )}
          </>
        )}
        <InkDetailDrawer
          isOpen={drawer === 'bag' && compact}
          title="选择图纸与灵材"
          onClose={() => setDrawer(undefined)}
          size="md"
          footer={
            <InkButton onClick={() => setDrawer(undefined)}>选好了</InkButton>
          }
        >
          {bag}
        </InkDetailDrawer>
        <InkModal
          isOpen={drawer === 'confirm'}
          title="确认开炉"
          onClose={() => setDrawer(undefined)}
          footer={
            <div className="flex justify-end gap-3">
              <InkButton onClick={() => setDrawer(undefined)}>取消</InkButton>
              <InkButton
                disabled={session.locked || !!session.problem}
                onClick={() => {
                  setDrawer(undefined);
                  setSelected(undefined);
                  void session.submit();
                }}
              >
                确认开炉
              </InkButton>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            <p>{session.blueprint?.name} ×1</p>
            {Array.from(session.quantities, ([id, quantity]) => (
              <p key={id}>
                {session.byId.get(id)?.name} ×{quantity}
              </p>
            ))}
            <p>
              {session.cost?.spiritStones.toLocaleString()} 灵石 ·{' '}
              {session.cost?.qi} 天地灵气
            </p>
            {session.forging && session.definition ? (
              <div className="space-y-1">
                <p className="text-ink-secondary">本炉器胚范围</p>
                {daoEquipmentTemplateOf(`dao_equipment.standard.${session.definition.slot}.v1`)?.baseStats.map((stat) => {
                  const range = daoEquipmentBaseRange(stat, session.definition!.level!, session.forging!.baseQuality);
                  return <p key={stat.attr}>{EQUIPMENT_ATTRIBUTE_NAMES[stat.attr]} <span className="font-mono">{range.min}–{range.max}</span></p>;
                })}
              </div>
            ) : null}
            <p className="text-ink-secondary">
              必定铸成一件道装，属性随机，成品自动入包。
            </p>
          </div>
        </InkModal>
      </div>
    </GameSceneFrame>
  );
}
