import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastMutationTag } from '@app/components/feature/beasts/BeastMutationTag';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { GameSceneTabs } from '@app/components/game-shell/GameSceneTabs';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import { BEAST_STARTER_SPECIES } from '@shared/engine/combat-v6/beasts';
import { BEAST_GENERATION } from '@shared/engine/combat-v6/beasts/content';
import { BEAST_CAPACITY } from '@shared/engine/combat-v6/beasts/progression';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BeastActionDrawer, type BeastAction } from './BeastActionDrawer';
import { BeastBookDrawer } from './BeastBookDrawer';
import { BeastLeadSeal, BeastPanel } from './BeastPanel';
import { BeastRenameModal } from './BeastRenameModal';
import { BeastRosterScroll } from './BeastRosterScroll';

const base = '/api/combat-v6/beasts';
export default function BeastsPage() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<BeastManagementView>();
  const { pushToast } = useInkUI();
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'team'>('all');
  const [pending, setPending] = useState(false);
  const [pendingLineup, setPendingLineup] = useState<{
    beastId: string;
    action: 'carry' | 'lead' | 'unlead';
  }>();
  const [detailId, setDetailId] = useState<string | undefined>(
    () => searchParams.get('beast') ?? undefined,
  );
  const [claimId, setClaimId] = useState<string>();
  const [learningId, setLearningId] = useState<string>();
  const [refiningId, setRefiningId] = useState<string>();
  const [feedingId, setFeedingId] = useState<string>();
  const [renamingId, setRenamingId] = useState<string>();
  const [action, setAction] = useState<{
    beastId: string;
    type: BeastAction;
  }>();
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const reload = () => {
      if (!busy.current) setRefresh((value) => value + 1);
    };
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, []);
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
  }, [pushToast, refresh]);
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
              ? '携带出战已更新'
              : path === 'claim'
                ? '结缘成功'
                : path === 'rest'
                  ? '休养完成'
                  : path === 'allocate'
                    ? '属性已分配'
                    : path === 'rename'
                      ? '灵兽名字已更新'
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
  async function lineup(beastId: string, action: 'carry' | 'lead' | 'unlead') {
    if (!view || busy.current) return;
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
    setPendingLineup({ beastId, action });
    await mutate(
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
    setPendingLineup(undefined);
  }
  const visibleBeasts =
    view?.beasts.filter(
      (beast) =>
        filter === 'all' || view.lineup.carriedBeastIds.includes(beast.id),
    ) ?? [];
  const detail =
    visibleBeasts.find((beast) => beast.id === detailId) ?? visibleBeasts[0];
  const claim = BEAST_STARTER_SPECIES.find((species) => species.id === claimId);
  const renamingBeast = view?.beasts.find((beast) => beast.id === renamingId);
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
              灵兽{' '}
              <span className="font-mono">
                {view.beasts.length} / {BEAST_CAPACITY}
              </span>
            </span>
            <InkButton disabled={pending} href="/game/beasts/fusion">
              灵兽融合
            </InkButton>
          </div>
          {!view.starterClaimed ? (
            <div className="border-ink/15 space-y-3 border-b pb-4">
              <p className="text-ink-secondary text-sm">
                选一位灵兽伙伴，与它一同踏上修行路。
              </p>
              <div className="flex flex-wrap gap-2">
                {BEAST_STARTER_SPECIES.map((species) => (
                  <InkButton
                    key={species.id}
                    disabled={pending || view.beasts.length >= BEAST_CAPACITY}
                    onClick={() => setClaimId(species.id)}
                  >
                    <BeastIcon speciesId={species.id} /> {species.name}
                  </InkButton>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid min-w-0 gap-5 md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
            <aside className="border-ink/15 min-w-0 border-b pb-4 md:relative md:min-h-60 md:border-r md:border-b-0 md:pb-0">
              <div className="md:absolute md:inset-0 md:flex md:min-h-0 md:flex-col md:pr-4">
                <GameSceneTabs
                  className="mb-3 shrink-0"
                  activeValue={filter}
                  onChange={(value) =>
                    setFilter(value === 'team' ? 'team' : 'all')
                  }
                  items={[
                    { value: 'all', label: '全部' },
                    {
                      value: 'team',
                      label: (
                        <>
                          携带出战{' '}
                          <span className="font-mono">
                            {view.lineup.carriedBeastIds.length}/6
                          </span>
                        </>
                      ),
                    },
                  ]}
                />
                <p className="text-ink-secondary mb-3 shrink-0 text-xs leading-5">
                  携带的灵兽可在战斗中召唤，首发自动入场。
                </p>
                <BeastRosterScroll key={filter}>
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
                        <BeastIcon
                          speciesId={beast.speciesId}
                          isMutant={beast.isMutant}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1">
                          <span className="truncate text-sm" title={beast.name}>
                            {beast.name}
                          </span>
                          <BeastMutationTag isMutant={beast.isMutant} />
                        </span>
                        <span className="text-ink-secondary flex flex-wrap items-center gap-1 text-xs">
                          <span className="font-mono">{beast.level} 级</span>
                          {view.lineup.leadBeastId === beast.id ? (
                            <BeastLeadSeal />
                          ) : view.lineup.carriedBeastIds.includes(beast.id) ? (
                            <InkBadge compact>携带</InkBadge>
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
                                message: '选择灵兽后，点击「携带出战」',
                                tone: 'default',
                              });
                            }}
                          >
                            ＋ 空位
                          </button>
                        ),
                      )
                    : null}
                </BeastRosterScroll>
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
                pendingLineup={
                  pendingLineup?.beastId === detail.id
                    ? pendingLineup.action
                    : undefined
                }
                lineup={(type) => lineup(detail.id, type)}
                act={(type) => setAction({ beastId: detail.id, type })}
                learn={() => setLearningId(detail.id)}
                refine={() => setRefiningId(detail.id)}
                feed={() => setFeedingId(detail.id)}
                rename={() => setRenamingId(detail.id)}
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
                  ? '尚未携带灵兽，选择空位添加出战伙伴。'
                  : '灵兽袋尚空，可在野外捕捉灵兽。'}
              </p>
            )}
          </div>
        </>
      )}
      {renamingBeast ? (
        <BeastRenameModal
          key={renamingBeast.id}
          name={renamingBeast.name}
          pending={pending}
          close={() => setRenamingId(undefined)}
          save={(name) =>
            mutate('rename', {
              beastId: renamingBeast.id,
              expectedRevision: renamingBeast.revision,
              name,
            })
          }
        />
      ) : null}
      {feedingId ? (
        <BeastBookDrawer
          beastId={feedingId}
          mode="feed"
          close={() => setFeedingId(undefined)}
          onUpdate={setView}
        />
      ) : null}
      {refiningId ? (
        <BeastBookDrawer
          beastId={refiningId}
          mode="refine"
          close={() => setRefiningId(undefined)}
          onUpdate={setView}
        />
      ) : null}
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
              variant="primary"
              pending={pending}
              onClick={() => void mutate('claim', { speciesId: claim.id })}
            >
              确认结缘
            </InkButton>
          }
        >
          <p className="text-sm leading-7">
            每位角色可免费选择一次。伙伴初始为
            {BEAST_GENERATION.starterLevel}级、
            {BEAST_GENERATION.lifespan}
            寿命，资质、成长与出生技能随机生成，属性点由你分配。有空位时自动携带，满足出战境界且没有首发时设为首发。
          </p>
        </InkDetailDrawer>
      ) : null}
    </GameSceneFrame>
  );
}
