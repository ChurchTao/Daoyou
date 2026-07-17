import { SectAbilityDetails } from '@app/components/feature/sect/SectAbilityDetails';
import {
  InkButton,
  InkCard,
  InkDetailDrawer,
  InkNotice,
  InkTabs,
} from '@app/components/ui';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { getRealmStageRank } from '@shared/config/realmProgression';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  getPathProgress,
  isMeridianLayerAvailable,
  type CultivatorSectPathState,
  type CultivatorSectState,
  type ResolvedSectAbility,
  type SectPathDefinition,
  type SectPathLayerDefinition,
} from '@shared/engine/sect';
import { resolveSectPathPreview } from '@shared/engine/sect/content';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMeridianDrafts,
  getMeridianFooterAction,
  hasDirtyMeridianDraft,
  isMeridianDraftDirty,
  mergeFreshMeridianState,
  toggleMeridianNode,
  type MeridianDrafts,
  type MeridianSlot,
} from './pathEditorState';
import { sectJsonRequest, type SectAction } from './types';

type DrawerTab = 'changes' | 'meridians';
const SLOT_NAMES: Record<MeridianSlot, string> = {
  1: '一',
  2: '二',
  3: '三',
};

function getUnlockDisabledReason(args: {
  layer: SectPathLayerDefinition | null;
  nextLayerAvailable: boolean;
  missingRequirements: string[];
  cultivationExp: number;
  comprehensionInsight: number;
  spiritStones: number;
}) {
  if (!args.layer) return '六层皆已参悟';
  if (!args.nextLayerAvailable)
    return args.missingRequirements.length
      ? `尚需：${args.missingRequirements.join('、')}`
      : '尚未满足参悟条件';
  if (args.cultivationExp < args.layer.cost.cultivationExp) return '修为不足';
  if (args.comprehensionInsight < args.layer.cost.comprehensionInsight)
    return '道心感悟不足';
  if (args.spiritStones < args.layer.cost.spiritStones) return '灵石不足';
  return undefined;
}

function abilitySignature(detail: ResolvedSectAbility): string {
  return JSON.stringify({
    manaCost: detail.manaCost,
    cooldown: detail.cooldown,
    detailRows: detail.detailRows,
    notes: detail.notes,
  });
}

export function PathsTab({
  data,
  busy,
  action,
  realm,
  stage,
}: {
  data: SectCurrentData;
  busy: boolean;
  action: SectAction;
  realm: RealmType;
  stage: RealmStage;
}) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  if (!data.sect || !data.definition)
    return <InkNotice>拜师后方可研习宗门流派。</InkNotice>;
  const sect = data.sect;
  const definition = data.definition;
  const selectedPath = selectedPathId
    ? definition.paths.find((path) => path.id === selectedPathId)
    : undefined;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {definition.paths.map((path) => {
          const state = sect.paths.find((entry) => entry.pathId === path.id);
          const active = sect.activePathId === path.id;
          const realmLocked =
            getRealmStageRank(realm, stage) <
            getRealmStageRank(path.minRealm, path.minRealmStage);
          const status = realmLocked
            ? `${path.minRealm}${path.minRealmStage}后可参悟`
            : active
              ? '当前流派'
              : state
                ? '已习得'
                : '尚未习得';
          return (
            <InkCard key={path.id} padding="none">
              <button
                type="button"
                className="hover:bg-ink/4 w-full p-3 text-left transition-colors"
                onClick={() => setSelectedPathId(path.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <strong>{path.name}</strong>
                  <span className="text-crimson shrink-0 text-sm">
                    {status}
                  </span>
                </div>
                <p className="text-ink-secondary mt-2 text-sm leading-6">
                  {path.description}
                </p>
                {path.presentation?.highlights.length ? (
                  <p className="mt-2 text-sm">
                    {path.presentation.highlights
                      .map((item) => item.name)
                      .join(' · ')}
                  </p>
                ) : null}
                <p className="text-ink-secondary mt-2 text-xs">
                  已参悟 {state?.unlockedLayerIds.length ?? 0} /{' '}
                  {path.layers.length}层
                </p>
              </button>
            </InkCard>
          );
        })}
      </div>

      {selectedPath ? (
        <PathDrawer
          key={selectedPath.id}
          path={selectedPath}
          state={sect.paths.find((entry) => entry.pathId === selectedPath.id)}
          sect={sect}
          active={sect.activePathId === selectedPath.id}
          busy={busy}
          action={action}
          realm={realm}
          stage={stage}
          onClose={() => setSelectedPathId(null)}
        />
      ) : null}
    </>
  );
}

function PathDrawer({
  path,
  state,
  sect,
  active,
  busy,
  action,
  realm,
  stage,
  onClose,
}: {
  path: SectPathDefinition;
  state?: CultivatorSectPathState;
  sect: CultivatorSectState;
  active: boolean;
  busy: boolean;
  action: SectAction;
  realm: RealmType;
  stage: RealmStage;
  onClose: () => void;
}) {
  const cultivator = useActiveCultivatorProfile();
  const [tab, setTab] = useState<DrawerTab>('changes');
  const [expandedAbilityId, setExpandedAbilityId] = useState<string | null>(
    null,
  );
  const [slot, setSlot] = useState<MeridianSlot>(
    state?.activeMeridianSlot ?? 1,
  );
  const [drafts, setDrafts] = useState<MeridianDrafts>(() =>
    createMeridianDrafts(state),
  );
  const [saved, setSaved] = useState<MeridianDrafts>(() =>
    createMeridianDrafts(state),
  );
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const draftsRef = useRef(drafts);
  const savedRef = useRef(saved);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  const stateSignature = JSON.stringify({
    unlockedLayerIds: state?.unlockedLayerIds,
    activeMeridianSlot: state?.activeMeridianSlot,
    meridianLoadouts: state?.meridianLoadouts,
  });
  useEffect(() => {
    const fresh = createMeridianDrafts(state);
    setDrafts(
      mergeFreshMeridianState(draftsRef.current, savedRef.current, fresh),
    );
    setSaved(fresh);
    if (state) setSlot((current) => current ?? state.activeMeridianSlot);
  }, [state, stateSignature]);

  const preview = useMemo(
    () => resolveSectPathPreview({ sect, realm, pathId: path.id }),
    [path.id, realm, sect],
  );
  const progress = getPathProgress({
    path,
    unlockedLayerIds: state?.unlockedLayerIds ?? [],
    realm,
    stage,
    methods: sect.methods,
  });
  const realmLocked =
    getRealmStageRank(realm, stage) <
    getRealmStageRank(path.minRealm, path.minRealmStage);
  const cultivationExp = cultivator?.cultivation_progress?.cultivation_exp ?? 0;
  const comprehensionInsight =
    cultivator?.cultivation_progress?.comprehension_insight ?? 0;
  const spiritStones = cultivator?.spirit_stones ?? 0;
  const nextLayer = progress.nextLayer;
  const unlockDisabledReason = getUnlockDisabledReason({
    layer: nextLayer,
    nextLayerAvailable: progress.nextLayerAvailable,
    missingRequirements: progress.missingRequirements,
    cultivationExp,
    comprehensionInsight,
    spiritStones,
  });
  const anyDirty = hasDirtyMeridianDraft(drafts, saved);
  const meridianFooterAction = state
    ? getMeridianFooterAction({
        drafts,
        saved,
        slot,
        activeSlot: state.activeMeridianSlot,
      })
    : undefined;

  const requestClose = () => {
    if (anyDirty) setDiscardConfirm(true);
    else onClose();
  };

  const unlockLayer = async () => {
    if (!nextLayer) return;
    await action(
      `/api/sects/current/paths/${path.id}/layers/${nextLayer.id}/unlock`,
      sectJsonRequest('POST'),
    );
    setConfirmUnlock(false);
  };

  const saveDraft = async () => {
    await action(
      `/api/sects/current/paths/${path.id}/meridian-loadouts/${slot}`,
      sectJsonRequest('PUT', { nodeIds: drafts[slot] }),
    );
    setSaved((current) => ({ ...current, [slot]: [...drafts[slot]] }));
  };

  const footer = discardConfirm ? (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-crimson">参悟方案尚未保存，是否放弃本次修改？</p>
      <div className="flex gap-2">
        <InkButton onClick={() => setDiscardConfirm(false)}>继续编辑</InkButton>
        <InkButton variant="primary" onClick={onClose}>
          放弃修改
        </InkButton>
      </div>
    </div>
  ) : tab === 'changes' ? (
    <PathOverviewFooter
      path={path}
      state={state}
      active={active}
      realmLocked={realmLocked}
      nextLayer={nextLayer}
      disabledReason={unlockDisabledReason}
      cultivationExp={cultivationExp}
      comprehensionInsight={comprehensionInsight}
      spiritStones={spiritStones}
      busy={busy}
      onUnlock={() => void unlockLayer()}
      onActivate={() =>
        void action(
          `/api/sects/current/paths/${path.id}/activate`,
          sectJsonRequest('POST'),
        )
      }
    />
  ) : confirmUnlock ? (
    <UnlockFooter
      layer={nextLayer}
      disabledReason={unlockDisabledReason}
      cultivationExp={cultivationExp}
      comprehensionInsight={comprehensionInsight}
      spiritStones={spiritStones}
      busy={busy}
      onCancel={() => setConfirmUnlock(false)}
      onConfirm={() => void unlockLayer()}
    />
  ) : realmLocked ? (
    <p className="text-crimson text-sm">
      {path.minRealm}
      {path.minRealmStage}后可参悟
    </p>
  ) : !state ? (
    <UnlockFooter
      layer={nextLayer}
      disabledReason={unlockDisabledReason}
      cultivationExp={cultivationExp}
      comprehensionInsight={comprehensionInsight}
      spiritStones={spiritStones}
      busy={busy}
      onConfirm={() => void unlockLayer()}
    />
  ) : meridianFooterAction === 'save' ? (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-crimson">
        参悟方案{SLOT_NAMES[slot]}尚未保存。
      </p>
      <InkButton
        variant="primary"
        disabled={busy}
        onClick={() => void saveDraft()}
      >
        {busy ? '保存中' : '保存参悟方案'}
      </InkButton>
    </div>
  ) : meridianFooterAction === 'resolve-dirty' ? (
    <p className="text-crimson text-sm">
      其他参悟方案有未保存修改，请先保存参悟方案。
    </p>
  ) : meridianFooterAction === 'activate' ? (
    <div className="flex justify-end">
      <InkButton
        variant="primary"
        disabled={busy}
        onClick={() =>
          void action(
            `/api/sects/current/paths/${path.id}/meridian-loadouts/${slot}/activate`,
            sectJsonRequest('POST'),
          )
        }
      >
        {busy ? '设置中' : '设为当前方案'}
      </InkButton>
    </div>
  ) : (
    <p className="text-crimson text-sm">
      参悟方案{SLOT_NAMES[slot]} · 当前方案
    </p>
  );

  return (
    <InkDetailDrawer
      isOpen
      onClose={requestClose}
      title={path.name}
      footer={footer}
    >
      <InkTabs
        items={[
          { value: 'changes', label: '剑路变化' },
          { value: 'meridians', label: '剑道参悟' },
        ]}
        activeValue={tab}
        onChange={(value) => {
          setTab(value as DrawerTab);
          setConfirmUnlock(false);
          setDiscardConfirm(false);
        }}
      />

      {tab === 'changes' ? (
        <div className="mt-4 space-y-4">
          <section>
            <p className="text-sm leading-7">{path.description}</p>
            {path.presentation?.highlights.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {path.presentation.highlights.map((item) => (
                  <div
                    key={item.name}
                    className="bg-ink/5 p-3 text-sm leading-6"
                  >
                    <strong>{item.name}</strong>
                    <p className="text-ink-secondary mt-1">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold">九门神通变化</h3>
            <div className="space-y-2">
              {preview.abilities.map((ability) => {
                const expanded = expandedAbilityId === ability.id;
                const showCurrent =
                  ability.current &&
                  abilitySignature(ability.current) !==
                    abilitySignature(ability.pathBase);
                return (
                  <div
                    key={ability.id}
                    className="bg-ink/4 p-3 text-sm leading-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong>《{ability.name}》</strong>
                        <p className="mt-1">{ability.changeSummary}</p>
                        {!ability.unlocked ? (
                          <p className="text-ink-secondary text-xs">
                            尚未解锁：{ability.unlockRequirements.join('、')}
                          </p>
                        ) : null}
                      </div>
                      <InkButton
                        variant="secondary"
                        onClick={() =>
                          setExpandedAbilityId(expanded ? null : ability.id)
                        }
                      >
                        {expanded ? '收起' : '比较效果'}
                      </InkButton>
                    </div>
                    {expanded ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <AbilityComparisonBlock
                          title="基础传承"
                          detail={ability.baseline}
                        />
                        <AbilityComparisonBlock
                          title={`${path.name}基础`}
                          detail={ability.pathBase}
                        />
                        {showCurrent && ability.current ? (
                          <AbilityComparisonBlock
                            title={`当前参悟方案${preview.activeMeridianSlot ? SLOT_NAMES[preview.activeMeridianSlot] : ''}`}
                            detail={ability.current}
                            className="md:col-span-2"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <section className="bg-ink/5 p-3 text-sm leading-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                已参悟 {progress.unlockedLayers.length} / {path.layers.length}层
              </p>
              {state && nextLayer ? (
                <InkButton
                  disabled={busy}
                  onClick={() => setConfirmUnlock(true)}
                >
                  参悟{nextLayer.label}
                </InkButton>
              ) : null}
            </div>
            {nextLayer ? (
              <p className="text-ink-secondary mt-1">
                下一层：{nextLayer.label}
                {progress.missingRequirements.length
                  ? ` · 尚需${progress.missingRequirements.join('、')}`
                  : ''}
              </p>
            ) : (
              <p className="text-crimson mt-1">六层皆已参悟</p>
            )}
          </section>

          {state ? (
            <InkTabs
              items={([1, 2, 3] as MeridianSlot[]).map((value) => ({
                value: String(value),
                label: `参悟方案${SLOT_NAMES[value]}${state.activeMeridianSlot === value ? ' · 当前' : ''}${isMeridianDraftDirty(drafts, saved, value) ? ' · 未保存' : ''}`,
              }))}
              activeValue={String(slot)}
              onChange={(value) => setSlot(Number(value) as MeridianSlot)}
            />
          ) : (
            <InkNotice>参悟第一层后，方可配置参悟方案。</InkNotice>
          )}

          <div className="space-y-3">
            {[...path.layers]
              .sort((left, right) => left.order - right.order)
              .map((layer) => {
                const available =
                  Boolean(state) &&
                  isMeridianLayerAvailable(layer.id, progress);
                return (
                  <div key={layer.id}>
                    <p className="mb-2 text-sm font-semibold">
                      {layer.label} · {available ? '已参悟' : '尚未参悟'}
                    </p>
                    <div className="grid items-stretch gap-2 md:grid-cols-3">
                      {path.nodes
                        .filter((node) => node.layerId === layer.id)
                        .map((node) => {
                          const selected = drafts[slot].includes(node.id);
                          return (
                            <button
                              type="button"
                              key={node.id}
                              disabled={!available || busy}
                              onClick={() => {
                                setDiscardConfirm(false);
                                setDrafts((current) => ({
                                  ...current,
                                  [slot]: toggleMeridianNode({
                                    path,
                                    selected: current[slot],
                                    nodeId: node.id,
                                  }),
                                }));
                              }}
                              className={`flex h-full flex-col items-stretch justify-start p-3 text-left text-sm leading-6 ${selected ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'} ${available ? '' : 'cursor-not-allowed opacity-50'}`}
                            >
                              <strong className="block">{node.name}</strong>
                              <p className="mt-1">{node.description}</p>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </InkDetailDrawer>
  );
}

function AbilityComparisonBlock({
  title,
  detail,
  className = '',
}: {
  title: string;
  detail: ResolvedSectAbility;
  className?: string;
}) {
  return (
    <section className={`bg-bgpaper p-3 ${className}`}>
      <h4 className="font-semibold">{title}</h4>
      <SectAbilityDetails detail={detail} collapsible={false} />
    </section>
  );
}

function TrainingCost({
  layer,
  cultivationExp,
  comprehensionInsight,
  spiritStones,
  disabledReason,
}: {
  layer: SectPathLayerDefinition;
  cultivationExp: number;
  comprehensionInsight: number;
  spiritStones: number;
  disabledReason?: string;
}) {
  return (
    <div className="text-sm leading-6">
      <p>
        本次：{layer.cost.cultivationExp}修为 ·{' '}
        {layer.cost.comprehensionInsight}
        道心感悟 · {layer.cost.spiritStones}灵石
      </p>
      <p className="text-ink-secondary">
        持有：{cultivationExp}修为 · {comprehensionInsight}道心感悟 ·{' '}
        {spiritStones}灵石
      </p>
      {disabledReason ? <p className="text-crimson">{disabledReason}</p> : null}
    </div>
  );
}

function UnlockFooter({
  layer,
  disabledReason,
  cultivationExp,
  comprehensionInsight,
  spiritStones,
  busy,
  onCancel,
  onConfirm,
}: {
  layer: SectPathLayerDefinition | null;
  disabledReason?: string;
  cultivationExp: number;
  comprehensionInsight: number;
  spiritStones: number;
  busy: boolean;
  onCancel?: () => void;
  onConfirm: () => void;
}) {
  if (!layer) return <p className="text-crimson text-sm">全部层级均已参悟</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TrainingCost
        layer={layer}
        cultivationExp={cultivationExp}
        comprehensionInsight={comprehensionInsight}
        spiritStones={spiritStones}
        disabledReason={disabledReason}
      />
      <div className="flex gap-2">
        {onCancel ? <InkButton onClick={onCancel}>返回</InkButton> : null}
        <InkButton
          variant="primary"
          disabled={busy || Boolean(disabledReason)}
          onClick={onConfirm}
        >
          {busy ? '参悟中' : `参悟${layer.label}`}
        </InkButton>
      </div>
    </div>
  );
}

function PathOverviewFooter({
  path,
  state,
  active,
  realmLocked,
  nextLayer,
  disabledReason,
  cultivationExp,
  comprehensionInsight,
  spiritStones,
  busy,
  onUnlock,
  onActivate,
}: {
  path: SectPathDefinition;
  state?: CultivatorSectPathState;
  active: boolean;
  realmLocked: boolean;
  nextLayer: SectPathLayerDefinition | null;
  disabledReason?: string;
  cultivationExp: number;
  comprehensionInsight: number;
  spiritStones: number;
  busy: boolean;
  onUnlock: () => void;
  onActivate: () => void;
}) {
  if (realmLocked) {
    return (
      <p className="text-crimson text-sm">
        {path.minRealm}
        {path.minRealmStage}后可参悟
      </p>
    );
  }
  if (!state) {
    return (
      <UnlockFooter
        layer={nextLayer}
        disabledReason={disabledReason}
        cultivationExp={cultivationExp}
        comprehensionInsight={comprehensionInsight}
        spiritStones={spiritStones}
        busy={busy}
        onConfirm={onUnlock}
      />
    );
  }
  if (active) return <p className="text-crimson text-sm">当前流派</p>;
  return (
    <div className="flex justify-end">
      <InkButton variant="primary" disabled={busy} onClick={onActivate}>
        {busy ? '切换中' : '设为当前流派'}
      </InkButton>
    </div>
  );
}
