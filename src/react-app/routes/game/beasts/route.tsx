import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts';
import { BEAST_CAPACITY } from '@shared/engine/combat-v6/beasts/progression';
import { useEffect, useRef, useState } from 'react';
import { BeastActionDrawer, type BeastAction } from './BeastActionDrawer';
import { BeastBookDrawer } from './BeastBookDrawer';
import { BeastIcon, BeastLeadSeal, BeastPanel } from './BeastPanel';

const base = '/api/combat-v6/beasts';
export default function BeastsPage() {
  const [view, setView] = useState<BeastManagementView>();
  const { pushToast } = useInkUI();
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'team'>('all');
  const [pending, setPending] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [claimId, setClaimId] = useState<string>();
  const [learningId, setLearningId] = useState<string>();
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
      .then((result) => {
        if (!read.signal.aborted) setView(result);
      })
      .catch((e) => {
        if (!read.signal.aborted) {
          setFailed(true);
          pushToast({
            message: e instanceof Error ? e.message : '读取失败',
            tone: 'danger',
          });
        }
      });
    return () => controller.current?.abort();
  }, [pushToast]);
  async function mutate(path: string, body: unknown, method = 'POST') {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setFailed(false);
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
        pushToast({
          message:
            path === 'lineup'
              ? '出战编组已更新'
              : path === 'claim'
                ? '结缘成功'
                : path === 'rest'
                  ? '休养完成'
                  : path === 'allocate'
                    ? '属性已分配'
                    : '灵兽已放生',
          tone: 'success',
        });
        return true;
      }
    } catch (e) {
      if (!read.signal.aborted)
        pushToast({
          message: e instanceof Error ? e.message : '操作失败',
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (!read.signal.aborted) setPending(false);
    }
    return false;
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
  const visibleBeasts =
    view?.beasts.filter(
      (beast) =>
        filter === 'all' || view.lineup.carriedBeastIds.includes(beast.id),
    ) ?? [];
  const detail =
    visibleBeasts.find((beast) => beast.id === detailId) ?? visibleBeasts[0];
  const claim = BEAST_SPECIES.find((species) => species.id === claimId);
  const actionBeast = view?.beasts.find(
    (beast) => beast.id === action?.beastId,
  );
  return (
    <GameSceneFrame variant="workflow">
      {!view ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm">
            {failed ? '灵兽袋读取失败' : '正在寻访灵兽……'}
          </p>
          {failed ? (
            <InkButton onClick={() => window.location.reload()}>
              重新加载
            </InkButton>
          ) : null}
        </div>
      ) : (
        <>
          <div className="text-ink-secondary flex items-center justify-between gap-3 text-xs">
            <span>
              灵兽 {view.beasts.length} / {BEAST_CAPACITY}
            </span>
          </div>
          {!view.starterClaimed ? (
            <div className="border-ink/15 space-y-3 border-b pb-4">
              <p className="text-ink-secondary text-sm">
                选一位灵兽伙伴，与它一同踏上修行路。
              </p>
              <div className="flex flex-wrap gap-2">
                {BEAST_SPECIES.map((species) => (
                  <InkButton
                    key={species.id}
                    disabled={pending || view.beasts.length >= BEAST_CAPACITY}
                    onClick={() => setClaimId(species.id)}
                  >
                    <BeastIcon speciesId={species.id} /> {species.name} ·{' '}
                    {species.role}
                  </InkButton>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid min-w-0 gap-5 md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
            <aside className="border-ink/15 min-w-0 border-b pb-4 md:border-r md:border-b-0 md:pr-4 md:pb-0">
              <div className="mb-3 flex gap-4" aria-label="灵兽筛选">
                {(['all', 'team'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`hover:text-teal min-h-10 border-b-2 text-xs transition-colors ${filter === value ? 'border-teal text-teal' : 'text-ink-secondary border-transparent'}`}
                  >
                    {value === 'all'
                      ? '全部'
                      : `出战编组 ${view.lineup.carriedBeastIds.length}/6`}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1 md:grid-cols-1">
                {visibleBeasts.map((beast) => (
                  <button
                    type="button"
                    key={beast.id}
                    aria-pressed={detail?.id === beast.id}
                    onClick={() => setDetailId(beast.id)}
                    className={`hover:bg-teal/5 flex min-w-0 items-center gap-2 border-l-2 px-1 py-3 text-left transition-colors md:gap-3 md:px-2 ${detail?.id === beast.id ? 'border-teal bg-teal/8' : 'border-transparent'}`}
                  >
                    <span
                      aria-hidden
                      className="shrink-0 font-sans text-2xl md:text-3xl"
                    >
                      <BeastIcon speciesId={beast.speciesId} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1">
                        <span className="truncate text-sm" title={beast.name}>
                          {beast.name}
                        </span>
                      </span>
                      <span className="text-ink-secondary flex flex-wrap items-center gap-1 text-xs">
                        {beast.level}级
                        {view.lineup.leadBeastId === beast.id ? (
                          <BeastLeadSeal />
                        ) : view.lineup.carriedBeastIds.includes(beast.id) ? (
                          ' · 编组'
                        ) : null}
                      </span>
                    </span>
                  </button>
                ))}
                {filter === 'team'
                  ? Array.from(
                      {
                        length: Math.max(
                          0,
                          6 - view.lineup.carriedBeastIds.length,
                        ),
                      },
                      (_, i) => (
                        <button
                          key={i}
                          type="button"
                          className="text-ink-secondary hover:bg-teal/5 hover:text-teal min-h-14 text-xs transition-colors"
                          onClick={() => {
                            setFilter('all');
                            setDetailId(
                              view.beasts.find(
                                (beast) =>
                                  !view.lineup.carriedBeastIds.includes(
                                    beast.id,
                                  ),
                              )?.id,
                            );
                            pushToast({
                              message: '选择灵兽后，点击加入编组',
                              tone: 'default',
                            });
                          }}
                        >
                          ＋ 空位
                        </button>
                      ),
                    )
                  : null}
              </div>
            </aside>
            {detail ? (
              <BeastPanel
                key={`${detail.id}:${detail.revision}:${view.ownerLevel}`}
                beast={detail}
                ownerLevel={view.ownerLevel}
                isLead={view.lineup.leadBeastId === detail.id}
                carried={view.lineup.carriedBeastIds.includes(detail.id)}
                full={view.lineup.carriedBeastIds.length >= 6}
                pending={pending}
                lineup={(type) => lineup(detail.id, type)}
                act={(type) => setAction({ beastId: detail.id, type })}
                learn={() => setLearningId(detail.id)}
                allocate={(points) =>
                  mutate('allocate', {
                    beastId: detail.id,
                    expectedRevision: detail.revision,
                    points,
                  })
                }
              />
            ) : (
              <p className="text-ink-secondary py-8 text-center text-sm">
                {filter === 'team'
                  ? '尚未编入灵兽，选择空位开始编组。'
                  : '灵兽袋尚空，可在野外捕捉灵兽。'}
              </p>
            )}
          </div>
        </>
      )}
      {learningId ? (
        <BeastBookDrawer
          beastId={learningId}
          close={() => setLearningId(undefined)}
          onUpdate={setView}
        />
      ) : null}
      {actionBeast && action ? (
        <BeastActionDrawer
          key={`${action.type}:${actionBeast.id}:${actionBeast.revision}`}
          beast={actionBeast}
          action={action.type}
          spiritStones={view!.spiritStones}
          pending={pending}
          close={() => {
            if (!busy.current) setAction(undefined);
          }}
          confirm={() =>
            void mutate(action.type, {
              beastId: actionBeast.id,
              expectedRevision: actionBeast.revision,
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
