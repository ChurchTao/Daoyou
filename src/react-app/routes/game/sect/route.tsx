import { useInkUI } from '@app/components/providers/InkUIProvider';
import { SectAbilityDetails } from '@app/components/feature/sect/SectAbilityDetails';
import { GameSceneFrame, GameSceneLoading, GameSceneNote } from '@app/components/game-shell';
import { InkButton, InkCard, InkDetailDrawer, InkNotice, InkTabs } from '@app/components/ui';
import { useActiveCultivatorProfile, useCultivatorCurrency } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCurrent } from '@app/lib/sect/sectClient';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  LINGXIAO_ABILITY_BY_ID,
  LINGXIAO_METHOD_BY_ID,
  LINGXIAO_SECT,
  SWIFT_MERIDIAN_STAGES,
  getSectMethodTrainingCost,
  getSwiftMeridianProgress,
  isSwiftMeridianLayerAvailable,
  projectLingxiaoAbilityDetail,
  resolveMethodMilestones,
  type LingxiaoMethodId,
  type SectHeartMethodDefinition,
  type SectAbilityRole,
} from '@shared/engine/sect';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

const tabs = [
  { value: 'gate', label: '山门' },
  { value: 'methods', label: '心法' },
  { value: 'meridians', label: '剑脉' },
  { value: 'commissions', label: '委托' },
];

const roleLabels: Record<SectAbilityRole, string> = {
  generator: '产势', combo: '连段', defensive: '防守', finisher: '收束',
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

type SectAction = (
  url: string,
  init?: RequestInit,
  options?: { refreshCurrency?: boolean; successMessage?: string },
) => Promise<boolean>;

type TabProps = {
  data: SectCurrentData;
  busy: boolean;
  action: SectAction;
  realm: RealmType;
  stage: RealmStage;
};

function SectCard({ title, children }: { title: string; children: ReactNode }) {
  return <InkCard><h3 className="mb-2 text-lg font-semibold">{title}</h3>{children}</InkCard>;
}

export default function SectPage() {
  const [data, setData] = useState<SectCurrentData | null>(null);
  const [tab, setTab] = useState('gate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cultivator = useActiveCultivatorProfile();
  const { mutate, refresh } = usePlayerStateActions();
  const { pushToast } = useInkUI();

  const reload = useCallback(async () => {
    try {
      setData(await fetchSectCurrent());
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '宗门卷宗读取失败');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSectCurrent().then((next) => {
      if (!cancelled) setData(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '宗门卷宗读取失败');
    });
    return () => { cancelled = true; };
  }, []);

  const action = useCallback<SectAction>(async (url, init, options) => {
    setBusy(true);
    try {
      await mutate(fetch(url, init));
      await Promise.all([
        reload(),
        options?.refreshCurrency ? refresh(['currency']) : Promise.resolve(),
      ]);
      pushToast({ message: options?.successMessage ?? '宗门卷宗已更新', tone: 'success' });
      return true;
    } catch (reason) {
      pushToast({ message: reason instanceof Error ? reason.message : '宗门事务失败', tone: 'danger' });
      return false;
    } finally {
      setBusy(false);
    }
  }, [mutate, pushToast, refresh, reload]);

  if (!data && !error) return <GameSceneLoading message="山门云阶渐次显现……" />;

  const realm = cultivator?.realm ?? '炼气';
  const stage = cultivator?.realm_stage ?? '初期';

  return (
    <GameSceneFrame
      title="【凌霄剑宗】"
      description="拜山问剑，研习心法，循剑脉而定快剑之路。"
      headerMeta={error ? <GameSceneNote tone="danger">{error}</GameSceneNote> : undefined}
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>种族：人族</p>
          <p>身份：{data?.sect?.status === 'active' ? '凌霄弟子' : data?.sect?.experiencedAt ? '记名访客' : '山外散修'}</p>
          <p>贡献：{data?.sect?.contribution ?? 0}</p>
        </div>
      }
    >
      <InkTabs items={tabs} activeValue={tab} onChange={setTab} />
      <div className="mt-4">
        {data && tab === 'gate' ? <GateTab data={data} busy={busy} action={action} realm={realm} stage={stage} /> : null}
        {data && tab === 'methods' ? <MethodsTab data={data} busy={busy} action={action} realm={realm} stage={stage} /> : null}
        {data && tab === 'meridians' ? <MeridiansTab data={data} busy={busy} action={action} realm={realm} stage={stage} /> : null}
        {data && tab === 'commissions' ? <CommissionsTab data={data} busy={busy} action={action} realm={realm} stage={stage} /> : null}
      </div>
    </GameSceneFrame>
  );
}

function GateTab({ data, busy, action }: TabProps) {
  const navigate = useNavigate();
  if (data.sect?.status === 'active') {
    return <InkNotice>名录已定：人族·凌霄剑宗弟子。首版宗门身份不可退出或改投。</InkNotice>;
  }
  return (
    <div className="space-y-4">
      {data.raceNarrative ? <InkNotice>人族判词：{data.raceNarrative}</InkNotice> : null}
      <SectCard title="山门试剑">
        <p className="text-sm leading-7">借宗门木剑体验基础剑术。胜负不影响拜师资格。</p>
        <InkButton disabled={busy} onClick={() => navigate('/game/sect/trial')}>
          {data.sect?.experiencedAt ? '再次演剑' : '开始体验'}
        </InkButton>
      </SectCard>
      {data.sect?.experiencedAt ? (
        <SectCard title="拜入凌霄">
          <p className="text-sm leading-7">入宗赠30贡献与两卷5级心法；造物神通仍可收藏、推演和交易。</p>
          <InkButton variant="primary" disabled={busy} onClick={() => action('/api/sects/lingxiao/join', json('POST'))}>
            拜师入宗
          </InkButton>
        </SectCard>
      ) : null}
    </div>
  );
}

function getMethodDisabledReason(args: {
  methodId: LingxiaoMethodId;
  currentLevel: number;
  cap: number;
  data: SectCurrentData;
  spiritStones: number;
  cost: { contribution: number; spiritStones: number };
}) {
  const target = args.currentLevel + 1;
  if (target > args.cap) return '已达当前境界上限';
  if (args.methodId !== 'lingxiao-canon' && target > (args.data.sect?.methods['lingxiao-canon'] ?? 0)) {
    return '分卷不可超过《凌霄剑典》';
  }
  if (args.methodId === 'swift-sword-canon' && args.data.sect?.pathId !== 'swift-sword') return '选择快剑道后方可研习';
  if ((args.data.sect?.contribution ?? 0) < args.cost.contribution) return '宗门贡献不足';
  if (args.spiritStones < args.cost.spiritStones) return '灵石不足';
  return undefined;
}

function MethodsTab({ data, busy, action, realm, stage }: TabProps) {
  const currency = useCultivatorCurrency();
  const [selectedMethodId, setSelectedMethodId] = useState<LingxiaoMethodId | null>(null);
  if (data.sect?.status !== 'active') return <InkNotice>拜师后方可研习宗门心法。</InkNotice>;
  const spiritStones = currency?.spiritStones ?? 0;
  const selectedMethod = selectedMethodId ? LINGXIAO_METHOD_BY_ID.get(selectedMethodId) : undefined;
  const selectedLevel = selectedMethod ? data.sect.methods[selectedMethod.id] ?? 0 : 0;
  const selectedTarget = selectedLevel + 1;
  const selectedCost = getSectMethodTrainingCost(selectedLevel, selectedTarget);
  const selectedDisabledReason = selectedMethod ? getMethodDisabledReason({
    methodId: selectedMethod.id,
    currentLevel: selectedLevel,
    cap: data.methodLevelCap,
    data,
    spiritStones,
    cost: selectedCost,
  }) : undefined;
  const selectedMilestones = selectedMethod ? resolveMethodMilestones({
    methodId: selectedMethod.id,
    sect: data.sect,
    realm,
    stage,
  }) : [];

  const cumulativeBenefit = (method: SectHeartMethodDefinition, level: number) => {
    const formatPercent = (value: number) => (value * 100).toFixed(2).replace(/\.00$/, '');
    if (method.swiftTemplateMultiplierPerLevel) {
      return `快剑招式倍率提高${formatPercent(method.swiftTemplateMultiplierPerLevel * level)}%`;
    }
    if (!method.modifierPerLevel) return '统摄分卷等级、择道与终式资格';
    const total = method.modifierPerLevel.value * level;
    const label = method.modifierPerLevel.attrType === 'atk'
      ? '物理攻击'
      : method.modifierPerLevel.attrType === 'speed'
        ? '身法'
        : method.modifierPerLevel.attrType === 'accuracy'
          ? '命中'
          : '法力上限';
    return method.modifierPerLevel.type === 'fixed'
      ? `${label}提高${formatPercent(total)}个百分点`
      : `${label}提高${formatPercent(total)}%`;
  };

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {LINGXIAO_SECT.methods.map((method) => {
          const level = data.sect?.methods[method.id] ?? 0;
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
              <p className="text-ink-secondary">持有：{data.sect.contribution}贡献 · {spiritStones}灵石</p>
              {selectedDisabledReason ? <p className="text-crimson">{selectedDisabledReason}</p> : null}
            </div>
            <InkButton
              variant="primary"
              disabled={busy || Boolean(selectedDisabledReason)}
              onClick={() => void action(
                `/api/sects/methods/${selectedMethod.id}/train`,
                json('POST', { targetLevel: selectedTarget }),
                { refreshCurrency: true, successMessage: `${selectedMethod.name}已研习至${selectedTarget}级` },
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
                <p className="text-crimson">当前累计：{cumulativeBenefit(selectedMethod, selectedLevel)}</p>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-base font-semibold">修炼节点与神通</h3>
              <div className="space-y-3">
                {selectedMilestones.map((node) => {
                  const abilityDefinition = node.abilityId ? LINGXIAO_ABILITY_BY_ID.get(node.abilityId) : undefined;
                  const abilityDetail = node.abilityId
                    ? projectLingxiaoAbilityDetail({ abilityId: node.abilityId, sect: data.sect!, realm })
                    : undefined;
                  const stateLabel = node.status === 'unlocked' ? '已解锁' : node.status === 'next' ? '下一节点' : '尚未达到';
                  return (
                    <div key={node.id} className="border-ink/15 border-b border-dashed pb-3 text-sm leading-6 last:border-b-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{node.level}级 · {abilityDetail?.name ?? node.name}</strong>
                        <span className={node.status === 'unlocked' ? 'text-crimson' : 'text-ink-secondary'}>{stateLabel}</span>
                      </div>
                      <p>{node.description}</p>
                      {abilityDefinition ? <p className="text-ink-secondary">定位：{roleLabels[abilityDefinition.role]} · {abilityDefinition.description}</p> : null}
                      {node.missingRequirements.length ? <p className="text-ink-secondary">尚需：{node.missingRequirements.join('、')}</p> : null}
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

function MeridiansTab({ data, busy, action, realm, stage }: TabProps) {
  const sect = data.sect;
  const [slot, setSlot] = useState<1 | 2 | 3>(sect?.activeMeridianSlot ?? 1);
  const [selected, setSelected] = useState<string[]>(
    sect?.meridianLoadouts.find((item) => item.slot === (sect.activeMeridianSlot ?? 1))?.nodeIds ?? [],
  );
  if (sect?.status !== 'active') return <InkNotice>拜师后方可查看剑脉。</InkNotice>;

  const path = LINGXIAO_SECT.paths[0];
  const progress = getSwiftMeridianProgress({ realm, stage, methods: sect.methods });
  const canSelectPath = realm !== '炼气' && (sect.methods['lingxiao-canon'] ?? 0) >= 25;
  const ultimateMissing = progress.ultimateMissingMethods.map((methodId) => `${LINGXIAO_METHOD_BY_ID.get(methodId)?.name}100级`);
  const toggle = (nodeId: string, layer: string) => {
    setSelected((current) => [
      ...current.filter((id) => String(path.nodes.find((node) => node.id === id)?.layer) !== layer),
      nodeId,
    ]);
  };

  return (
    <div className="space-y-4">
      <InkNotice>
        当前境界：{realm}{stage} · 已开放：{progress.highestOpenLayer ? `第${progress.highestOpenLayer}层` : '尚未开放普通剑脉'}。
        {progress.nextStage ? ` 下一层需${progress.nextStage.realm}${progress.nextStage.stage}。` : ' 普通五层已全部开放。'}
        {progress.ultimateAvailable
          ? ' 终式资格已具备。'
          : ` 终式尚需：${[...(progress.ultimateRealmMet ? [] : ['化神圆满']), ...ultimateMissing].join('、')}。`}
      </InkNotice>

      {!sect.pathId ? (
        <SectCard title="快剑择道">
          <p className="text-sm leading-7">完整剑脉可先行预览；筑基且《凌霄剑典》25级后可择定快剑道。</p>
          <InkButton disabled={busy || !canSelectPath} onClick={() => action('/api/sects/paths/swift-sword/select', json('POST'))}>
            选择快剑道
          </InkButton>
          {!canSelectPath ? <p className="text-ink-secondary text-sm">尚需筑基并将《凌霄剑典》研习至25级。</p> : null}
        </SectCard>
      ) : (
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((value) => (
            <InkButton
              key={value}
              variant={slot === value ? 'primary' : 'secondary'}
              onClick={() => {
                setSlot(value);
                setSelected(sect.meridianLoadouts.find((item) => item.slot === value)?.nodeIds ?? []);
              }}
            >
              方案{value}{sect.activeMeridianSlot === value ? '·当前' : ''}
            </InkButton>
          ))}
        </div>
      )}

      {SWIFT_MERIDIAN_STAGES.map((stageDefinition) => {
        const available = Boolean(sect.pathId) && isSwiftMeridianLayerAvailable(stageDefinition.layer, progress);
        const layerLabel = stageDefinition.layer === 'ultimate' ? '终式' : `第${stageDefinition.layer}层`;
        const requirement = stageDefinition.layer === 'ultimate'
          ? `化神圆满 · 双心法100级`
          : `${stageDefinition.realm}${stageDefinition.stage}`;
        return (
          <SectCard key={String(stageDefinition.layer)} title={`${layerLabel} · ${requirement}`}>
            {!available ? <p className="text-ink-secondary mb-2 text-sm">只读预览：{sect.pathId ? '尚未满足开放条件。' : '择定快剑道后方可配置。'}</p> : null}
            <div className="grid gap-2 md:grid-cols-3">
              {path.nodes.filter((node) => node.layer === stageDefinition.layer).map((node) => (
                <button
                  type="button"
                  key={node.id}
                  disabled={!available}
                  onClick={() => toggle(node.id, String(stageDefinition.layer))}
                  className={`p-3 text-left text-sm leading-6 transition-colors ${selected.includes(node.id) ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'} ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}
                >
                  <strong>{node.name}</strong><br />{node.description}
                </button>
              ))}
            </div>
          </SectCard>
        );
      })}

      {sect.pathId ? (
        <div className="flex flex-wrap gap-2">
          <InkButton disabled={busy} onClick={() => action(`/api/sects/meridian-loadouts/${slot}`, json('PUT', { nodeIds: selected }))}>
            保存方案
          </InkButton>
          <InkButton disabled={busy || sect.activeMeridianSlot === slot} onClick={() => action(`/api/sects/meridian-loadouts/${slot}/activate`, json('POST'))}>
            激活方案
          </InkButton>
        </div>
      ) : null}
    </div>
  );
}

function CommissionsTab({ data, busy, action }: TabProps) {
  if (data.sect?.status !== 'active') return <InkNotice>拜师后方可承接每日委托。</InkNotice>;
  const done = data.commission.completionType;
  return (
    <div className="space-y-4">
      <InkNotice>每日演剑、历练、争锋三选一；第一个完成事件锁定当日结果。日期以东八区为准。</InkNotice>
      <div className="grid gap-3 md:grid-cols-3">
        <SectCard title="演剑">
          <p className="text-sm leading-7">与宗门木人完成一场实战，胜负均算。</p>
          <InkButton disabled={busy || Boolean(done)} onClick={() => action('/api/sects/commissions/spar', json('POST'))}>开始演剑</InkButton>
        </SectCard>
        <SectCard title="历练"><p className="text-sm leading-7">完成一次副本结算后自动记录。</p></SectCard>
        <SectCard title="争锋"><p className="text-sm leading-7">完成一次天骄榜挑战后自动记录。</p></SectCard>
      </div>
      {done ? (
        <SectCard title="今日已完成">
          <p className="text-sm">完成项：{done === 'spar' ? '演剑' : done === 'dungeon' ? '历练' : '争锋'}</p>
          <InkButton disabled={busy || Boolean(data.commission.claimedAt)} onClick={() => action('/api/sects/commissions/claim', json('POST'))}>
            {data.commission.claimedAt ? '已领取' : '领取贡献'}
          </InkButton>
        </SectCard>
      ) : null}
    </div>
  );
}
