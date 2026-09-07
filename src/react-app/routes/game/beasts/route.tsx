import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { combatV6SkillDetails } from '@shared/combat-v6/skill-details';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import {
  BEAST_SKILLS,
  BEAST_SPECIES,
  beastPanel,
  beastRealm,
  canDeployBeast,
  type SummonedBeast,
} from '@shared/engine/combat-v6/beasts';
import { nextBeastExp } from '@shared/engine/combat-v6/beasts/progression';
import { useEffect, useRef, useState } from 'react';
import { BeastActionDrawer, type BeastAction } from './BeastActionDrawer';

const base = '/api/combat-v6/beasts';
const skillDetails = combatV6SkillDetails(BEAST_SKILLS, []);
const attributeNames = {
  constitution: '体质',
  strength: '力量',
  magic: '法力',
  endurance: '耐力',
  agility: '敏捷',
};
function BeastDetails({
  beast,
  close,
  ownerLevel,
  pending,
  isLead,
  act,
}: {
  beast: SummonedBeast;
  close: () => void;
  ownerLevel: number;
  pending: boolean;
  isLead: boolean;
  act: (action: BeastAction) => void;
}) {
  const panel = beastPanel(beast);
  return (
    <InkDetailDrawer isOpen title={beast.name} onClose={close} size="sm">
      <div className="space-y-4 text-sm">
        <p>
          {beastRealm(beast.level)} · {beast.level}级 · 成长{' '}
          {beast.growth.toFixed(3)}
        </p>
        <p>
          寿命 {beast.currentLifespan} / {beast.maxLifespan} · 技能格{' '}
          {beast.skillSlotCapacity}
        </p>
        <p>
          携带等级{' '}
          {BEAST_SPECIES.find((s) => s.id === beast.speciesId)?.carryLevel} ·
          战斗等级 {beast.level}
        </p>
        <p>
          {beast.level >= Math.min(ownerLevel, 180)
            ? '已达当前培养上限'
            : `经验 ${beast.exp} / ${nextBeastExp(beast.level)}`}{' '}
          · 待分配 {beast.unallocatedPoints} 点
        </p>
        {!canDeployBeast(beast, ownerLevel) ? (
          <p className="text-crimson">等级或寿命不满足出战条件</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <InkButton
            disabled={
              pending ||
              beast.unallocatedPoints === 0 ||
              beast.level > ownerLevel
            }
            onClick={() => act('allocate')}
          >
            分配属性
          </InkButton>
          <InkButton
            disabled={pending || isLead}
            onClick={() => act('release')}
          >
            放生
          </InkButton>
        </div>
        {isLead ? (
          <p className="text-ink-secondary">放生前请先取消首发。</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {beast.skills.map((id) => (
            <span key={id} className="inline-flex items-center gap-1">
              {BEAST_SKILLS.find((skill) => skill.id === id)?.name}
              <InkTooltip label="查看兽诀说明">
                {skillDetails[id]?.description}
              </InkTooltip>
            </span>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {Object.entries(attributeNames).map(([key, name]) => (
            <div key={key}>
              <dt className="text-ink-secondary">{name}</dt>
              <dd>
                {10 +
                  beast.level +
                  beast.allocatedAttributes[key as keyof typeof attributeNames]}
              </dd>
            </div>
          ))}
        </dl>
        <p>
          气血 {panel.maxHp} · 法力 {panel.maxMp}
        </p>
        <p>
          物攻 {panel.physicalAtk} · 物防 {panel.physicalDef} · 法攻{' '}
          {panel.magicAtk} · 法防 {panel.magicDef} · 速度 {panel.speed}
        </p>
        <p>
          攻击资质 {beast.aptitudes.attack} · 防御资质 {beast.aptitudes.defense}{' '}
          · 体力资质 {beast.aptitudes.health} · 法力资质 {beast.aptitudes.mana}{' '}
          · 速度资质 {beast.aptitudes.speed}
        </p>
        <p className="text-ink-secondary">
          每场满气血、法力入场。野外死亡每场扣除一次50寿命；不足50不能出战，切磋与练功不消耗寿命。
        </p>
      </div>
    </InkDetailDrawer>
  );
}

export default function BeastsPage() {
  const [view, setView] = useState<BeastManagementView>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [claimId, setClaimId] = useState<string>();
  const [action, setAction] = useState<{
    beastId: string;
    type: BeastAction;
  }>();
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const read = new AbortController();
    controller.current = read;
    void combatV6Request<BeastManagementView>(base, { signal: read.signal })
      .then(setView)
      .catch((e) => {
        if (!read.signal.aborted)
          setError(e instanceof Error ? e.message : '读取失败');
      });
    return () => controller.current?.abort();
  }, []);
  async function mutate(path: string, body: unknown, method = 'POST') {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    controller.current?.abort();
    const read = new AbortController();
    controller.current = read;
    try {
      const result = await combatV6Request<BeastManagementView>(
        `${base}/${path}`,
        { ...mutationBody(body, method), signal: read.signal },
      );
      if (!read.signal.aborted) {
        setView(result);
        setClaimId(undefined);
        setAction(undefined);
      }
    } catch (e) {
      if (!read.signal.aborted)
        setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      busy.current = false;
      if (!read.signal.aborted) setPending(false);
    }
  }
  function lineup(beastId: string, action: 'carry' | 'lead' | 'unlead') {
    if (!view) return;
    const current = view.lineup;
    const carried = current.carriedBeastIds.includes(beastId);
    const ids =
      action === 'lead'
        ? carried
          ? current.carriedBeastIds
          : [...current.carriedBeastIds, beastId]
        : action === 'unlead'
          ? current.carriedBeastIds
          : carried
            ? current.carriedBeastIds.filter((id) => id !== beastId)
            : [...current.carriedBeastIds, beastId];
    void mutate(
      'lineup',
      {
        carriedBeastIds: ids,
        leadBeastId:
          action === 'unlead'
            ? undefined
            : action === 'lead'
              ? beastId
              : ids.includes(current.leadBeastId ?? '')
                ? current.leadBeastId
                : undefined,
        revision: current.revision,
      },
      'PUT',
    );
  }
  const detail = view?.beasts.find((beast) => beast.id === detailId);
  const claim = BEAST_SPECIES.find((species) => species.id === claimId);
  const actionBeast = view?.beasts.find(
    (beast) => beast.id === action?.beastId,
  );
  return (
    <GameSceneFrame variant="workflow">
      {error ? (
        <p role="alert" className="text-crimson">
          {error}
        </p>
      ) : null}
      {!view ? (
        <p>正在寻访灵兽……</p>
      ) : (
        <>
          {!view.starterClaimed ? (
            <div className="space-y-3">
              <p className="text-ink-secondary text-sm">
                选一位灵兽伙伴，与它一同踏上修行路。
              </p>
              {BEAST_SPECIES.map((species) => (
                <button
                  className="border-ink/15 flex w-full items-center justify-between border-b py-3 text-left"
                  key={species.id}
                  disabled={pending}
                  onClick={() => setClaimId(species.id)}
                >
                  <span>{species.name}</span>
                  <span className="text-ink-secondary text-sm">
                    {species.role} →
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {view.beasts.map((beast) => (
            <div
              key={beast.id}
              className="border-ink/15 space-y-2 border-b py-3"
            >
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setDetailId(beast.id)}
              >
                <span>
                  {beast.name}
                  {view.lineup.leadBeastId === beast.id ? ' · 首发' : ''}
                </span>
                <span className="text-ink-secondary text-sm">
                  {beastRealm(beast.level)} · 详情 →
                </span>
              </button>
              <div className="flex flex-wrap gap-2">
                <InkButton
                  disabled={
                    pending ||
                    (!view.lineup.carriedBeastIds.includes(beast.id) &&
                      view.lineup.carriedBeastIds.length >= 6)
                  }
                  onClick={() => lineup(beast.id, 'carry')}
                >
                  {view.lineup.carriedBeastIds.includes(beast.id)
                    ? '移出携带'
                    : '携带'}
                </InkButton>
                <InkButton
                  disabled={
                    pending ||
                    (view.lineup.leadBeastId !== beast.id &&
                      !canDeployBeast(beast, view.ownerLevel)) ||
                    (!view.lineup.carriedBeastIds.includes(beast.id) &&
                      view.lineup.carriedBeastIds.length >= 6)
                  }
                  onClick={() =>
                    lineup(
                      beast.id,
                      view.lineup.leadBeastId === beast.id ? 'unlead' : 'lead',
                    )
                  }
                >
                  {view.lineup.leadBeastId === beast.id
                    ? '取消首发'
                    : '设为首发'}
                </InkButton>
                <InkButton
                  disabled={
                    pending || beast.currentLifespan >= beast.maxLifespan
                  }
                  onClick={() => setAction({ beastId: beast.id, type: 'rest' })}
                >
                  休养
                </InkButton>
              </div>
            </div>
          ))}
        </>
      )}
      {detail && !action ? (
        <BeastDetails
          beast={detail}
          ownerLevel={view!.ownerLevel}
          pending={pending}
          isLead={view!.lineup.leadBeastId === detail.id}
          act={(type) => setAction({ beastId: detail.id, type })}
          close={() => setDetailId(undefined)}
        />
      ) : null}
      {actionBeast && action ? (
        <BeastActionDrawer
          key={`${action.type}:${actionBeast.id}:${actionBeast.revision}`}
          beast={actionBeast}
          action={action.type}
          error={error}
          ownerLevel={view!.ownerLevel}
          spiritStones={view!.spiritStones}
          pending={pending}
          close={() => setAction(undefined)}
          confirm={(points) =>
            void mutate(action.type, {
              beastId: actionBeast.id,
              expectedRevision: actionBeast.revision,
              ...(points ? { points } : {}),
            })
          }
        />
      ) : null}
      {claim ? (
        <InkDetailDrawer
          isOpen
          title={`结缘${claim.name}`}
          size="sm"
          onClose={() => setClaimId(undefined)}
          footer={
            <InkButton
              pending={pending}
              onClick={() => void mutate('claim', { speciesId: claim.id })}
            >
              确认结缘
            </InkButton>
          }
        >
          <p className="text-sm leading-7">
            每位角色可免费选择一次。伙伴初始10级、1000寿命，资质与成长生成后固定，附带一格出生技能。有空位时自动携带，满足出战等级且没有首发时设为首发。
          </p>
        </InkDetailDrawer>
      ) : null}
    </GameSceneFrame>
  );
}
