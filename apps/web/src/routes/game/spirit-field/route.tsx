import { VaultWithdrawalList } from '@app/components/feature/forging/VaultWithdrawal';
import { CraftInventoryPanel } from '@app/components/feature/items/CraftInventoryPanel';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import {
  matchesInventoryFilters,
  type InventoryFilter,
} from '@app/components/feature/items/inventoryFilterModel';
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkChoiceButton, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import {
  useCultivatorCurrency,
  usePlayerSession,
} from '@app/lib/resources/player';
import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { findItemDefinition } from '@daoyou/game-content/items';
import {
  SPIRIT_GARDEN_CLEAR_SEED_CHANCE,
  SPIRIT_GARDEN_EVOLUTION_ATTEMPT_LIMIT,
  SPIRIT_GARDEN_EVOLUTION_COOLDOWN_MS,
  SPIRIT_GARDEN_MATURE_QI_COSTS,
  SPIRIT_GARDEN_MIN_REALM,
} from '@daoyou/game-content/spirit-field/config';
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
  canPlantSpiritGardenSeed,
  getSpiritGardenEvolutionPreview,
  getSpiritGardenOutput,
  getSpiritGardenSpecies,
  isSpiritGardenSeed,
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
  formatGardenDuration,
  gardenSeedName,
  pendingPlantQuantity,
} from './garden-presentation';
import {
  useSpiritGarden,
  type GardenAction,
  type GardenOutcome,
} from './useSpiritGarden';

type Item = InventoryView['items'][number];
type PlantTarget = { plotIndex: number; plantId: string };
type BatchPlantTarget = PlantTarget & { speciesName: string };
type ItemTarget =
  { purpose: 'sow'; plotIndex: number } | ({ purpose: 'evolve' } & PlantTarget);
type Panel =
  | ({ view: 'plant' | 'mature' | 'branch' | 'evolve' | 'clear' } & PlantTarget)
  | { view: 'mature-batch' | 'branch-batch'; targets: BatchPlantTarget[] }
  | { view: 'sow'; plotIndex: number }
  | { view: 'inventory' | 'vault'; target: ItemTarget }
  | { view: 'collection' | 'codex' }
  | { view: 'retire'; plantId: string }
  | { view: 'receipt'; result: GardenOutcome['result'] };
const targetKey = (target: ItemTarget) =>
  `${target.purpose}:${target.plotIndex}:${'plantId' in target ? target.plantId : ''}`;
const titles = {
  plant: '灵植详情',
  mature: '培育成株',
  'mature-batch': '批量培育成株',
  'branch-batch': '批量选择培养方向',
  branch: '选择培养方向',
  evolve: '灵植蜕变',
  sow: '栽种新灵植',
  inventory: '选择物品',
  vault: '洞府宝库 · 取出药材',
  collection: '灵植暂存',
  codex: '灵植图鉴',
  retire: '永久移除灵植',
  clear: '清理田块',
  receipt: '收成已领取',
};

export default function SpiritFieldPage() {
  const cultivatorId = usePlayerSession().data?.activeCultivator?.id;
  if (!cultivatorId) return <GameSceneLoading message="正在查看灵田……" />;
  return (
    <CultivatorSpiritField key={cultivatorId} cultivatorId={cultivatorId} />
  );
}

function CultivatorSpiritField({ cultivatorId }: { cultivatorId: string }) {
  const garden = useSpiritGarden();
  const { snapshot, locked } = garden;
  const { pushToast } = useInkUI();
  const bag = useInventoryBag();
  const currency = useCultivatorCurrency();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [evolutionResult, setEvolutionResult] = useState<{
    plantId: string;
    result: GardenOutcome['result'];
    cost: SpiritGardenPlantView['evolveCost'];
  } | null>(null);
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
  const batchPanel =
    panel?.view === 'mature-batch' || panel?.view === 'branch-batch'
      ? panel
      : null;
  const batchEntries =
    batchPanel?.targets.map((target) => {
      const plant = snapshot?.plots[target.plotIndex]?.plant;
      return { target, plant: plant?.id === target.plantId ? plant : null };
    }) ?? [];
  const batchReady = Boolean(
    snapshot &&
    batchPanel &&
    batchEntries.length > 0 &&
    batchEntries.every(
      ({ plant }) =>
        plant &&
        (batchPanel.view === 'mature-batch'
          ? plant.canMature
          : plant.canBranch),
    ),
  );
  useEffect(() => {
    if (!snapshot || !batchPanel || batchReady || locked) return;
    const timer = window.setTimeout(() => {
      setPanel((current) => (current === batchPanel ? null : current));
      pushToast({
        message: '部分灵植的状态已更新，请重新打开批量确认。',
        tone: 'warning',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [snapshot, batchPanel, batchReady, locked, pushToast]);
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
        isSpiritGardenSeed(facts.data.seedSpec.plant) &&
        canPlantSpiritGardenSeed(
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
    setEvolutionResult(null);
    storage.reload();
    if (
      action.endpoint === 'harvest' ||
      (action.endpoint === 'retire' && result.seeds?.length)
    ) {
      setPanel({ view: 'receipt', result });
      return;
    }
    if (action.endpoint === 'evolve' && typeof result.evolved === 'boolean') {
      const plant = snapshot?.plots[action.input.plotIndex]?.plant;
      if (plant?.id === action.input.plantId)
        setEvolutionResult({
          plantId: plant.id,
          result,
          cost: plant.evolveCost,
        });
    }
    pushToast({
      message:
        action.endpoint === 'evolve' && result.evolved === false
          ? '蜕变失败，本次费用已消耗。'
          : (result.message ?? '灵圃已更新'),
      tone:
        action.endpoint === 'evolve' && result.evolved === false
          ? 'warning'
          : 'success',
    });
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
      case 'mature':
      case 'branch':
      case 'evolve':
        setPanel({
          view: 'plant',
          plotIndex: action.input.plotIndex,
          plantId: action.input.plantId,
        });
        break;
      case 'mature-batch':
      case 'branch-batch':
        setPanel(null);
        break;
      case 'archive':
        setPanel({ view: 'collection' });
        break;
      case 'retire':
        if (action.input.plotIndex !== undefined) {
          setSelectedIndex(action.input.plotIndex);
          setPanel({ view: 'sow', plotIndex: action.input.plotIndex });
        } else {
          setPanel({ view: 'collection' });
        }
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
  function openBatch(view: 'mature-batch' | 'branch-batch') {
    if (!snapshot || locked) return;
    const targets = snapshot.plots.flatMap((plot) => {
      const plant = plot.plant;
      const ready =
        view === 'mature-batch' ? plant?.canMature : plant?.canBranch;
      return plant && ready
        ? [
            {
              plotIndex: plot.index,
              plantId: plant.id,
              speciesName: plant.speciesName,
            },
          ]
        : [];
    });
    if (!targets.length) return;
    setBranch(null);
    setSelection(null);
    setEvolutionResult(null);
    setPanel({ view, targets });
  }
  function selectPlot(index: number, action?: 'mature' | 'branch' | 'evolve') {
    if (!snapshot || locked) return;
    const plot = snapshot.plots[index];
    if (!plot) return;
    setSelectedIndex(index);
    setEvolutionResult(null);
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
        ? { view: action ?? 'plant', plotIndex: index, plantId: plot.plant.id }
        : { view: 'sow', plotIndex: index },
    );
  }

  if (!snapshot && !garden.readError)
    return <GameSceneLoading message="正在读取灵田……" />;
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
  const evolvedPreview =
    panel?.view === 'evolve' && validPanelPlant?.canEvolve
      ? getSpiritGardenEvolutionPreview(validPanelPlant, snapshot.player.realm)
      : null;
  const batchQi = batchReady
    ? batchEntries.reduce((sum, { plant }) => {
        if (!plant) return sum;
        return (
          sum +
          (batchPanel?.view === 'mature-batch'
            ? plant.matureQiCost
            : plant.branchQiCost)
        );
      }, 0)
    : null;
  const seed =
    panel?.view === 'sow' && chosen
      ? SeedFactsSchema.safeParse(chosen.instanceData)
      : null;
  const seedSpecies =
    seed?.success && isSpiritGardenSeed(seed.data.seedSpec.plant)
      ? getSpiritGardenSpecies(
          resolveSpiritGardenSpecies(seed.data.seedSpec.plant),
        )
      : null;
  const seedOutput = seedSpecies
    ? getSpiritGardenOutput({
        speciesId: seedSpecies.id,
        quality: seedSpecies.quality,
        branch: null,
      })
    : null;
  const retired =
    panel?.view === 'retire'
      ? snapshot.collection.find((entry) => entry.id === panel.plantId)
      : null;
  const inventoryTarget =
    panel?.view === 'inventory' || panel?.view === 'vault'
      ? panel.target
      : null;
  const inventoryPlantCandidate =
    inventoryTarget?.purpose === 'evolve'
      ? snapshot.plots[inventoryTarget.plotIndex]?.plant
      : null;
  const inventoryPlant =
    inventoryTarget?.purpose === 'evolve' &&
    inventoryPlantCandidate?.id === inventoryTarget.plantId
      ? inventoryPlantCandidate
      : null;
  const missingInventoryPlant =
    inventoryTarget?.purpose === 'evolve' && !inventoryPlant;
  const receiptProducts =
    panel?.view === 'receipt'
      ? (panel.result.products?.reduce(
          (sum, product) => sum + product.quantity,
          0,
        ) ?? 0)
      : 0;
  const receiptSeeds =
    panel?.view === 'receipt'
      ? (panel.result.seeds?.reduce((sum, seed) => sum + seed.quantity, 0) ?? 0)
      : 0;
  const inventory =
    panel?.view === 'inventory' ? (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-ink-secondary">
            {panel.target.purpose === 'sow'
              ? `为${panel.target.plotIndex + 1}号田选择灵种`
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
        {panel.target.purpose === 'sow' &&
        inventoryView &&
        !inventoryLoading &&
        !inventoryError &&
        !inventoryView.items.some(
          (item) =>
            matchesInventoryFilters(item, filter) &&
            canChoose(panel.target, item),
        ) ? (
          <InkNotice>
            当前列表没有符合要求的灵种。可调整筛选或查看储藏室，也可在出售灵种的坊市补充。
          </InkNotice>
        ) : null}
        {panel.target.purpose === 'evolve' && inventoryPlant ? (
          <p className="text-ink-secondary mb-4 text-sm leading-6">
            需选用同一叠药材：{inventoryPlant.evolveCost.materialQuality}
            及以上，至少{' '}
            <span className="font-mono">
              {inventoryPlant.evolveCost.quantity}
            </span>{' '}
            份。
          </p>
        ) : null}
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
              const seedFacts =
                item?.definitionId === 'seed.v1'
                  ? SeedFactsSchema.safeParse(item.instanceData)
                  : null;
              const legacySeed =
                seedFacts?.success &&
                !isSpiritGardenSeed(seedFacts.data.seedSpec.plant);
              const available =
                !!item &&
                matchesInventoryFilters(item, filter) &&
                canChoose(panel.target, item);
              const unavailableReason = legacySeed
                ? '旧灵种无法播种，请前往旧灵种转化。'
                : panel.target.purpose === 'sow'
                  ? seedFacts?.success
                    ? !canPlantSpiritGardenSeed(
                        snapshot.player.realm,
                        seedFacts.data.seedSpec.plant,
                      )
                      ? `栽种需要${SPIRIT_GARDEN_MIN_REALM[seedFacts.data.seedSpec.plant.quality]}及以上境界。`
                      : '不符合当前筛选条件，可调整筛选后选用。'
                    : '请选择灵种。'
                  : item && canChoose(panel.target, item)
                    ? '不符合当前筛选条件，可调整筛选后选用。'
                    : '请选择品质和数量符合要求的药材。';
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
                            {unavailableReason}
                          </p>
                        ) : null}
                        {legacySeed ? (
                          <InkButton
                            href="/game/seed-migration"
                            variant="secondary"
                          >
                            旧灵种转化
                          </InkButton>
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
          {panel.target.purpose === 'sow' ? (
            <InkButton
              href="/game/seed-migration"
              variant="secondary"
              disabled={locked}
            >
              旧灵种转化
            </InkButton>
          ) : (
            <InkButton
              disabled={locked}
              onClick={() => setPanel({ view: 'vault', target: panel.target })}
            >
              从洞府宝库取出药材
            </InkButton>
          )}
        </CraftInventoryPanel>
      </>
    ) : null;

  return (
    <GameSceneFrame
      variant="default"
      description="种下草木，收取药材与灵果，逐步培育出自己的灵圃。"
    >
      {garden.readError ? (
        <InkNotice tone="warning">
          {garden.readError}{' '}
          <InkButton onClick={() => void garden.refresh()}>重新读取</InkButton>
        </InkNotice>
      ) : null}
      {!panel ? notice : null}
      <GardenCanvas
        snapshot={snapshot}
        cultivatorId={cultivatorId}
        selectedIndex={selectedIndex}
        locked={locked}
        harvesting={garden.pendingAction === 'harvest'}
        claimingStarter={garden.pendingAction === 'starter'}
        restorePlant={restorePlant}
        onSelectPlot={selectPlot}
        onHarvest={() => void act({ endpoint: 'harvest', input: {} })}
        onOpenCollection={() => setPanel({ view: 'collection' })}
        onOpenCodex={() => setPanel({ view: 'codex' })}
        onStarter={() => void act({ endpoint: 'starter', input: {} })}
        onMatureBatch={() => openBatch('mature-batch')}
        onBranchBatch={() => openBatch('branch-batch')}
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
          {panel?.view === 'vault' && !missingInventoryPlant ? (
            <div className="space-y-4">
              <InkButton
                variant="secondary"
                onClick={() =>
                  setPanel({ view: 'inventory', target: panel.target })
                }
              >
                返回选择药材
              </InkButton>
              <VaultWithdrawalList
                onChanged={() => {
                  bag.invalidate();
                  storage.reload();
                  void garden.refresh();
                }}
              />
            </div>
          ) : null}
          {batchPanel ? (
            <div className="space-y-6 text-sm leading-7">
              <InkButton
                variant="secondary"
                disabled={locked}
                onClick={() => setPanel(null)}
              >
                返回灵田
              </InkButton>
              <p className="text-ink-secondary">
                {batchPanel.view === 'mature-batch'
                  ? '为下列幼苗一并投入灵气，使其成株。每株立即获得首批收成，并开始计算生产寿命。'
                  : '为下列灵植选择同一培养方向，每株只能选择一次，确认后无法更改。'}
              </p>
              {batchPanel.view === 'branch-batch' ? (
                <div
                  className="flex flex-wrap gap-3"
                  role="group"
                  aria-label="本批培养方向"
                >
                  <InkChoiceButton
                    selected={branch === 'abundance'}
                    disabled={locked}
                    onClick={() => setBranch('abundance')}
                  >
                    全部药材增产{branch === 'abundance' ? ' · 已选' : ''}
                  </InkChoiceButton>
                  <InkChoiceButton
                    selected={branch === 'essence'}
                    disabled={locked}
                    onClick={() => setBranch('essence')}
                  >
                    全部改产灵果或天材地宝
                    {branch === 'essence' ? ' · 已选' : ''}
                  </InkChoiceButton>
                </div>
              ) : null}
              <ul className="divide-ink/10 divide-y">
                {batchEntries.map(({ target, plant }) => {
                  const species = snapshot.species.find(
                    (entry) => entry.id === plant?.speciesId,
                  );
                  const output =
                    plant && (batchPanel.view === 'mature-batch' || branch)
                      ? getSpiritGardenOutput(
                          batchPanel.view === 'branch-batch' && branch
                            ? { ...plant, branch }
                            : plant,
                        )
                      : null;
                  return (
                    <li
                      key={`${target.plotIndex}:${target.plantId}`}
                      className="space-y-1 py-3 first:pt-0"
                    >
                      <p>
                        <span className="text-ink-secondary">
                          <span className="font-mono">
                            {target.plotIndex + 1}
                          </span>
                          号田 ·{' '}
                        </span>
                        {target.speciesName}
                      </p>
                      <p className="text-ink-secondary text-xs">
                        {output ? (
                          <>
                            {batchPanel.view === 'branch-batch' &&
                            branch &&
                            species
                              ? `${species.branches[branch].name} · `
                              : '成株后 · '}
                            {output.name}
                          </>
                        ) : (
                          '选定方向后查看产物'
                        )}
                      </p>
                      {output ? (
                        <p className="text-ink-secondary text-xs">
                          每{' '}
                          <span className="font-mono">
                            {formatGardenDuration(output.cycleMs)}
                          </span>{' '}
                          产出{' '}
                          <span className="font-mono">{output.quantity}</span>{' '}
                          份
                        </p>
                      ) : null}
                      {plant ? (
                        <p className="text-ink-secondary text-xs">
                          <span className="font-mono">
                            {batchPanel.view === 'mature-batch'
                              ? plant.matureQiCost
                              : plant.branchQiCost}
                          </span>{' '}
                          天地灵气
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="border-ink/10 space-y-2 border-y py-4">
                <p>
                  合计消耗 <span className="font-mono">{batchQi ?? '—'}</span>{' '}
                  天地灵气
                </p>
                <p className="text-ink-secondary text-xs">
                  当前天地灵气{' '}
                  <span className="font-mono">{currency.data?.qi ?? '—'}</span>
                </p>
                {currency.error ? (
                  <p className="text-crimson text-xs">{currency.error}</p>
                ) : null}
              </div>
              {!batchReady ? (
                <InkNotice tone="warning">
                  部分灵植的状态已更新，请返回灵田重新选择。
                </InkNotice>
              ) : null}
              {batchQi !== null &&
              currency.data &&
              currency.data.qi < batchQi ? (
                <p className="text-crimson">
                  当前天地灵气不足，需备足本批全部消耗后再试。
                </p>
              ) : null}
              <InkButton
                variant="primary"
                className="w-full justify-center"
                pending={garden.busy}
                disabled={
                  locked ||
                  !batchReady ||
                  batchQi === null ||
                  currency.loading ||
                  Boolean(currency.error) ||
                  !currency.data ||
                  currency.data.qi < batchQi ||
                  (batchPanel.view === 'branch-batch' && !branch)
                }
                onClick={() => {
                  if (!batchReady) return;
                  const targets = batchPanel.targets.map(
                    ({ plotIndex, plantId }) => ({ plotIndex, plantId }),
                  );
                  if (batchPanel.view === 'mature-batch')
                    void act({ endpoint: 'mature-batch', input: { targets } });
                  else if (branch)
                    void act({
                      endpoint: 'branch-batch',
                      input: { targets, branch },
                    });
                }}
              >
                {batchPanel.view === 'mature-batch'
                  ? '确认批量培育成株'
                  : '确认批量选择培养方向'}
              </InkButton>
            </div>
          ) : null}
          {panel?.view === 'plant' &&
          validPanelPlant &&
          evolutionResult?.plantId === validPanelPlant.id ? (
            <div
              className={`mb-6 space-y-2 border-l-2 pl-3 text-sm leading-7 ${evolutionResult.result.evolved ? 'border-teal text-teal' : 'border-crimson text-ink'}`}
              role="status"
            >
              <p className="font-semibold">
                {evolutionResult.result.evolved ? '蜕变成功' : '蜕变失败'}
              </p>
              <p className="text-ink-secondary text-xs">
                本次已消耗{' '}
                <span className="font-mono">{evolutionResult.cost.qi}</span>{' '}
                天地灵气、{' '}
                <SpiritStones amount={evolutionResult.cost.spiritStones} /> 与{' '}
                <span className="font-mono">
                  {evolutionResult.cost.quantity}
                </span>{' '}
                份{evolutionResult.cost.materialQuality}及以上药材。
              </p>
              {evolutionResult.result.evolved === false ? (
                <p className="text-ink-secondary text-xs">
                  保留当前形态，仍按原培养方向产出。剩余尝试{' '}
                  <span className="font-mono">
                    {validPanelPlant.evolutionAttemptsRemaining}
                  </span>{' '}
                  次。
                  {validPanelPlant.evolutionAttemptsRemaining === 0
                    ? '本株蜕变次数已用完，无法再次尝试。'
                    : null}
                  {validPanelPlant.evolutionAttemptsRemaining > 0 &&
                  validPanelPlant.evolveCooldownRemainingMs > 0 ? (
                    <>
                      再在田中生长约{' '}
                      <span className="font-mono">
                        {formatGardenDuration(
                          validPanelPlant.evolveCooldownRemainingMs,
                        )}
                      </span>{' '}
                      后可重试。
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
          {panel?.view === 'inventory' && !missingInventoryPlant
            ? inventory
            : null}
          {panel?.view === 'plant' &&
          validPanelPlant &&
          species &&
          plantTarget ? (
            <GardenPlantDetail
              plant={validPanelPlant}
              species={species}
              allSpecies={snapshot.species}
              elapsedMs={elapsedMs}
              locked={locked}
              onMature={() => setPanel({ view: 'mature', ...plantTarget })}
              onBranch={() => {
                setBranch(null);
                setPanel({ view: 'branch', ...plantTarget });
              }}
              onEvolve={() => setPanel({ view: 'evolve', ...plantTarget })}
              onHarvest={() => void act({ endpoint: 'harvest', input: {} })}
              onClear={() => setPanel({ view: 'clear', ...plantTarget })}
              onArchive={() => {
                if (
                  snapshot.collection.length >= snapshot.profile.collectionLimit
                ) {
                  pushToast({
                    message:
                      '暂存区已满。请先移回灵植，或领取收成后永久移除多余灵植，腾出空位。',
                    tone: 'danger',
                  });
                  setPanel({ view: 'collection' });
                  return;
                }
                void act({ endpoint: 'archive', input: plantTarget });
              }}
            />
          ) : null}
          {panel?.view === 'mature' && validPanelPlant && plantTarget ? (
            <div className="space-y-6 text-sm leading-7">
              <InkButton
                variant="secondary"
                onClick={backToPlant}
                disabled={locked}
              >
                返回灵植详情
              </InkButton>
              <div className="flex items-center gap-5">
                <BotanicalArt
                  speciesId={validPanelPlant.speciesId}
                  stage={validPanelPlant.stage}
                  className="w-24 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold">
                    {validPanelPlant.speciesName}
                  </h3>
                  <p className="text-ink-secondary mt-2">
                    消耗天地灵气，将幼苗培育成株。
                  </p>
                </div>
              </div>
              <p className="text-ink-secondary">
                成株后立即获得首批收成，之后按周期生产。生产寿命从成株时开始计算，幼苗等待期间不消耗寿命。
              </p>
              <div className="border-ink/10 space-y-2 border-y py-4">
                <p>
                  本次消耗{' '}
                  <span className="font-mono">
                    {validPanelPlant.matureQiCost}
                  </span>{' '}
                  天地灵气
                </p>
                <p className="text-ink-secondary text-xs">
                  当前天地灵气{' '}
                  <span className="font-mono">{currency.data?.qi ?? '—'}</span>
                </p>
                {currency.error ? (
                  <p className="text-crimson text-xs">{currency.error}</p>
                ) : null}
              </div>
              {!validPanelPlant.canMature ? (
                <InkNotice>
                  幼苗尚未达到成株条件，或已经完成成株，请返回查看最新长势。
                </InkNotice>
              ) : null}
              {currency.data &&
              currency.data.qi < validPanelPlant.matureQiCost ? (
                <p className="text-crimson">当前天地灵气不足。</p>
              ) : null}
              <InkButton
                variant="primary"
                className="w-full justify-center"
                pending={garden.busy}
                disabled={
                  locked ||
                  !validPanelPlant.canMature ||
                  currency.loading ||
                  Boolean(currency.error) ||
                  !currency.data ||
                  currency.data.qi < validPanelPlant.matureQiCost
                }
                onClick={() =>
                  void act({ endpoint: 'mature', input: plantTarget })
                }
              >
                培育成株
              </InkButton>
            </div>
          ) : null}
          {panel?.view === 'branch' &&
          validPanelPlant &&
          species &&
          plantTarget ? (
            <GardenBranchChoice
              plant={validPanelPlant}
              species={species}
              realm={snapshot.player.realm}
              selectedBranch={branch}
              qi={currency.data?.qi}
              currencyUnavailable={currency.loading || Boolean(currency.error)}
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
                返回灵植详情
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
                    蜕变成功后，之后产物的品质提升一档。
                  </p>
                </div>
              </div>
              <p className="text-ink-secondary">
                成功后只提高之后产物的品质，原种品质不变。已积蓄的收成、当前生产进度与剩余寿命都会保留。
              </p>
              <div className="space-y-2 text-xs leading-6">
                <p>
                  本次成功率{' '}
                  <span className="font-mono">
                    {Math.round(validPanelPlant.evolveSuccessChance * 100)}%
                  </span>
                  ，剩余尝试{' '}
                  <span className="font-mono">
                    {validPanelPlant.evolutionAttemptsRemaining}
                  </span>{' '}
                  次。
                </p>
                <p className="text-crimson">
                  无论成功或失败，均消耗全部费用和一次机会。失败后仍按原培养方向产出。
                  {validPanelPlant.evolutionAttemptsRemaining > 1 ? (
                    <>
                      再在田中生长{' '}
                      <span className="font-mono">
                        {formatGardenDuration(
                          SPIRIT_GARDEN_EVOLUTION_COOLDOWN_MS,
                        )}
                      </span>{' '}
                      后可重试；收成已满或灵植处于暂存区时暂停冷却计时。
                    </>
                  ) : (
                    '这是最后一次尝试，失败后无法再次蜕变。'
                  )}
                  每株最多尝试{' '}
                  <span className="font-mono">
                    {SPIRIT_GARDEN_EVOLUTION_ATTEMPT_LIMIT}
                  </span>{' '}
                  次。
                </p>
              </div>
              <div className="border-ink/10 border-y py-4">
                {evolvedPreview ? (
                  <div className="mb-4 space-y-1">
                    <p>
                      {evolvedPreview.mutated
                        ? '升品后基础周期每 '
                        : '升品后每 '}
                      <span className="font-mono">
                        {formatGardenDuration(evolvedPreview.output.cycleMs)}
                      </span>{' '}
                      产{' '}
                      <span className="font-mono">
                        {evolvedPreview.output.quantity}
                      </span>{' '}
                      份{evolvedPreview.output.name}，预计还能收{' '}
                      <span className="font-mono">
                        {evolvedPreview.remainingHarvestCycles}
                      </span>{' '}
                      轮。
                    </p>
                    {evolvedPreview.remainingHarvestCycles === 0 ? (
                      <p className="text-ink-secondary text-xs">
                        剩余生产时间不足一轮。
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p>本次投入</p>
                <p className="mt-2">
                  <span className="font-mono">
                    {validPanelPlant.evolveCost.qi}
                  </span>{' '}
                  天地灵气、{' '}
                  <SpiritStones
                    amount={validPanelPlant.evolveCost.spiritStones}
                  />{' '}
                  与{' '}
                  <span className="font-mono">
                    {validPanelPlant.evolveCost.quantity}
                  </span>{' '}
                  份{validPanelPlant.evolveCost.materialQuality}及以上药材
                </p>
                <p className="text-ink-secondary mt-2 text-xs">
                  当前天地灵气{' '}
                  <span className="font-mono">{currency.data?.qi ?? '—'}</span>
                </p>
                {currency.error ? (
                  <p className="text-crimson mt-2 text-xs">{currency.error}</p>
                ) : null}
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
                pending={garden.busy}
                disabled={
                  locked ||
                  !chosen ||
                  !canChoose(itemTarget, chosen) ||
                  currency.loading ||
                  Boolean(currency.error) ||
                  !currency.data ||
                  currency.data.qi < validPanelPlant.evolveCost.qi ||
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
                投入并尝试蜕变
              </InkButton>
              {snapshot.player.spiritStones <
              validPanelPlant.evolveCost.spiritStones ? (
                <p className="text-crimson">当前灵石不足。</p>
              ) : null}
              {currency.data &&
              currency.data.qi < validPanelPlant.evolveCost.qi ? (
                <p className="text-crimson">当前天地灵气不足。</p>
              ) : null}
            </div>
          ) : null}
          {panel?.view === 'sow' && itemTarget ? (
            <div className="space-y-6 text-sm leading-7">
              <p className="text-ink-secondary">
                <span className="font-mono">{panel.plotIndex + 1}</span>号田
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
                        <span className="font-mono">1</span> 枚
                      </p>
                    ) : null}
                    <p className="text-ink-secondary mt-2">
                      {seedSpecies.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="garden-planting-note">
                  <p className="text-lg">选择一枚灵种，种下新的草木。</p>
                  <p className="text-ink-secondary mt-2">
                    幼苗长足后，投入天地灵气使其成株，即可开始收取产物。
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
              {seedSpecies && seedOutput ? (
                <div className="border-ink/10 space-y-2 border-y py-4">
                  <dl className="grid grid-cols-2 gap-3 text-xs leading-6">
                    <div>
                      <dt className="text-ink-secondary">幼苗生长</dt>
                      <dd className="font-mono">
                        {formatGardenDuration(seedSpecies.matureMs)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-secondary">成株投入</dt>
                      <dd>
                        <span className="font-mono">
                          {SPIRIT_GARDEN_MATURE_QI_COSTS[seedSpecies.quality]}
                        </span>{' '}
                        天地灵气
                      </dd>
                    </div>
                  </dl>
                  <p className="pt-2">成株产物 · {seedOutput.name}</p>
                  <p className="text-ink-secondary text-xs">
                    成株时获得首批收成，之后每{' '}
                    <span className="font-mono">
                      {formatGardenDuration(seedOutput.cycleMs)}
                    </span>{' '}
                    产出{' '}
                    <span className="font-mono">{seedOutput.quantity}</span>{' '}
                    份。
                  </p>
                </div>
              ) : null}
              <InkButton
                variant="primary"
                className="w-full justify-center"
                pending={garden.busy}
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
                {chosen ? `栽入${panel.plotIndex + 1}号田` : '先选择灵种'}
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
            />
          ) : null}
          {panel?.view === 'retire' && retired ? (
            <div className="space-y-6 text-sm leading-7">
              <InkButton
                variant="secondary"
                onClick={() => setPanel({ view: 'collection' })}
              >
                返回灵植暂存
              </InkButton>
              <div className="flex items-center gap-5">
                <BotanicalArt
                  speciesId={retired.speciesId}
                  stage={retired.stage}
                  className="w-24 shrink-0"
                />
                <div>
                  <h3 className="text-xl font-semibold">
                    {retired.speciesName}
                  </h3>
                  <p className="text-ink-secondary">
                    {retired.outputQuality} · 养成记录会永久保留。
                  </p>
                </div>
              </div>
              <InkNotice tone="warning">
                这株灵植将永久移出暂存区，无法恢复。投入的物资和天地灵气不会返还。
              </InkNotice>
              <InkButton
                variant="primary"
                className="w-full justify-center"
                pending={garden.busy}
                disabled={locked || pendingPlantQuantity(retired) > 0}
                onClick={() =>
                  void act({
                    endpoint: 'retire',
                    input: { plantId: retired.id },
                  })
                }
              >
                确认永久移除灵植
              </InkButton>
            </div>
          ) : null}
          {panel?.view === 'clear' && validPanelPlant && plantTarget ? (
            <div className="space-y-6 text-sm leading-7">
              <InkButton
                variant="secondary"
                disabled={locked}
                onClick={backToPlant}
              >
                返回灵植详情
              </InkButton>
              <p>
                清理停止产出的{validPanelPlant.speciesName}，腾出{' '}
                <span className="font-mono">{panel.plotIndex + 1}</span>
                号田。养成记录保留。
              </p>
              <p className="text-teal">
                本次有{' '}
                <span className="font-mono">
                  {Math.round(SPIRIT_GARDEN_CLEAR_SEED_CHANCE * 100)}%
                </span>{' '}
                概率获得 <span className="font-mono">1</span> 枚
                {validPanelPlant.quality}
                {gardenSeedName(validPanelPlant.speciesId, snapshot.species)}。
              </p>
              <p className="text-ink-secondary">
                获得的种子保持原物种与原种品质，蜕变不提高种子品质。
              </p>
              <InkButton
                variant="primary"
                className="w-full justify-center"
                pending={garden.busy}
                disabled={
                  locked ||
                  !validPanelPlant.exhausted ||
                  pendingPlantQuantity(validPanelPlant) > 0
                }
                onClick={() =>
                  void act({ endpoint: 'retire', input: plantTarget })
                }
              >
                确认清理<span className="font-mono">{panel.plotIndex + 1}</span>
                号田
              </InkButton>
            </div>
          ) : null}
          {panel?.view === 'receipt' ? (
            <div className="space-y-6 text-sm leading-7">
              <div className="border-ink/10 border-b pb-5">
                <p className="text-ink-secondary">这一次的收成</p>
                <div className="text-teal mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-3xl">
                  {receiptProducts > 0 ? (
                    <p>
                      <span className="font-mono">{receiptProducts}</span>
                      <span className="ml-2 text-base">份产物</span>
                    </p>
                  ) : null}
                  {receiptSeeds > 0 ? (
                    <p>
                      <span className="font-mono">{receiptSeeds}</span>
                      <span className="ml-2 text-base">枚灵种</span>
                    </p>
                  ) : null}
                </div>
                {snapshot.plots.some((plot) => plot.plant?.exhausted) ? (
                  <p className="text-ink-secondary mt-3">
                    停止产出的灵植可以清理后重新栽种。
                  </p>
                ) : null}
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
                {panel.result.seeds?.map((seed, index) => (
                  <li
                    key={`seed:${seed.speciesId}:${index}`}
                    className="flex items-center gap-4"
                  >
                    <BotanicalArt
                      speciesId={seed.speciesId}
                      stage="seedling"
                      className="w-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p>{gardenSeedName(seed.speciesId, snapshot.species)}</p>
                      <p className="text-ink-secondary text-xs">
                        {seed.quality}
                      </p>
                    </div>
                    <span className="font-mono">×{seed.quantity}</span>
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
                回到灵田
              </InkButton>
            </div>
          ) : null}
          {(panel &&
            ['plant', 'mature', 'branch', 'evolve', 'clear'].includes(
              panel.view,
            ) &&
            !validPanelPlant) ||
          missingInventoryPlant ? (
            <div className="space-y-3">
              <InkNotice>这株灵植已经移动，请返回灵田重新查看。</InkNotice>
              <InkButton
                variant="secondary"
                disabled={locked}
                onClick={() => {
                  setSelection(null);
                  setPanel(null);
                }}
              >
                返回灵田
              </InkButton>
            </div>
          ) : null}
        </div>
      </InkDetailDrawer>
    </GameSceneFrame>
  );
}
