import { useInkUI } from '@app/components/providers/InkUIProvider';
import { SectAbilityDetails } from '@app/components/feature/sect/SectAbilityDetails';
import { GameSceneFrame, GameSceneLoading, GameSceneNote } from '@app/components/game-shell';
import { InkButton, InkCard, InkDetailDrawer, InkNotice, InkTabs } from '@app/components/ui';
import { useActiveCultivatorProfile, useCultivatorCurrency } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCatalog, fetchSectCurrent } from '@app/lib/sect/sectClient';
import type { SectCatalogData, SectCurrentData } from '@shared/contracts/sect';
import {
  SECT_MERIDIAN_STAGES,
  describeMethodBenefit,
  getPathProgress,
  getSectMethodTrainingCost,
  isMeridianLayerAvailable,
  resolveMethodMilestones,
  resolveSectAbility,
  type CultivatorSectPathState,
  type CultivatorSectState,
  type SectAbilityRole,
  type SectHeartMethodDefinition,
  type SectPathDefinition,
} from '@shared/engine/sect';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

const tabs = [
  { value: 'gate', label: '山门' },
  { value: 'methods', label: '心法' },
  { value: 'paths', label: '流派' },
  { value: 'commissions', label: '委托' },
];

const roleLabels: Record<SectAbilityRole, string> = {
  generator: '积蓄',
  combo: '连段',
  defensive: '防守',
  finisher: '收束',
  utility: '辅助',
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export default function SectPage() {
  const [catalog, setCatalog] = useState<SectCatalogData>();
  const [data, setData] = useState<SectCurrentData>();
  const [tab, setTab] = useState('gate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const cultivator = useActiveCultivatorProfile();

  const reload = useCallback(async () => {
    const [nextCatalog, nextData] = await Promise.all([fetchSectCatalog(), fetchSectCurrent()]);
    setCatalog(nextCatalog);
    setData(nextData);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [nextCatalog, nextData] = await Promise.all([fetchSectCatalog(), fetchSectCurrent()]);
        if (!cancelled) { setCatalog(nextCatalog); setData(nextData); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '宗门卷宗读取失败');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const action = useCallback(async (url: string, init: RequestInit) => {
    setBusy(true);
    try {
      await mutate<{ sect: CultivatorSectState }>(fetch(url, init));
      await reload();
      pushToast({ message: '宗门事务已办妥', tone: 'success' });
    } catch (reason) {
      pushToast({ message: reason instanceof Error ? reason.message : '宗门事务失败', tone: 'danger' });
    } finally { setBusy(false); }
  }, [mutate, pushToast, reload]);

  if (!catalog || !data) return <GameSceneLoading message="山门云阶渐次显现……" />;

  const definition = data.definition;
  const sect = data.sect;
  return (
    <GameSceneFrame
      title={definition ? `【${definition.name}】` : '【诸宗山门】'}
      description={definition?.description ?? '诸宗传承各有所长，可先试其法，再择一门而入。'}
      headerMeta={error ? <GameSceneNote tone="danger">{error}</GameSceneNote> : undefined}
      aside={<div className="space-y-2 text-sm leading-7"><p>种族：{catalog.playerRace === 'human' ? '人族' : catalog.playerRace}</p><p>身份：{sect ? `${definition?.name ?? '宗门'}弟子` : '山外散修'}</p>{sect ? <p>贡献：{sect.contribution}</p> : null}</div>}
    >
      <InkTabs items={tabs} activeValue={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'gate' ? <GateTab catalog={catalog} busy={busy} action={action} /> : null}
        {tab === 'methods' ? <MethodsTab data={data} busy={busy} action={action} realm={cultivator?.realm ?? '炼气'} stage={cultivator?.realm_stage ?? '初期'} /> : null}
        {tab === 'paths' ? <PathsTab data={data} busy={busy} action={action} realm={cultivator?.realm ?? '炼气'} stage={cultivator?.realm_stage ?? '初期'} /> : null}
        {tab === 'commissions' ? <CommissionsTab data={data} busy={busy} action={action} /> : null}
      </div>
    </GameSceneFrame>
  );
}

function GateTab({ catalog, busy, action }: { catalog: SectCatalogData; busy: boolean; action: (url: string, init: RequestInit) => Promise<void> }) {
  const navigate = useNavigate();
  if (catalog.activeSectId) {
    const active = catalog.sects.find((entry) => entry.definition.id === catalog.activeSectId);
    return <InkNotice>名录已定：{active?.definition.name ?? catalog.activeSectId}弟子。</InkNotice>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {catalog.sects.map((entry) => (
        <InkCard key={entry.definition.id}>
          <h3 className="font-semibold">{entry.definition.name}</h3>
          <p className="text-ink-secondary mt-1 text-sm leading-7">{entry.definition.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <InkButton disabled={busy} onClick={() => navigate(`/game/sect/trial/${entry.definition.id}`)}>
              {entry.experiencedAt ? `再次${entry.definition.trial.name}` : entry.definition.trial.name}
            </InkButton>
            {entry.experiencedAt ? <InkButton variant="primary" disabled={busy} onClick={() => void action(`/api/sects/${entry.definition.id}/join`, json('POST'))}>拜师入宗</InkButton> : null}
          </div>
        </InkCard>
      ))}
    </div>
  );
}

function getMethodDisabledReason(args: {
  method: SectHeartMethodDefinition;
  currentLevel: number;
  data: SectCurrentData;
  spiritStones: number;
  cost: { contribution: number; spiritStones: number };
}) {
  const targetLevel = args.currentLevel + 1;
  if (targetLevel > args.data.methodLevelCap) return '已达当前境界上限';
  const primary = args.data.definition?.methods.find((method) => method.isPrimary);
  if (primary && args.method.id !== primary.id && targetLevel > (args.data.sect?.methods[primary.id] ?? 0)) {
    return `分卷不可超过${primary.name}`;
  }
  if ((args.data.sect?.contribution ?? 0) < args.cost.contribution) return '宗门贡献不足';
  if (args.spiritStones < args.cost.spiritStones) return '灵石不足';
  return undefined;
}

function MethodsTab({ data, busy, action, realm, stage }: {
  data: SectCurrentData;
  busy: boolean;
  action: (url: string, init: RequestInit) => Promise<void>;
  realm: RealmType;
  stage: RealmStage;
}) {
  const currency = useCultivatorCurrency();
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  if (!data.sect || !data.definition) return <InkNotice>拜师后方可研习宗门心法。</InkNotice>;
  const sect = data.sect;
  const definition = data.definition;
  const spiritStones = currency?.spiritStones ?? 0;
  const selectedMethod = selectedMethodId
    ? definition.methods.find((method) => method.id === selectedMethodId)
    : undefined;
  const selectedLevel = selectedMethod ? sect.methods[selectedMethod.id] ?? 0 : 0;
  const selectedTarget = selectedLevel + 1;
  const selectedCost = getSectMethodTrainingCost(selectedLevel, selectedTarget);
  const selectedDisabledReason = selectedMethod ? getMethodDisabledReason({
    method: selectedMethod,
    currentLevel: selectedLevel,
    data,
    spiritStones,
    cost: selectedCost,
  }) : undefined;
  const selectedMilestones = selectedMethod ? resolveMethodMilestones({
    definition,
    methodId: selectedMethod.id,
    sect,
    realm,
    stage,
  }) : [];

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {definition.methods.map((method) => {
          const level = sect.methods[method.id] ?? 0;
          return (
            <InkCard key={method.id} padding="none">
              <button
                type="button"
                className="hover:bg-ink/4 w-full p-3 text-left transition-colors"
                onClick={() => setSelectedMethodId(method.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <strong>{method.name}</strong>
                  <span className="text-crimson shrink-0 text-sm">{level} / {data.methodLevelCap}级</span>
                </div>
                <p className="text-ink-secondary mt-2 text-sm leading-6">{method.description}</p>
              </button>
            </InkCard>
          );
        })}
      </div>

      <InkDetailDrawer
        isOpen={Boolean(selectedMethod)}
        onClose={() => setSelectedMethodId(null)}
        title={selectedMethod?.name ?? '心法详情'}
        footer={selectedMethod ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm leading-6">
              <p>本次：{selectedCost.contribution}贡献 · {selectedCost.spiritStones}灵石</p>
              <p className="text-ink-secondary">持有：{sect.contribution}贡献 · {spiritStones}灵石</p>
              {selectedDisabledReason ? <p className="text-crimson">{selectedDisabledReason}</p> : null}
            </div>
            <InkButton
              variant="primary"
              disabled={busy || Boolean(selectedDisabledReason)}
              onClick={() => void action(
                `/api/sects/current/methods/${selectedMethod.id}/train`,
                json('POST', { targetLevel: selectedTarget }),
              )}
            >
              {busy ? '研习中' : '研习一级'}
            </InkButton>
          </div>
        ) : undefined}
      >
        {selectedMethod ? (
          <div className="space-y-4">
            <section>
              <p className="text-sm leading-7">{selectedMethod.description}</p>
              <div className="bg-ink/5 mt-3 p-3 text-sm leading-6">
                <p>当前等级：{selectedLevel} / {data.methodLevelCap}级</p>
                <p>每级收益：{selectedMethod.perLevelDescription ?? '提升宗门修习资格。'}</p>
                <p className="text-crimson">当前累计：{describeMethodBenefit(selectedMethod, selectedLevel)}</p>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-base font-semibold">修炼节点与神通</h3>
              <div className="space-y-3">
                {selectedMilestones.map((milestone) => {
                  const abilityDefinition = milestone.abilityId
                    ? definition.abilities.find((ability) => ability.id === milestone.abilityId)
                    : undefined;
                  const abilityDetail = milestone.abilityId
                    ? resolveSectAbility({ abilityId: milestone.abilityId, sect, realm })
                    : undefined;
                  const stateLabel = milestone.status === 'unlocked'
                    ? '已解锁'
                    : milestone.status === 'next' ? '下一节点' : '尚未达到';
                  return (
                    <div key={milestone.id} className="border-ink/15 border-b border-dashed pb-3 text-sm leading-6 last:border-b-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{milestone.level}级 · {abilityDetail?.name ?? milestone.name}</strong>
                        <span className={milestone.status === 'unlocked' ? 'text-crimson' : 'text-ink-secondary'}>{stateLabel}</span>
                      </div>
                      <p>{milestone.description}</p>
                      {abilityDefinition ? (
                        <p className="text-ink-secondary">定位：{roleLabels[abilityDefinition.role]} · {abilityDefinition.description}</p>
                      ) : null}
                      {milestone.missingRequirements.length ? (
                        <p className="text-ink-secondary">尚需：{milestone.missingRequirements.join('、')}</p>
                      ) : null}
                      {abilityDetail ? <SectAbilityDetails detail={abilityDetail} collapsible={false} /> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
      </InkDetailDrawer>
    </>
  );
}

function PathsTab({ data, busy, action, realm, stage }: { data: SectCurrentData; busy: boolean; action: (url: string, init: RequestInit) => Promise<void>; realm: RealmType; stage: RealmStage }) {
  if (!data.sect || !data.definition) return <InkNotice>拜师后方可研习宗门流派。</InkNotice>;
  return <div className="space-y-4">{data.definition.paths.map((path) => <PathPanel key={path.id} path={path} state={data.sect!.paths.find((entry) => entry.pathId === path.id)} sect={data.sect!} active={data.sect!.activePathId === path.id} busy={busy} action={action} realm={realm} stage={stage} levelCap={data.methodLevelCap} />)}</div>;
}

function PathPanel({ path, state, sect, active, busy, action, realm, stage, levelCap }: {
  path: SectPathDefinition; state?: CultivatorSectPathState; sect: CultivatorSectState; active: boolean; busy: boolean;
  action: (url: string, init: RequestInit) => Promise<void>;
  realm: RealmType; stage: RealmStage; levelCap: number;
}) {
  const [slot, setSlot] = useState<1 | 2 | 3>(state?.activeMeridianSlot ?? 1);
  const [selected, setSelected] = useState<string[]>(state?.meridianLoadouts.find((entry) => entry.slot === (state.activeMeridianSlot ?? 1))?.nodeIds ?? []);
  const progress = getPathProgress({ path, pathLevel: state?.level ?? 0, realm, stage });
  const level = state?.level ?? 0;
  const cost = getSectMethodTrainingCost(level, level + 1);
  const toggle = (nodeId: string, layer: string) => setSelected((current) => [...current.filter((id) => String(path.nodes.find((node) => node.id === id)?.layer) !== layer), nodeId]);
  return (
    <InkCard>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{path.name}</strong><p className="text-ink-secondary mt-1 text-sm">{path.description}</p></div><span className="text-crimson text-sm">{state ? `${level}级${active ? ' · 当前' : ''}` : '尚未习得'}</span></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!state ? <InkButton disabled={busy} onClick={() => void action(`/api/sects/current/paths/${path.id}/enroll`, json('POST'))}>习得流派</InkButton> : <>
          <InkButton disabled={busy || level >= levelCap || sect.contribution < cost.contribution} onClick={() => void action(`/api/sects/current/paths/${path.id}/train`, json('POST', { targetLevel: level + 1 }))}>研习一级</InkButton>
          {!active ? <InkButton variant="primary" disabled={busy} onClick={() => void action(`/api/sects/current/paths/${path.id}/activate`, json('POST'))}>设为当前流派</InkButton> : null}
        </>}
      </div>
      {state ? <>
        <div className="mt-4 flex flex-wrap gap-2">{([1, 2, 3] as const).map((value) => <InkButton key={value} variant={slot === value ? 'primary' : 'secondary'} onClick={() => { setSlot(value); setSelected(state.meridianLoadouts.find((entry) => entry.slot === value)?.nodeIds ?? []); }}>方案{value}{state.activeMeridianSlot === value ? '·当前' : ''}</InkButton>)}</div>
        <div className="mt-4 space-y-3">{SECT_MERIDIAN_STAGES.map((stageDefinition) => {
          const available = isMeridianLayerAvailable(stageDefinition.layer, progress);
          return <div key={String(stageDefinition.layer)}><p className="mb-2 text-sm font-semibold">{stageDefinition.label} · {stageDefinition.pathLevel}级</p><div className="grid gap-2 md:grid-cols-3">{path.nodes.filter((node) => node.layer === stageDefinition.layer).map((node) => <button type="button" key={node.id} disabled={!available} onClick={() => toggle(node.id, String(node.layer))} className={`p-3 text-left text-sm leading-6 ${selected.includes(node.id) ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'} ${available ? '' : 'cursor-not-allowed opacity-50'}`}><strong>{node.name}</strong><br />{node.description}</button>)}</div></div>;
        })}</div>
        <div className="mt-4 flex gap-2"><InkButton disabled={busy} onClick={() => void action(`/api/sects/current/paths/${path.id}/meridian-loadouts/${slot}`, json('PUT', { nodeIds: selected }))}>保存方案</InkButton><InkButton disabled={busy} onClick={() => void action(`/api/sects/current/paths/${path.id}/meridian-loadouts/${slot}/activate`, json('POST'))}>激活方案</InkButton></div>
      </> : null}
    </InkCard>
  );
}

function CommissionsTab({ data, busy, action }: { data: SectCurrentData; busy: boolean; action: (url: string, init: RequestInit) => Promise<void> }) {
  if (!data.sect) return <InkNotice>拜师后方可承接宗门委托。</InkNotice>;
  return <div className="space-y-3"><InkNotice>{data.commission.claimedAt ? '今日委托奖励已领取。' : data.commission.completedAt ? '今日委托已完成，可领取奖励。' : '今日尚未完成宗门委托。'}</InkNotice><div className="flex gap-2">{!data.commission.completedAt ? <InkButton disabled={busy} onClick={() => void action('/api/sects/current/commissions/spar', json('POST'))}>完成切磋委托</InkButton> : null}{data.commission.completedAt && !data.commission.claimedAt ? <InkButton variant="primary" disabled={busy} onClick={() => void action('/api/sects/current/commissions/claim', json('POST'))}>领取贡献</InkButton> : null}</div></div>;
}
