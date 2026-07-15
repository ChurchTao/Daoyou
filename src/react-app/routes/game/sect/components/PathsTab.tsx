import {
  InkButton,
  InkCard,
  InkDetailDrawer,
  InkNotice,
} from '@app/components/ui';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  getPathProgress,
  isMeridianLayerAvailable,
  type CultivatorSectPathState,
  type CultivatorSectState,
  type SectPathDefinition,
  type SectPathLayerDefinition,
} from '@shared/engine/sect';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { getRealmStageRank } from '@shared/config/realmProgression';
import { useState } from 'react';
import { sectJsonRequest, type SectAction } from './types';

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
  if (!data.sect || !data.definition)
    return <InkNotice>拜师后方可研习宗门流派。</InkNotice>;
  return (
    <div className="space-y-4">
      {data.definition.paths.map((path) => (
        <PathPanel
          key={path.id}
          path={path}
          state={data.sect!.paths.find((entry) => entry.pathId === path.id)}
          sect={data.sect!}
          active={data.sect!.activePathId === path.id}
          busy={busy}
          action={action}
          realm={realm}
          stage={stage}
        />
      ))}
    </div>
  );
}

function getUnlockDisabledReason(args: {
  layer: SectPathLayerDefinition | null;
  nextLayerAvailable: boolean;
  missingRequirements: string[];
  cultivationExp: number;
  comprehensionInsight: number;
  spiritStones: number;
}) {
  if (!args.layer) return '已解锁全部层级';
  if (!args.nextLayerAvailable)
    return args.missingRequirements.length
      ? `尚需：${args.missingRequirements.join('、')}`
      : '尚未满足解锁条件';
  if (args.cultivationExp < args.layer.cost.cultivationExp) return '修为不足';
  if (args.comprehensionInsight < args.layer.cost.comprehensionInsight)
    return '道心感悟不足';
  if (args.spiritStones < args.layer.cost.spiritStones) return '灵石不足';
  return undefined;
}

function PathPanel({
  path,
  state,
  sect,
  active,
  busy,
  action,
  realm,
  stage,
}: {
  path: SectPathDefinition;
  state?: CultivatorSectPathState;
  sect: CultivatorSectState;
  active: boolean;
  busy: boolean;
  action: (url: string, init: RequestInit) => Promise<void>;
  realm: RealmType;
  stage: RealmStage;
}) {
  const cultivator = useActiveCultivatorProfile();
  const [slot, setSlot] = useState<1 | 2 | 3>(state?.activeMeridianSlot ?? 1);
  const [selected, setSelected] = useState<string[]>(
    state?.meridianLoadouts.find(
      (entry) => entry.slot === (state.activeMeridianSlot ?? 1),
    )?.nodeIds ?? [],
  );
  const [showUnlock, setShowUnlock] = useState(false);
  const realmLocked =
    getRealmStageRank(realm, stage) <
    getRealmStageRank(path.minRealm, path.minRealmStage);
  if (realmLocked) {
    return (
      <InkCard>
        <strong>{path.name}</strong>
        <p className="text-ink-secondary mt-2 text-sm leading-6">
          {path.description}
        </p>
        <p className="text-crimson mt-3 text-sm">
          {path.minRealm}{path.minRealmStage}后可参悟
        </p>
      </InkCard>
    );
  }
  const progress = getPathProgress({
    path,
    unlockedLayerIds: state?.unlockedLayerIds ?? [],
    realm,
    stage,
    methods: sect.methods,
  });
  const cultivationExp = cultivator?.cultivation_progress?.cultivation_exp ?? 0;
  const comprehensionInsight =
    cultivator?.cultivation_progress?.comprehension_insight ?? 0;
  const spiritStones = cultivator?.spirit_stones ?? 0;
  const nextLayer = progress.nextLayer;
  const disabledReason = getUnlockDisabledReason({
    layer: nextLayer,
    nextLayerAvailable: progress.nextLayerAvailable,
    missingRequirements: progress.missingRequirements,
    cultivationExp,
    comprehensionInsight,
    spiritStones,
  });
  const toggle = (nodeId: string, layerId: string) =>
    setSelected((current) => [
      ...current.filter(
        (id) => path.nodes.find((node) => node.id === id)?.layerId !== layerId,
      ),
      nodeId,
    ]);
  const layers = [...path.layers].sort(
    (left, right) => left.order - right.order,
  );

  return (
    <>
      <InkCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <strong>{path.name}</strong>
            <p className="text-ink-secondary mt-1 text-sm">
              {path.description}
            </p>
          </div>
          <span className="text-crimson text-sm">
            已解锁 {progress.unlockedLayers.length}/{path.layers.length} 层
            {active ? ' · 当前' : ''}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {nextLayer ? (
            <InkButton disabled={busy} onClick={() => setShowUnlock(true)}>
              解锁{nextLayer.label}
            </InkButton>
          ) : null}
          {state && !active ? (
            <InkButton
              variant="primary"
              disabled={busy}
              onClick={() =>
                void action(
                  `/api/sects/current/paths/${path.id}/activate`,
                  sectJsonRequest('POST'),
                )
              }
            >
              设为当前流派
            </InkButton>
          ) : null}
        </div>
        {state ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {([1, 2, 3] as const).map((value) => (
                <InkButton
                  key={value}
                  variant={slot === value ? 'primary' : 'secondary'}
                  onClick={() => {
                    setSlot(value);
                    setSelected(
                      state.meridianLoadouts.find(
                        (entry) => entry.slot === value,
                      )?.nodeIds ?? [],
                    );
                  }}
                >
                  方案{value}
                  {state.activeMeridianSlot === value ? '·当前' : ''}
                </InkButton>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {layers.map((layer) => {
                const available = isMeridianLayerAvailable(layer.id, progress);
                return (
                  <div key={layer.id}>
                    <p className="mb-2 text-sm font-semibold">
                      {layer.label}
                      {available ? ' · 已解锁' : ' · 尚未解锁'}
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {path.nodes
                        .filter((node) => node.layerId === layer.id)
                        .map((node) => (
                          <button
                            type="button"
                            key={node.id}
                            disabled={!available}
                            onClick={() => toggle(node.id, node.layerId)}
                            className={`p-3 text-left text-sm leading-6 ${selected.includes(node.id) ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'} ${available ? '' : 'cursor-not-allowed opacity-50'}`}
                          >
                            <strong>{node.name}</strong>
                            <br />
                            {node.description}
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <InkButton
                disabled={busy}
                onClick={() =>
                  void action(
                    `/api/sects/current/paths/${path.id}/meridian-loadouts/${slot}`,
                    sectJsonRequest('PUT', { nodeIds: selected }),
                  )
                }
              >
                保存方案
              </InkButton>
              <InkButton
                disabled={busy}
                onClick={() =>
                  void action(
                    `/api/sects/current/paths/${path.id}/meridian-loadouts/${slot}/activate`,
                    sectJsonRequest('POST'),
                  )
                }
              >
                激活方案
              </InkButton>
            </div>
          </>
        ) : null}
      </InkCard>

      <InkDetailDrawer
        isOpen={showUnlock && Boolean(nextLayer)}
        onClose={() => setShowUnlock(false)}
        title={nextLayer ? `${path.name} · ${nextLayer.label}` : path.name}
        footer={
          nextLayer ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm leading-6">
                <p>
                  本次：{nextLayer.cost.cultivationExp}修为 ·{' '}
                  {nextLayer.cost.comprehensionInsight}道心感悟 ·{' '}
                  {nextLayer.cost.spiritStones}灵石
                </p>
                <p className="text-ink-secondary">
                  持有：{cultivationExp}修为 · {comprehensionInsight}道心感悟 ·{' '}
                  {spiritStones}灵石
                </p>
                {disabledReason ? (
                  <p className="text-crimson">{disabledReason}</p>
                ) : null}
              </div>
              <InkButton
                variant="primary"
                disabled={busy || Boolean(disabledReason)}
                onClick={() => {
                  setShowUnlock(false);
                  void action(
                    `/api/sects/current/paths/${path.id}/layers/${nextLayer.id}/unlock`,
                    sectJsonRequest('POST'),
                  );
                }}
              >
                {busy ? '参悟中' : `解锁${nextLayer.label}`}
              </InkButton>
            </div>
          ) : undefined
        }
      >
        {nextLayer ? (
          <div className="space-y-3 text-sm leading-7">
            <p>{path.description}</p>
            <p>
              境界要求：
              {nextLayer.minRealm && nextLayer.minRealmStage
                ? `${nextLayer.minRealm}${nextLayer.minRealmStage}`
                : '无'}
            </p>
            <p>解锁后可从该层节点中选择其一纳入经脉方案。</p>
          </div>
        ) : null}
      </InkDetailDrawer>
    </>
  );
}
