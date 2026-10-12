import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastMutationTag } from '@app/components/feature/beasts/BeastMutationTag';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useStory } from '@app/lib/story/useStory';
import type { BeastManagementView } from '@daoyou/contracts/beasts';
import {
  BEAST_GENERATION,
  BEAST_STARTER_SPECIES,
} from '@daoyou/game-content/beasts';
import {
  BEAST_BAG_CAPACITY,
  BEAST_WAREHOUSE_CAPACITY,
  carriedBeastIds,
  warehouseBeastCount,
} from '@daoyou/game-rules/beasts/growth';
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
  const story = useStory();
  const { openDialog, pushToast } = useInkUI();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingLineup, setPendingLineup] = useState<{
    beastId: string;
    action: 'lead' | 'unlead';
  }>();
  const [detailId, setDetailId] = useState<string | undefined>(
    () => searchParams.get('beast') ?? undefined,
  );
  const [claimId, setClaimId] = useState<string>();
  const [learningId, setLearningId] = useState<string>();
  const [refiningId, setRefiningId] = useState<string>();
  const [rejuvenatingId, setRejuvenatingId] = useState<string>();
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
            message: e instanceof Error ? e.message : '灵兽袋读取失败',
            tone: 'danger',
          });
        }
      });
    return () => controller.current?.abort();
  }, [pushToast, refresh]);
  async function mutate(
    path: string,
    body: unknown,
    method = 'POST',
    message?: string,
  ) {
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
            message ??
            (path === 'lineup'
              ? '携带出战已更新'
              : path === 'claim'
                ? '结缘成功'
                : path === 'rest'
                  ? '休养完成'
                  : path === 'allocate'
                    ? '属性已分配'
                    : path === 'rename'
                      ? '灵兽名字已更新'
                      : path === 'place'
                        ? '灵兽已转移'
                        : '灵兽已放生'),
          tone: 'success',
        });
        if (path === 'claim') void story.reload();
        return true;
      }
    } catch (e) {
      if (!read.signal.aborted)
        pushToast({
          message: e instanceof Error ? e.message : '灵兽操作失败',
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (!read.signal.aborted) setPending(false);
    }
    return false;
  }
  async function lineup(beastId: string, action: 'lead' | 'unlead') {
    if (!view || busy.current) return;
    const current = view.lineup;
    const ids = carriedBeastIds(view.beasts, current);
    setPendingLineup({ beastId, action });
    await mutate(
      'lineup',
      {
        carriedBeastIds: ids,
        leadBeastId: action === 'unlead' ? undefined : beastId,
        revision: current.revision,
      },
      'PUT',
    );
    setPendingLineup(undefined);
  }
  const bagIds = view ? carriedBeastIds(view.beasts, view.lineup) : [];
  const bagBeasts =
    view?.beasts.filter((beast) => bagIds.includes(beast.id)) ?? [];
  const orderedBag = bagIds
    .map((id) => bagBeasts.find((beast) => beast.id === id))
    .filter((beast) => beast !== undefined);
  const warehouseCount = view
    ? warehouseBeastCount(view.beasts, view.lineup)
    : 0;
  const detail =
    orderedBag.find((beast) => beast.id === detailId) ?? orderedBag[0];
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
            {failed ? '灵兽袋读取失败' : '正在查看灵兽袋……'}
          </p>
          {failed ? (
            <InkButton onClick={() => window.location.reload()}>
              重新加载
            </InkButton>
          ) : null}
        </div>
      ) : (
        <>
          <div
            data-guide={view.starterClaimed ? 'beast.starter' : 'beast.bag'}
            className="text-ink-secondary flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"
          >
            <span>
              灵兽袋{' '}
              <span className="font-mono">
                {bagBeasts.length} / {BEAST_BAG_CAPACITY}
              </span>
            </span>
            <span className="flex flex-wrap items-center justify-end gap-1">
              <InkButton disabled={pending} href="/game/beasts/codex">
                灵兽图鉴
              </InkButton>
              <InkButton disabled={pending} href="/game/beasts/fusion">
                灵兽融合
              </InkButton>
              <InkButton disabled={pending} href="/game/beasts/warehouse">
                灵兽仓库
              </InkButton>
            </span>
          </div>
          {!view.starterClaimed ? (
            <div
              data-guide="beast.starter"
              className="border-ink/15 space-y-3 border-b pb-4"
            >
              <p className="text-ink-secondary text-sm">
                选一位灵兽伙伴，与它一同踏上修行路。
              </p>
              <div className="flex flex-wrap gap-2">
                {BEAST_STARTER_SPECIES.map((species) => (
                  <InkButton
                    key={species.id}
                    disabled={pending || bagBeasts.length >= BEAST_BAG_CAPACITY}
                    onClick={() => setClaimId(species.id)}
                  >
                    <BeastIcon speciesId={species.id} /> {species.name}
                  </InkButton>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid min-w-0 gap-5 md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
            <aside
              data-guide="beast.roster"
              className="border-ink/15 min-w-0 border-b pb-4 md:relative md:min-h-60 md:border-r md:border-b-0 md:pb-0"
            >
              <div className="md:absolute md:inset-0 md:flex md:min-h-0 md:flex-col md:pr-4">
                <p className="text-ink-secondary mb-3 shrink-0 text-xs leading-5">
                  袋中灵兽可在战斗中召唤，首发自动入场。
                </p>
                <BeastRosterScroll>
                  {orderedBag.map((beast) => (
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
                          ) : null}
                        </span>
                      </span>
                    </button>
                  ))}
                  {Array.from(
                    {
                      length: Math.max(
                        0,
                        BEAST_BAG_CAPACITY - orderedBag.length,
                      ),
                    },
                    (_, i) => (
                      <button
                        key={i}
                        type="button"
                        className="text-ink-secondary hover:bg-teal/5 hover:text-teal min-h-14 text-xs transition-colors"
                        onClick={() =>
                          pushToast({
                            message: '可从灵兽仓库取出，或在野外捕捉。',
                            tone: 'default',
                          })
                        }
                      >
                        ＋ 空位
                      </button>
                    ),
                  )}
                </BeastRosterScroll>
              </div>
            </aside>
            {detail ? (
              <div data-guide="beast.detail" className="min-w-0">
                <BeastPanel
                  key={`${detail.id}:${detail.revision}:${view.ownerLevel}`}
                  beast={detail}
                  ownerLevel={view.ownerLevel}
                  isLead={view.lineup.leadBeastId === detail.id}
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
                  rejuvenate={() => setRejuvenatingId(detail.id)}
                  feed={() => setFeedingId(detail.id)}
                  rename={() => setRenamingId(detail.id)}
                  allocate={(points) =>
                    mutate('allocate', {
                      beastId: detail.id,
                      expectedRevision: detail.revision,
                      points,
                    })
                  }
                  warehouseFull={warehouseCount >= BEAST_WAREHOUSE_CAPACITY}
                  store={() => {
                    const save = () =>
                      mutate(
                        'place',
                        {
                          beastId: detail.id,
                          expectedRevision: detail.revision,
                          location: 'warehouse',
                        },
                        'POST',
                        view.lineup.leadBeastId === detail.id
                          ? '已存入灵兽仓库，并取消首发'
                          : '已存入灵兽仓库',
                      );
                    if (view.lineup.leadBeastId === detail.id) {
                      openDialog({
                        title: '存入仓库',
                        content: '这只灵兽正在首发。存入仓库后会取消首发。',
                        confirmLabel: '存入',
                        cancelLabel: '留下',
                        onConfirm: () => {
                          void save();
                        },
                      });
                      return;
                    }
                    void save();
                  }}
                />
              </div>
            ) : (
              <p
                data-guide="beast.detail"
                className="text-ink-secondary py-8 text-center text-sm"
              >
                {warehouseCount
                  ? '灵兽袋尚空，可从仓库取出，或在野外捕捉。'
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
      {rejuvenatingId ? (
        <BeastBookDrawer
          beastId={rejuvenatingId}
          mode="rejuvenate"
          close={() => setRejuvenatingId(undefined)}
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
            寿命，资质、成长与技能随机生成，属性点由你分配。有空位时自动携带，满足出战境界且没有首发时设为首发。
          </p>
        </InkDetailDrawer>
      ) : null}
    </GameSceneFrame>
  );
}
