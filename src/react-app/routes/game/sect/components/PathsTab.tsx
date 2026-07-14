import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  SECT_MERIDIAN_STAGES,
  getPathProgress,
  getSectMethodTrainingCost,
  isMeridianLayerAvailable,
  type CultivatorSectPathState,
  type CultivatorSectState,
  type SectPathDefinition,
} from '@shared/engine/sect';
import type { RealmStage, RealmType } from '@shared/types/constants';
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
          levelCap={data.methodLevelCap}
        />
      ))}
    </div>
  );
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
  levelCap,
}: {
  path: SectPathDefinition;
  state?: CultivatorSectPathState;
  sect: CultivatorSectState;
  active: boolean;
  busy: boolean;
  action: (url: string, init: RequestInit) => Promise<void>;
  realm: RealmType;
  stage: RealmStage;
  levelCap: number;
}) {
  const [slot, setSlot] = useState<1 | 2 | 3>(state?.activeMeridianSlot ?? 1);
  const [selected, setSelected] = useState<string[]>(
    state?.meridianLoadouts.find(
      (entry) => entry.slot === (state.activeMeridianSlot ?? 1),
    )?.nodeIds ?? [],
  );
  const progress = getPathProgress({
    path,
    pathLevel: state?.level ?? 0,
    realm,
    stage,
  });
  const level = state?.level ?? 0;
  const cost = getSectMethodTrainingCost(level, level + 1);
  const toggle = (nodeId: string, layer: string) =>
    setSelected((current) => [
      ...current.filter(
        (id) =>
          String(path.nodes.find((node) => node.id === id)?.layer) !== layer,
      ),
      nodeId,
    ]);
  return (
    <InkCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong>{path.name}</strong>
          <p className="text-ink-secondary mt-1 text-sm">{path.description}</p>
        </div>
        <span className="text-crimson text-sm">
          {state ? `${level}级${active ? ' · 当前' : ''}` : '尚未习得'}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!state ? (
          <InkButton
            disabled={busy}
            onClick={() =>
              void action(
                `/api/sects/current/paths/${path.id}/enroll`,
                sectJsonRequest('POST'),
              )
            }
          >
            习得流派
          </InkButton>
        ) : (
          <>
            <InkButton
              disabled={
                busy ||
                level >= levelCap ||
                sect.contribution < cost.contribution
              }
              onClick={() =>
                void action(
                  `/api/sects/current/paths/${path.id}/train`,
                  sectJsonRequest('POST', { targetLevel: level + 1 }),
                )
              }
            >
              研习一级
            </InkButton>
            {!active ? (
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
          </>
        )}
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
                    state.meridianLoadouts.find((entry) => entry.slot === value)
                      ?.nodeIds ?? [],
                  );
                }}
              >
                方案{value}
                {state.activeMeridianSlot === value ? '·当前' : ''}
              </InkButton>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {SECT_MERIDIAN_STAGES.map((stageDefinition) => {
              const available = isMeridianLayerAvailable(
                stageDefinition.layer,
                progress,
              );
              return (
                <div key={String(stageDefinition.layer)}>
                  <p className="mb-2 text-sm font-semibold">
                    {stageDefinition.label} · {stageDefinition.pathLevel}级
                  </p>
                  <div className="grid gap-2 md:grid-cols-3">
                    {path.nodes
                      .filter((node) => node.layer === stageDefinition.layer)
                      .map((node) => (
                        <button
                          type="button"
                          key={node.id}
                          disabled={!available}
                          onClick={() => toggle(node.id, String(node.layer))}
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
  );
}
