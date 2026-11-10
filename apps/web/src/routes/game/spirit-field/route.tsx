import { VaultWithdrawal } from '@app/components/feature/forging/VaultWithdrawal';
import { CraftInventoryPanel } from '@app/components/feature/items/CraftInventoryPanel';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import {
  matchesInventoryFilters,
  type InventoryFilter,
} from '@app/components/feature/items/inventoryFilterModel';
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { findItemDefinition } from '@daoyou/game-content/items';
import {
  MaterialFactsSchema,
  SeedFactsSchema,
} from '@daoyou/game-domain/inventory';
import type {
  SpiritGardenBranch,
  SpiritGardenPlantView,
  SpiritGardenSpeciesId,
} from '@daoyou/game-domain/spirit-field';
import {
  canPlantSpiritFieldSeed,
  getSpiritGardenSpecies,
  resolveSpiritGardenSpecies,
} from '@daoyou/game-rules/spirit-field';
import { useEffect, useRef, useState } from 'react';
import { BotanicalArt } from './components/BotanicalArt';
import { GardenBranchChoice } from './components/GardenBranchChoice';
import { GardenCanvas } from './components/GardenCanvas';
import { GardenCodex } from './components/GardenCodex';
import { GardenCollection } from './components/GardenCollection';
import { GardenPlantDetail } from './components/GardenPlantDetail';
import {
  useSpiritGarden,
  type GardenAction,
  type GardenOutcome,
} from './useSpiritGarden';

type Item = InventoryView['items'][number];
type PlantTarget = { plotIndex: number; plantId: string };
type ItemTarget =
  { purpose: 'sow'; plotIndex: number } | ({ purpose: 'evolve' } & PlantTarget);
type Panel =
  | ({ view: 'plant' | 'branch' | 'evolve' } & PlantTarget)
  | { view: 'sow'; plotIndex: number }
  | { view: 'inventory'; target: ItemTarget }
  | { view: 'collection' | 'codex' }
  | { view: 'retire'; plantId: string }
  | { view: 'receipt'; result: GardenOutcome['result'] };
const targetKey = (target: ItemTarget) =>
  `${target.purpose}:${target.plotIndex}:${'plantId' in target ? target.plantId : ''}`;
const titles = {
  plant: '灵植小记',
  branch: '择定长养之路',
  evolve: '灵植蜕变',
  sow: '栽种新灵植',
  inventory: '选择物品',
  collection: '保种阁',
  codex: '百草志',
  retire: '结束培育',
  receipt: '收成已收妥',
};

export default function SpiritFieldPage() {
  const garden = useSpiritGarden();
  const { snapshot, locked } = garden;
  const { pushToast } = useInkUI();
  const bag = useInventoryBag();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [restorePlant, setRestorePlant] =
    useState<SpiritGardenPlantView | null>(null);
  const [selectedSpeciesId, setSelectedSpeciesId] =
    useState<SpiritGardenSpeciesId | null>(null);
  const [branch, setBranch] = useState<SpiritGardenBranch | null>(null);
  const [source, setSource] = useState<'bag' | 'storage'>('bag');
  const [filter, setFilter] = useState<InventoryFilter>({ kind: 'seed' });
  const storage = useCraftStorage(
    filter,
    panel?.view === 'inventory' && source === 'storage',
  );
  const [selection, setSelection] = useState<{
    target: ItemTarget;
    item: Item;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelKind = panel?.view;
  const previousPanel = useRef<Panel['view'] | undefined>(undefined);
  useEffect(() => {
    const wasOpen = previousPanel.current !== undefined;
    previousPanel.current = panelKind;
    if (!panelKind && !wasOpen) return;
    const timer = window.setTimeout(() => {
      if (panelKind) contentRef.current?.focus();
      else if (selectedIndex !== null)
        document
          .querySelector<HTMLButtonElement>(
            `.garden-plot[data-plot-index="${selectedIndex}"]`,
          )
          ?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [panelKind, selectedIndex]);

  const inventoryView = source === 'bag' ? bag.data : storage.view;
  const inventoryLoading =
    source === 'bag' ? bag.isRefreshing : storage.loading;
  const inventoryError = source === 'bag' ? bag.error : storage.error;
  const panelPlant =
    panel && 'plotIndex' in panel && 'plantId' in panel
      ? snapshot?.plots[panel.plotIndex]?.plant
      : null;
  const validPanelPlant =
    panel && 'plantId' in panel && panelPlant?.id === panel.plantId
      ? panelPlant
      : null;
  const itemTarget: ItemTarget | null =
    panel?.view === 'inventory'
      ? panel.target
      : panel?.view === 'sow'
        ? { purpose: 'sow', plotIndex: panel.plotIndex }
        : panel?.view === 'evolve'
          ? {
              purpose: 'evolve',
              plotIndex: panel.plotIndex,
              plantId: panel.plantId,
            }
          : null;
  const chosen =
    itemTarget &&
    selection &&
    targetKey(selection.target) === targetKey(itemTarget)
      ? selection.item
      : undefined;

  function canChoose(target: ItemTarget, item: Item) {
    if (!snapshot || item.quantity < 1) return false;
    const plot = snapshot.plots[target.plotIndex];
    const kind = findItemDefinition(item.definitionId)?.kind;
    if (target.purpose === 'sow') {
      if (plot?.plant || kind !== 'seed') return false;
      const facts = SeedFactsSchema.safeParse(item.instanceData);
      return (
        facts.success &&
        canPlantSpiritFieldSeed(
          snapshot.player.realm,
          facts.data.seedSpec.plant,
        )
      );
    }
    const plant = plot?.plant;
    if (
      !plant ||
      plant.id !== target.plantId ||
      !plant.canEvolve ||
      kind !== 'material'
    )
      return false;
    const facts = MaterialFactsSchema.safeParse(item.instanceData);
    return (
      facts.success &&
      facts.data.type === plant.evolveCost.materialKind &&
      QUALITY_ORDER[facts.data.rank] >=
        QUALITY_ORDER[plant.evolveCost.materialQuality] &&
      item.quantity >= plant.evolveCost.quantity
    );
  }

  function openInventory(target: ItemTarget) {
    setFilter(
      target.purpose === 'sow'
        ? { kind: 'seed' }
        : { kind: 'material', materialType: 'herb' },
    );
    storage.setPage(0);
    setPanel({ view: 'inventory', target });
  }
  function returnFromInventory(target: ItemTarget) {
    setPanel(
      target.purpose === 'sow'
        ? { view: 'sow', plotIndex: target.plotIndex }
        : {
            view: 'evolve',
            plotIndex: target.plotIndex,
            plantId: target.plantId,
          },
    );
  }
  function choose(item: Item) {
    if (
      locked ||
      inventoryLoading ||
      inventoryError ||
      panel?.view !== 'inventory' ||
      !canChoose(panel.target, item)
    )
      return;
    setSelection({ target: panel.target, item });
    returnFromInventory(panel.target);
  }

  function afterAction(outcome: GardenOutcome | null) {
    if (!outcome) {
      setSelection(null);
      bag.invalidate();
      storage.reload();
      return;
    }
    const { action, result } = outcome;
    setSelection(null);
    storage.reload();
    if (action.endpoint === 'harvest') {
      setPanel({ view: 'receipt', result });
      return;
    }
    pushToast({ message: result.message ?? '灵圃已更新', tone: 'success' });
    switch (action.endpoint) {
      case 'sow':
        setSelectedIndex(action.input.plotIndex);
        setPanel(
          result.plantId
            ? {
                view: 'plant',
                plotIndex: action.input.plotIndex,
                plantId: result.plantId,
              }
            : null,
        );
        break;
      case 'branch':
      case 'evolve':
        setPanel({
          view: 'plant',
          plotIndex: action.input.plotIndex,
          plantId: action.input.plantId,
        });
        break;
      case 'archive':
      case 'retire':
        setPanel({ view: 'collection' });
        break;
      case 'restore':
        setRestorePlant(null);
        setSelectedIndex(action.input.plotIndex);
        setPanel(null);
        break;
      case 'starter': {
        const empty = snapshot?.plots.find((plot) => !plot.plant);
        if (empty) setSelectedIndex(empty.index);
        setPanel(empty ? { view: 'sow', plotIndex: empty.index } : null);
        break;
      }
    }
  }
  async function act(action: GardenAction) {
    afterAction(await garden.act(action));
  }
  function selectPlot(index: number) {
    if (!snapshot || locked) return;
    const plot = snapshot.plots[index];
    if (!plot) return;
    setSelectedIndex(index);
    if (restorePlant) {
      if (!plot.plant)
        void act({
          endpoint: 'restore',
          input: { plotIndex: index, plantId: restorePlant.id },
        });
      return;
    }
    setSelection(null);
    setBranch(null);
    setPanel(
      plot.plant
        ? { view: 'plant', plotIndex: index, plantId: plot.plant.id }
        : { view: 'sow', plotIndex: index },
    );
  }

  if (!snapshot && !garden.readError)
    return <GameSceneLoading message="正在推开灵圃的门……" />;
  if (!snapshot)
    return (
      <GameSceneFrame>
        <InkNotice tone="warning">{garden.readError}</InkNotice>
        <InkButton onClick={() => void garden.refresh()}>重新查看</InkButton>
      </GameSceneFrame>
    );

  const notice = garden.needsRetry ? (
    <div
      role="alert"
      className="border-crimson bg-crimson/5 space-y-2 border-l-2 p-3 text-sm leading-6"
    >
      <p>上次操作的结果尚未确认，请先重试确认。重试不会重复消耗或发放产物。</p>
      <InkButton
        pending={garden.busy}
        onClick={() => void garden.retry().then(afterAction)}
      >
        确认上次操作
      </InkButton>
    </div>
  ) : garden.mutationError ? (
    <InkNotice tone="warning">{garden.mutationError}</InkNotice>
  ) : null;
  const backToPlant = () => {
    if (validPanelPlant && panel && 'plotIndex' in panel)
      setPanel({
        view: 'plant',
        plotIndex: panel.plotIndex,
        plantId: validPanelPlant.id,
      });
  };
  const species = validPanelPlant
    ? snapshot.species.find((entry) => entry.id === validPanelPlant.speciesId)
    : null;
  const elapsedMs = Math.max(0, garden.now - garden.snapshotAt);
  const plantTarget =
    validPanelPlant && panel && 'plotIndex' in panel
      ? { plotIndex: panel.plotIndex, plantId: validPanelPlant.id }
      : null;
  const seed =
    panel?.view === 'sow' && chosen
      ? SeedFactsSchema.safeParse(chosen.instanceData)
      : null;
  const seedSpecies = seed?.success
    ? getSpiritGardenSpecies(
        resolveSpiritGardenSpecies(seed.data.seedSpec.plant),
      )
    : null;
  const retired =
    panel?.view === 'retire'
      ? snapshot.collection.find((entry) => entry.id === panel.plantId)
      : null;
  const inventory =
    panel?.view === 'inventory' ? (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-ink-secondary">
            {panel.target.purpose === 'sow'
              ? `为第 ${panel.target.plotIndex + 1} 畦选择灵种`
              : '选择本次蜕变要投入的药材'}
          </p>
          <InkButton
            variant="secondary"
            disabled={locked}
            onClick={() => returnFromInventory(panel.target)}
          >
            返回{panel.target.purpose === 'sow' ? '栽种' : '蜕变'}
          </InkButton>
        </div>
        <CraftInventoryPanel
          source={source}
          onSource={setSource}
          view={inventoryView}
          loading={inventoryLoading}
          error={inventoryError}
          filter={filter}
          onFilter={(value) => {
            setFilter(value);
            storage.setPage(0);
          }}
          onPage={storage.setPage}
          onReload={() => {
            if (source === 'bag') void bag.reload();
            else storage.reload();
            void garden.refresh();
          }}
        >
          <InventoryItems
            location={source}
            items={inventoryView?.items ?? []}
            quickTouchHint
            slotProps={(item) => {
              const available =
                !!item &&
                matchesInventoryFilters(item, filter) &&
                canChoose(panel.target, item);
              return {
                disabled:
                  !item || locked || inventoryLoading || !!inventoryError,
                quickOnTouch: true,
                badge: available ? '可选' : undefined,
                onQuickAction:
                  available && item ? () => choose(item) : undefined,
                children: item
                  ? (close) => (
                      <>
                        {!available ? (
                          <p className="text-ink-secondary text-sm">
                            此物不符合本次
                            {panel.target.purpose === 'sow' ? '栽种' : '蜕变'}
                            要求。
                          </p>
                        ) : null}
                        <InkButton
                          variant="primary"
                          disabled={
                            locked ||
                            inventoryLoading ||
                            !!inventoryError ||
                            !available
                          }
                          onClick={() => {
                            choose(item);
                            close();
                          }}
                        >
                          选用
                        </InkButton>
                      </>
                    )
                  : undefined,
              };
            }}
          />
          <VaultWithdrawal
            onChanged={() => {
              storage.reload();
              void garden.refresh();
            }}
          />
        </CraftInventoryPanel>
      </>
    ) : null;

  return (
    <GameSceneFrame
      variant="default"
      description="长养一圃草木，静候百般收成。"
    >
      {garden.readError ? (
        <InkNotice tone="warning">{garden.readError}</InkNotice>
      ) : null}
      {!panel ? notice : null}
      <GardenCanvas
        snapshot={snapshot}
        selectedIndex={selectedIndex}
        locked={locked}
        restorePlant={restorePlant}
        onSelectPlot={selectPlot}
        onHarvest={() => void act({ endpoint: 'harvest', input: {} })}
        onOpenCollection={() => setPanel({ view: 'collection' })}
        onOpenCodex={() => setPanel({ view: 'codex' })}
        onStarter={() => void act({ endpoint: 'starter', input: {} })}
        onCancelRestore={() => setRestorePlant(null)}
      />
      <InkDetailDrawer
        isOpen={panel !== null}
        onClose={() => {
          if (!garden.busy) setPanel(null);
        }}
        title={panel ? titles[panel.view] : ''}
        size={
          panel?.view === 'inventory' || panel?.view === 'codex' ? 'lg' : 'md'
        }
        closeOnEscape={!garden.busy}
        closeOnOverlayClick={!garden.busy}
        className="spirit-garden garden-panel bg-paper"
      >
        <div ref={contentRef} tabIndex={-1} className="outline-none">
          {notice}
          {panel?.view === 'inventory' ? inventory : null}
          {panel?.view === 'plant' &&
          validPanelPlant &&
          species &&
          plantTarget ? (
            <GardenPlantDetail
              plant={validPanelPlant}
              species={species}
              elapsedMs={elapsedMs}
              locked={locked}
              onBranch={() => {
                setBranch(null);
                setPanel({ view: 'branch', ...plantTarget });
              }}
              onEvolve={() => setPanel({ view: 'evolve', ...plantTarget })}
              onArchive={() => {
                if (
                  snapshot.collection.length >= snapshot.profile.collectionLimit
                ) {
                  pushToast({
                    message: '保种阁已满，请先领取收成并整理收藏。',
                    tone: 'danger',
                  });
                  setPanel({ view: 'collection' });
                  return;
                }
                void act({ endpoint: 'archive', input: plantTarget });
              }}
            />
          ) : null}
          {panel?.view === 'branch' &&
          validPanelPlant &&
          species &&
          plantTarget ? (
            <GardenBranchChoice
              plant={validPanelPlant}
              species={species}
              selectedBranch={branch}
              locked={locked}
              onSelect={setBranch}
              onConfirm={() => {
                if (branch)
                  void act({
                    endpoint: 'branch',
                    input: { ...plantTarget, branch },
                  });
              }}
              onBack={backToPlant}
            />
          ) : null}
          {panel?.view === 'evolve' &&
          validPanelPlant &&
          plantTarget &&
          itemTarget ? (
            <div className="space-y-6 text-sm leading-7">
              <InkButton
                variant="secondary"
                onClick={backToPlant}
                disabled={locked}
              >
                返回灵植小记
              </InkButton>
              <div className="flex items-center gap-5">
                <BotanicalArt
                  speciesId={validPanelPlant.speciesId}
                  stage={validPanelPlant.stage}
                  className="w-24 shrink-0"
                />
                <div>
                  <h3 className="text-xl font-semibold">
                    {validPanelPlant.speciesName}
                  </h3>
                  <p className="text-teal mt-1">
                    一次蜕变，今后的收成提高一品。
                  </p>
                </div>
              </div>
              <p className="text-ink-secondary">
                已有收成保留原品质，当前生产进度继续。条件满足后必定成功，每株可蜕变一次。
              </p>
              <div className="border-ink/10 border-y py-4">
                <p>本次投入</p>
                <p className="mt-2">
                  <SpiritStones
                    amount={validPanelPlant.evolveCost.spiritStones}
                  />{' '}
                  与 <span className="font-mono">1</span> 份
                  {validPanelPlant.evolveCost.materialQuality}及以上药材
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20">
                  <ItemSlot
                    item={chosen}
                    emptyLabel="选择药材"
                    onQuickAction={() => openInventory(itemTarget)}
                    quickOnTouch
                  />
                </div>
                <InkButton
                  disabled={locked}
                  onClick={() => openInventory(itemTarget)}
                >
                  {chosen ? '更换药材' : '选择药材'}
                </InkButton>
              </div>
              {!validPanelPlant.canEvolve ? (
                <InkNotice>{validPanelPlant.evolveReason}</InkNotice>
              ) : null}
              <InkButton
                variant="primary"
                className="w-full justify-center"
                disabled={
                  locked ||
                  !chosen ||
                  !canChoose(itemTarget, chosen) ||
                  snapshot.player.spiritStones <
                    validPanelPlant.evolveCost.spiritStones
                }
                onClick={() => {
                  if (chosen)
                    void act({
                      endpoint: 'evolve',
                      input: {
                        ...plantTarget,
                        resourceId: chosen.id,
                        resourceRevision: chosen.revision,
                      },
                    });
                }}
              >
                投入并完成蜕变
              </InkButton>
              {snapshot.player.spiritStones <
              validPanelPlant.evolveCost.spiritStones ? (
                <p className="text-crimson">当前灵石不足。</p>
              ) : null}
            </div>
          ) : null}
          {panel?.view === 'sow' && itemTarget ? (
            <div className="space-y-6 text-sm leading-7">
              <p className="text-ink-secondary">
                第 <span className="font-mono">{panel.plotIndex + 1}</span> 畦 ·
                种下后自动成长，采收保留植株。
              </p>
              {seedSpecies ? (
                <div className="flex items-center gap-5">
                  <BotanicalArt
                    speciesId={seedSpecies.id}
                    className="w-28 shrink-0"
                  />
                  <div>
                    <h3 className="text-xl font-semibold">
                      {seedSpecies.name}
                    </h3>
                    {seed?.success ? (
                      <p className="text-ink-secondary mt-1 text-xs">
                        {seed.data.seedSpec.plant.quality}灵种 · 本次消耗{' '}
                        <span className="font-mono">1</span> 份
                      </p>
                    ) : null}
                    <p className="text-ink-secondary mt-2">
                      {seedSpecies.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="garden-planting-note">
                  <p className="text-lg">为这一畦，选一株长养的草木。</p>
                  <p className="text-ink-secondary mt-2">
                    灵种决定物种与品阶，成熟后便会持续留下收成。
                  </p>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="w-20">
                  <ItemSlot
                    item={chosen}
                    emptyLabel="选择灵种"
                    onQuickAction={() => openInventory(itemTarget)}
                    quickOnTouch
                  />
                </div>
                <InkButton
                  disabled={locked}
                  onClick={() => openInventory(itemTarget)}
                >
                  {chosen ? '更换灵种' : '从物品栏选择灵种'}
                </InkButton>
              </div>
              {seedSpecies ? (
                <div className="border-ink/10 space-y-2 border-y py-4">
                  <p>成株后 · {seedSpecies.baseOutput.name}</p>
                  <p className="text-ink-secondary">
                    将来可选择{seedSpecies.branches.abundance.name}，或
                    {seedSpecies.branches.essence.name}，养成自己的长养路线。
                  </p>
                </div>
              ) : null}
              <InkButton
                variant="primary"
                className="w-full justify-center"
                disabled={locked || !chosen || !canChoose(itemTarget, chosen)}
                onClick={() => {
                  if (chosen)
                    void act({
                      endpoint: 'sow',
                      input: {
                        plotIndex: panel.plotIndex,
                        seedMaterialId: chosen.id,
                        revision: chosen.revision,
                      },
                    });
                }}
              >
                栽入第 {panel.plotIndex + 1} 畦
              </InkButton>
            </div>
          ) : null}
          {panel?.view === 'collection' ? (
            <GardenCollection
              snapshot={snapshot}
              locked={locked}
              onRestore={(plant) => {
                setRestorePlant(plant);
                setPanel(null);
              }}
              onRetire={(plant) =>
                setPanel({ view: 'retire', plantId: plant.id })
              }
              onHarvest={() => void act({ endpoint: 'harvest', input: {} })}
            />
          ) : null}
          {panel?.view === 'codex' ? (
            <GardenCodex
              snapshot={snapshot}
              locked={locked}
              selectedSpeciesId={selectedSpeciesId}
              onSelectSpecies={setSelectedSpeciesId}
              onExchange={(id) =>
                void act({ endpoint: 'exchange', input: { speciesId: id } })
              }
            />
          ) : null}
          {panel?.view === 'retire' && retired ? (
            <div className="space-y-6 text-sm leading-7">
              <InkButton
                variant="secondary"
                onClick={() => setPanel({ view: 'collection' })}
              >
                返回保种阁
              </InkButton>
              <div className="flex items-center gap-5">
                <BotanicalArt speciesId={retired.speciesId} className="w-24" />
                <div>
                  <h3 className="text-xl font-semibold">
                    {retired.speciesName}
                  </h3>
                  <p className="text-ink-secondary">
                    {retired.outputQuality} · 已留下的图录成果会保留。
                  </p>
                </div>
              </div>
              <InkNotice tone="warning">
                这株灵植将永久移出保种阁，无法恢复。投入的灵种、药材和灵石不会返还。
              </InkNotice>
              <InkButton
                variant="primary"
                className="w-full justify-center"
                disabled={locked || retired.pending.length > 0}
                onClick={() =>
                  void act({
                    endpoint: 'retire',
                    input: { plantId: retired.id },
                  })
                }
              >
                确认永久结束培育
              </InkButton>
            </div>
          ) : null}
          {panel?.view === 'receipt' ? (
            <div className="space-y-6 text-sm leading-7">
              <div className="border-ink/10 border-b pb-5">
                <p className="text-ink-secondary">这一次的收成</p>
                <p className="text-teal mt-2 text-3xl">
                  <span className="font-mono">
                    {panel.result.quantity ?? 0}
                  </span>
                  <span className="ml-2 text-base">份</span>
                </p>
                <p className="text-ink-secondary mt-3">
                  采收保留灵植，长养的成果还会继续。
                </p>
              </div>
              <ul className="space-y-4">
                {panel.result.products?.map((product, index) => (
                  <li
                    key={`${product.name}:${product.quality}:${index}`}
                    className="flex items-center gap-4"
                  >
                    <BotanicalArt
                      speciesId={product.speciesId}
                      className="w-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p>{product.name}</p>
                      <p className="text-ink-secondary text-xs">
                        {product.quality}
                      </p>
                    </div>
                    <span className="font-mono">×{product.quantity}</span>
                  </li>
                ))}
              </ul>
              <p className="text-ink-secondary">
                已送至
                {panel.result.locations
                  ?.map((location) =>
                    location === 'storage' ? '储藏室' : '储物袋',
                  )
                  .join('、') || '物品栏'}
                。
              </p>
              <InkButton
                variant="secondary"
                className="w-full justify-center"
                onClick={() => setPanel(null)}
              >
                回到灵圃
              </InkButton>
            </div>
          ) : null}
          {panel &&
          ['plant', 'branch', 'evolve'].includes(panel.view) &&
          !validPanelPlant ? (
            <InkNotice>这株灵植已经移动，请返回灵圃重新查看。</InkNotice>
          ) : null}
        </div>
      </InkDetailDrawer>
    </GameSceneFrame>
  );
}
