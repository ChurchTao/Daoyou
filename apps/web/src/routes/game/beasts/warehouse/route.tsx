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
import type { BeastManagementView } from '@daoyou/contracts/beasts';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import {
  BEAST_BAG_CAPACITY,
  BEAST_WAREHOUSE_CAPACITY,
  carriedBeastIds,
} from '@daoyou/game-rules/beasts/growth';
import { useEffect, useRef, useState } from 'react';
import { BeastActionDrawer, type BeastAction } from '../BeastActionDrawer';
import { BeastBookDrawer } from '../BeastBookDrawer';
import { BeastPanel } from '../BeastPanel';
import { BeastRenameModal } from '../BeastRenameModal';
import { BeastRosterScroll } from '../BeastRosterScroll';

const speciesName = new Map(
  BEAST_SPECIES.map((species) => [species.id, species.name]),
);

export default function BeastWarehousePage() {
  const { openDialog, pushToast } = useInkUI();
  const [view, setView] = useState<BeastManagementView>();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [storing, setStoring] = useState(false);
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
    void combatV6Request<BeastManagementView>('/api/combat-v6/beasts', {
      signal: read.signal,
    })
      .then((result) => {
        if (!read.signal.aborted) setView(result);
      })
      .catch((error) => {
        if (!read.signal.aborted) {
          setFailed(true);
          pushToast({
            message:
              error instanceof Error ? error.message : '灵兽仓库读取失败',
            tone: 'danger',
          });
        }
      });
    return () => controller.current?.abort();
  }, [pushToast, refresh]);

  async function place(
    beast: SummonedBeast,
    location: 'bag' | 'warehouse',
    message: string,
  ) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    controller.current?.abort();
    const read = new AbortController();
    controller.current = read;
    try {
      const result = await combatV6Request<BeastManagementView>(
        '/api/combat-v6/beasts/place',
        {
          ...mutationBody({
            beastId: beast.id,
            expectedRevision: beast.revision,
            location,
          }),
          signal: read.signal,
        },
      );
      if (!read.signal.aborted) {
        setView(result);
        setSelectedId(location === 'warehouse' ? beast.id : undefined);
        setStoring(false);
        pushToast({ message, tone: 'success' });
      }
    } catch (error) {
      if (!read.signal.aborted)
        pushToast({
          message: error instanceof Error ? error.message : '灵兽转移失败',
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (!read.signal.aborted) setPending(false);
    }
  }

  const bagIds = view ? carriedBeastIds(view.beasts, view.lineup) : [];
  const stored =
    view?.beasts.filter((beast) => !bagIds.includes(beast.id)) ?? [];
  const carried =
    view?.beasts.filter((beast) => bagIds.includes(beast.id)) ?? [];
  const selected = stored.find((beast) => beast.id === selectedId) ?? stored[0];
  const bagFull = carried.length >= BEAST_BAG_CAPACITY;

  async function operate(beast: SummonedBeast, path: 'rest' | 'release') {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await combatV6Request<BeastManagementView>(
        `/api/combat-v6/beasts/${path}`,
        mutationBody({
          beastId: beast.id,
          expectedRevision: beast.revision,
        }),
      );
      setView(result);
      setAction(undefined);
      pushToast({
        message: path === 'rest' ? '休养完成' : '灵兽已放生',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '灵兽操作失败',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function withdraw(beast: SummonedBeast) {
    void place(beast, 'bag', '已取出到灵兽袋');
  }
  function deposit(beast: SummonedBeast) {
    const save = () =>
      place(
        beast,
        'warehouse',
        view?.lineup.leadBeastId === beast.id
          ? '已存入灵兽仓库，并取消首发'
          : '已存入灵兽仓库',
      );
    if (view?.lineup.leadBeastId === beast.id) {
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
  }

  return (
    <GameSceneFrame variant="workflow">
      {!view ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm">
            {failed ? '灵兽仓库读取失败' : '正在查看灵兽仓库……'}
          </p>
          {failed ? (
            <InkButton onClick={() => window.location.reload()}>
              重新加载
            </InkButton>
          ) : null}
        </div>
      ) : (
        <>
          <div className="text-ink-secondary flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
            <span>
              仓库{' '}
              <span className="font-mono">
                {stored.length} / {BEAST_WAREHOUSE_CAPACITY}
              </span>
            </span>
            <InkButton
              disabled={pending || stored.length >= BEAST_WAREHOUSE_CAPACITY}
              onClick={() => setStoring(true)}
            >
              从灵兽袋存入
            </InkButton>
          </div>
          {stored.length ? (
            <div className="grid min-w-0 gap-5 md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
              <aside className="border-ink/15 min-w-0 border-b pb-4 md:relative md:min-h-60 md:border-r md:border-b-0 md:pb-0">
                <div className="md:absolute md:inset-0 md:flex md:min-h-0 md:flex-col md:pr-4">
                  <BeastRosterScroll>
                    {stored.map((beast) => (
                      <button
                        type="button"
                        key={beast.id}
                        aria-pressed={selected?.id === beast.id}
                        onClick={() => setSelectedId(beast.id)}
                        className={`hover:bg-teal/5 flex min-w-0 items-center gap-2 border-l-2 px-1 py-3 text-left transition-colors md:gap-3 md:px-2 ${selected?.id === beast.id ? 'border-teal bg-teal/8' : 'border-transparent'}`}
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
                            <span
                              className="truncate text-sm"
                              title={beast.name}
                            >
                              {beast.name}
                            </span>
                            <BeastMutationTag isMutant={beast.isMutant} />
                          </span>
                          <span className="text-ink-secondary text-xs">
                            <span className="font-mono">{beast.level}</span> 级
                            {' · '}
                            {speciesName.get(beast.speciesId) ?? '灵兽'}
                          </span>
                        </span>
                      </button>
                    ))}
                  </BeastRosterScroll>
                </div>
              </aside>
              {selected ? (
                <div className="min-w-0">
                  <BeastPanel
                    key={`${selected.id}:${selected.revision}:${view.ownerLevel}`}
                    beast={selected}
                    ownerLevel={view.ownerLevel}
                    isLead={false}
                    pending={pending}
                    lineup={() => undefined}
                    withdraw={() => withdraw(selected)}
                    bagFull={bagFull}
                    act={(type) => setAction({ beastId: selected.id, type })}
                    learn={() => setLearningId(selected.id)}
                    refine={() => setRefiningId(selected.id)}
                    rejuvenate={() => setRejuvenatingId(selected.id)}
                    feed={() => setFeedingId(selected.id)}
                    rename={() => setRenamingId(selected.id)}
                    allocate={async (points) => {
                      if (busy.current) return false;
                      busy.current = true;
                      setPending(true);
                      try {
                        const result =
                          await combatV6Request<BeastManagementView>(
                            '/api/combat-v6/beasts/allocate',
                            mutationBody({
                              beastId: selected.id,
                              expectedRevision: selected.revision,
                              points,
                            }),
                          );
                        setView(result);
                        pushToast({ message: '属性已分配', tone: 'success' });
                        return true;
                      } catch (error) {
                        pushToast({
                          message:
                            error instanceof Error
                              ? error.message
                              : '灵兽操作失败',
                          tone: 'danger',
                        });
                        return false;
                      } finally {
                        busy.current = false;
                        setPending(false);
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-ink-secondary py-8 text-center text-sm">
              仓库尚空。暂不出行的灵兽，可以寄存在这里。
            </p>
          )}
        </>
      )}
      {storing && view ? (
        <InkDetailDrawer
          isOpen
          title="从灵兽袋存入"
          description="选择一只随身灵兽，寄入仓库。"
          onClose={() => {
            if (!pending) setStoring(false);
          }}
          size="md"
        >
          {carried.length ? (
            <ul className="divide-ink/10 divide-y">
              {carried.map((beast) => (
                <li
                  key={beast.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <BeastIcon
                      speciesId={beast.speciesId}
                      isMutant={beast.isMutant}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {beast.name}
                      </span>
                      <span className="text-ink-secondary text-xs">
                        <span className="font-mono">{beast.level}</span> 级
                        {view.lineup.leadBeastId === beast.id ? ' · 首发' : ''}
                      </span>
                    </span>
                  </span>
                  <InkButton disabled={pending} onClick={() => deposit(beast)}>
                    存入
                  </InkButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-secondary text-sm">
              灵兽袋尚空，没有可存入的灵兽。
            </p>
          )}
        </InkDetailDrawer>
      ) : null}
      {view?.beasts.find((beast) => beast.id === renamingId) ? (
        <BeastRenameModal
          key={renamingId}
          name={view.beasts.find((beast) => beast.id === renamingId)!.name}
          pending={pending}
          close={() => setRenamingId(undefined)}
          save={async (name) => {
            const beast = view.beasts.find((entry) => entry.id === renamingId);
            if (!beast) return false;
            try {
              const result = await combatV6Request<BeastManagementView>(
                '/api/combat-v6/beasts/rename',
                mutationBody({
                  beastId: beast.id,
                  expectedRevision: beast.revision,
                  name,
                }),
              );
              setView(result);
              setRenamingId(undefined);
              pushToast({ message: '灵兽名字已更新', tone: 'success' });
              return true;
            } catch (error) {
              pushToast({
                message:
                  error instanceof Error ? error.message : '灵兽操作失败',
                tone: 'danger',
              });
              return false;
            }
          }}
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
      {action && view?.beasts.find((beast) => beast.id === action.beastId) ? (
        <BeastActionDrawer
          key={`${action.type}:${action.beastId}`}
          beast={view.beasts.find((beast) => beast.id === action.beastId)!}
          action={action.type}
          spiritStones={view.spiritStones}
          pending={pending}
          close={() => {
            if (!busy.current) setAction(undefined);
          }}
          confirm={() => {
            const beast = view.beasts.find(
              (entry) => entry.id === action.beastId,
            );
            if (!beast) return;
            void operate(beast, action.type);
          }}
        />
      ) : null}
    </GameSceneFrame>
  );
}
