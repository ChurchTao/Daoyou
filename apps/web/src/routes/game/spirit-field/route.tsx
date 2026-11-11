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
import { InkButton, InkChoiceButton, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import { useCultivatorCurrency } from '@app/lib/resources/player';
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
  getSpiritGardenEvolutionPreview,
  getSpiritGardenOutput,
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
  | ({ view: 'plant' | 'mature' | 'branch' | 'evolve' } & PlantTarget)
  | { view: 'mature-batch' | 'branch-batch'; targets: BatchPlantTarget[] }
  | { view: 'sow'; plotIndex: number }
  | { view: 'inventory'; target: ItemTarget }
  | { view: 'collection' | 'codex' }
  | { view: 'retire'; plantId: string }
  | { view: 'receipt'; result: GardenOutcome['result'] };
const targetKey = (target: ItemTarget) =>
  `${target.purpose}:${target.plotIndex}:${'plantId' in target ? target.plantId : ''}`;
const titles = {
  plant: '灵植小记',
  mature: '引灵成株',
  'mature-batch': '批量引灵成株',
  'branch-batch': '批量蕴灵定向',
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
        message: '本批灵植的身份或长势已变化，请重新打开批量确认。',
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
    setEvolutionResult(null);
    storage.reload();
    if (action.endpoint === 'harvest') {
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
          ? '蜕变未成，本次费用已消耗。'
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
  function selectPlot(index: number) {
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
          {batchPanel ? (
            <div className="space-y-6 text-sm leading-7">
              <InkButton
                variant="secondary"
                disabled={locked}
                onClick={() => setPanel(null)}
              >
                返回灵圃
              </InkButton>
              <p className="text-ink-secondary">
                {batchPanel.view === 'mature-batch'
                  ? '为下列幼苗一并引灵成株，迎来首批收成并开始生产寿命。'
                  : '为下列灵植一并引灵定向，所选方向适用于本次全部目标。'}
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
                    全部繁茂{branch === 'abundance' ? ' · 已选' : ''}
                  </InkChoiceButton>
                  <InkChoiceButton
                    selected={branch === 'essence'}
                    disabled={locked}
                    onClick={() => setBranch('essence')}
                  >
                    各株特化{branch === 'essence' ? ' · 已选' : ''}
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
                          第{' '}
                          <span className="font-mono">
                            {target.plotIndex + 1}
                          </span>{' '}
                          畦 ·{' '}
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
                  所选灵植的身份或长势已变化，请返回灵圃重新选择。
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
                  ? '为本批引灵成株'
                  : '为本批确定方向'}
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
                {evolutionResult.result.evolved ? '蜕变已成' : '蜕变未成'}
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
                  保留当前形态与产物，照常生产。剩余尝试{' '}
                  <span className="font-mono">
                    {validPanelPlant.evolutionAttemptsRemaining}
                  </span>{' '}
                  次。
                  {validPanelPlant.evolutionAttemptsRemaining > 0 &&
                  validPanelPlant.evolveCooldownRemainingMs > 0 ? (
                    <>
                      再有效在田长养约{' '}
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
          {panel?.view === 'inventory' ? inventory : null}
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
              onClear={() =>
                void act({ endpoint: 'retire', input: plantTarget })
              }
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
          {panel?.view === 'mature' && validPanelPlant && plantTarget ? (
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
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold">
                    {validPanelPlant.speciesName}
                  </h3>
                  <p className="text-ink-secondary mt-2">
                    引自身天地灵气，助幼苗成株。
                  </p>
                </div>
              </div>
              <p className="text-ink-secondary">
                成株后迎来首批收成，开始周期生产与生产寿命计时。等待成株期间，寿命尚未开始。
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
                  幼苗尚未养足根基，或已经完成成株，请返回查看最新长势。
                </InkNotice>
              ) : null}
              {currency.data &&
              currency.data.qi < validPanelPlant.matureQiCost ? (
                <p className="text-crimson">当前天地灵气不足。</p>
              ) : null}
              <InkButton
                variant="primary"
                className="w-full justify-center"
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
                引灵成株
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
                    蜕变成功后，今后的收成提高一品。
                  </p>
                </div>
              </div>
              <p className="text-ink-secondary">
                引自身天地灵气，助植株跨阶。已积蓄的收成保留原品质，当前进度与剩余生产时间都会保留。
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
                  每次尝试均实扣全部费用。失败后保持当前形态与产物，再有效在田长养{' '}
                  <span className="font-mono">24</span> 小时后可重试，最多尝试{' '}
                  <span className="font-mono">3</span> 次。
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
                第 <span className="font-mono">{panel.plotIndex + 1}</span> 畦 ·
                种下后先在田扎根，长足后可引灵成株。
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
                    灵种决定物种与品阶，引灵成株后按周期产出，直到采尽。
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
                disabled={locked || pendingPlantQuantity(retired) > 0}
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
                {snapshot.plots.some((plot) => plot.plant?.exhausted) ? (
                  <p className="text-ink-secondary mt-3">
                    采尽的灵植可以清畦重种。
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
                回到灵圃
              </InkButton>
            </div>
          ) : null}
          {panel &&
          ['plant', 'mature', 'branch', 'evolve'].includes(panel.view) &&
          !validPanelPlant ? (
            <InkNotice>这株灵植已经移动，请返回灵圃重新查看。</InkNotice>
          ) : null}
        </div>
      </InkDetailDrawer>
    </GameSceneFrame>
  );
}
