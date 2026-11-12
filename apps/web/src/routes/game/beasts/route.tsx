import { BeastRosterEntry } from '@app/components/feature/beasts/BeastRosterEntry';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { useStory } from '@app/lib/story/useStory';
import type { BeastManagementView } from '@daoyou/contracts/beasts';
import {} from '@daoyou/game-content/beasts';
import {
  BEAST_BAG_CAPACITY,
  BEAST_WAREHOUSE_CAPACITY,
  carriedBeastIds,
  warehouseBeastCount,
} from '@daoyou/game-rules/beasts/growth';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BeastActionDrawer, type BeastAction } from './BeastActionDrawer';
import { BeastBookDrawer } from './BeastBookDrawer';
import { BeastPanel } from './BeastPanel';
import { BeastRenameModal } from './BeastRenameModal';
import { BeastRosterScroll } from './BeastRosterScroll';
import { FusionWorkspace } from './fusion/FusionWorkspace';

const base = '/api/combat-v6/beasts';
export default function BeastsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ownerId = useCultivatorIdentity().data?.cultivator?.id;
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
  const [fusion, setFusion] = useState<{
    nonce: number;
    beastId?: string;
  } | null>(null);
  function openFusion(beastId?: string) {
    if (!ownerId) return;
    setFusion((current) => ({
      nonce: (current?.nonce ?? 0) + 1,
      beastId,
    }));
  }
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
        setAction(undefined);
        pushToast({
          message:
            message ??
            (path === 'lineup'
              ? '携带出战已更新'
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
      ) : fusion && ownerId ? (
        <FusionWorkspace
          key={fusion.nonce}
          ownerId={ownerId}
          ownerLevel={view.ownerLevel}
          lineup={view.lineup}
          initialBeast={view.beasts.find(
            (beast) => beast.id === fusion.beastId,
          )}
          closeLabel="返回"
          onClose={() => setFusion(null)}
          onRoster={setView}
          onViewResult={(beast, inBag) => {
            setFusion(null);
            if (inBag) setDetailId(beast.id);
            else navigate(`/game/beasts/warehouse?beast=${beast.id}`);
          }}
        />
      ) : (
        <>
          <div
            data-guide="beast.bag"
            className="text-ink-secondary flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"
          >
            <span>
              灵兽袋{' '}
              <span className="font-mono">
                {bagBeasts.length} / {BEAST_BAG_CAPACITY}
              </span>
            </span>
            {/* 新手期先只认袋里这一只，图鉴、融合、仓库等主线走完再摆出来。 */}
            <span
              className={
                story.story?.unlocked
                  ? 'hidden'
                  : 'flex flex-wrap items-center justify-end gap-1'
              }
            >
              <InkButton disabled={pending} href="/game/beasts/codex">
                灵兽图鉴
              </InkButton>
              <InkButton
                disabled={pending || !ownerId}
                onClick={() => openFusion(detail?.id)}
              >
                融合
              </InkButton>
              <InkButton disabled={pending} href="/game/beasts/warehouse">
                仓库
              </InkButton>
            </span>
          </div>
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
                    <BeastRosterEntry
                      key={beast.id}
                      beast={beast}
                      selected={detail?.id === beast.id}
                      isLead={view.lineup.leadBeastId === beast.id}
                      onSelect={() => setDetailId(beast.id)}
                    />
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
                        className="text-ink-secondary hover:bg-teal/5 hover:text-teal h-16 text-xs transition-colors"
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
                  setLocked={(isLocked) => {
                    void mutate(
                      'lock',
                      {
                        beastId: detail.id,
                        expectedRevision: detail.revision,
                        isLocked,
                      },
                      'POST',
                      isLocked ? '灵兽已锁定' : '灵兽已解锁',
                    );
                  }}
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
                  fuse={() => openFusion(detail.id)}
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
          onUpdate={(beast) =>
            setView((current) =>
              current
                ? {
                    ...current,
                    beasts: current.beasts.map((entry) =>
                      entry.id === beast.id ? beast : entry,
                    ),
                  }
                : current,
            )
          }
        />
      ) : null}
      {refiningId ? (
        <BeastBookDrawer
          beastId={refiningId}
          mode="refine"
          close={() => setRefiningId(undefined)}
          onUpdate={(beast) =>
            setView((current) =>
              current
                ? {
                    ...current,
                    beasts: current.beasts.map((entry) =>
                      entry.id === beast.id ? beast : entry,
                    ),
                  }
                : current,
            )
          }
        />
      ) : null}
      {rejuvenatingId ? (
        <BeastBookDrawer
          beastId={rejuvenatingId}
          mode="rejuvenate"
          close={() => setRejuvenatingId(undefined)}
          onUpdate={(beast) =>
            setView((current) =>
              current
                ? {
                    ...current,
                    beasts: current.beasts.map((entry) =>
                      entry.id === beast.id ? beast : entry,
                    ),
                  }
                : current,
            )
          }
        />
      ) : null}
      {learningId ? (
        <BeastBookDrawer
          beastId={learningId}
          close={() => setLearningId(undefined)}
          onUpdate={(beast) =>
            setView((current) =>
              current
                ? {
                    ...current,
                    beasts: current.beasts.map((entry) =>
                      entry.id === beast.id ? beast : entry,
                    ),
                  }
                : current,
            )
          }
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
    </GameSceneFrame>
  );
}
