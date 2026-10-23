import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastRosterEntry } from '@app/components/feature/beasts/BeastRosterEntry';
import { BeastPickerPager } from '@app/components/feature/beasts/beastPicker';
import { useBeastPicker } from '@app/components/feature/beasts/useBeastPicker';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type { BeastManagementView } from '@daoyou/contracts/beasts';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import {
  BEAST_BAG_CAPACITY,
  BEAST_WAREHOUSE_CAPACITY,
} from '@daoyou/game-rules/beasts/growth';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BeastActionDrawer, type BeastAction } from '../BeastActionDrawer';
import { BeastBookDrawer } from '../BeastBookDrawer';
import { BeastPanel } from '../BeastPanel';
import { BeastRenameModal } from '../BeastRenameModal';
import { BeastRosterScroll } from '../BeastRosterScroll';
import { FusionWorkspace } from '../fusion/FusionWorkspace';

export default function BeastWarehousePage() {
  const { openDialog, pushToast } = useInkUI();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ownerId = useCultivatorIdentity().data?.cultivator?.id;
  const list = useBeastPicker({
    location: 'warehouse',
    initialBeastId: searchParams.get('beast') ?? undefined,
  });
  const [override, setOverride] = useState<SummonedBeast>();
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => searchParams.get('beast') ?? undefined,
  );
  const [fusion, setFusion] = useState<{
    nonce: number;
    beastId?: string;
  } | null>(null);
  const [storing, setStoring] = useState(false);
  const bag = useBeastPicker({ active: storing, location: 'bag' });
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
  function openFusion(beastId?: string) {
    if (!ownerId) return;
    setFusion((current) => ({
      nonce: (current?.nonce ?? 0) + 1,
      beastId,
    }));
  }
  const reloadList = useRef(list.reload);
  useEffect(() => {
    reloadList.current = list.reload;
  }, [list.reload]);
  useEffect(() => {
    const reload = () => {
      if (!busy.current) reloadList.current();
    };
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, []);

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
      await combatV6Request<BeastManagementView>(
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
        setOverride(undefined);
        setSelectedId(location === 'warehouse' ? beast.id : undefined);
        if (location === 'warehouse') list.focus(beast.id);
        else list.reload();
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

  const stored = list.data?.beasts ?? [];
  const fromPage = stored.find((beast) => beast.id === selectedId) ?? stored[0];
  const selected =
    override &&
    fromPage &&
    override.id === fromPage.id &&
    override.revision >= fromPage.revision
      ? override
      : fromPage;
  const bagFull = (list.data?.bagCount ?? 0) >= BEAST_BAG_CAPACITY;
  const warehouseCount = list.data?.warehouseCount ?? 0;
  function remember(beast: SummonedBeast) {
    setOverride(beast);
    setSelectedId(beast.id);
    list.reload();
  }

  async function operate(
    beast: SummonedBeast,
    action: BeastAction | 'lock' | 'unlock',
  ) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const path = action === 'unlock' ? 'lock' : action;
      const result = await combatV6Request<BeastManagementView>(
        `/api/combat-v6/beasts/${path}`,
        mutationBody({
          beastId: beast.id,
          expectedRevision: beast.revision,
          ...(path === 'lock' ? { isLocked: action === 'lock' } : {}),
        }),
      );
      const next = result.beasts.find((entry) => entry.id === beast.id);
      if (path === 'release') {
        setOverride(undefined);
        setSelectedId(undefined);
      } else if (next) remember(next);
      else list.reload();
      setAction(undefined);
      pushToast({
        message:
          action === 'lock'
            ? '灵兽已锁定'
            : action === 'unlock'
              ? '灵兽已解锁'
              : path === 'rest'
                ? '休养完成'
                : '灵兽已放生',
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
        bag.data?.lineup.leadBeastId === beast.id
          ? '已存入灵兽仓库，并取消首发'
          : '已存入灵兽仓库',
      );
    if (bag.data?.lineup.leadBeastId === beast.id) {
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
      {!list.data ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm">
            {list.error ? '灵兽仓库读取失败' : '正在查看灵兽仓库……'}
          </p>
          {list.error ? (
            <InkButton onClick={() => list.reload()}>重新加载</InkButton>
          ) : null}
        </div>
      ) : fusion && ownerId ? (
        <FusionWorkspace
          key={fusion.nonce}
          ownerId={ownerId}
          ownerLevel={list.data.ownerLevel}
          lineup={list.data.lineup}
          initialBeast={
            selected?.id === fusion.beastId
              ? selected
              : stored.find((beast) => beast.id === fusion.beastId)
          }
          closeLabel="返回"
          onClose={() => setFusion(null)}
          onRoster={() => list.reload()}
          onViewResult={(beast, inBag) => {
            setFusion(null);
            if (inBag) navigate(`/game/beasts?beast=${beast.id}`);
            else {
              setSelectedId(beast.id);
              list.focus(beast.id);
            }
          }}
        />
      ) : (
        <>
          <div className="text-ink-secondary flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <InkButton
                href="/game/beasts"
                variant="secondary"
                disabled={pending}
              >
                返回灵兽袋
              </InkButton>
              <span>
                仓库{' '}
                <span className="font-mono">
                  {warehouseCount} / {BEAST_WAREHOUSE_CAPACITY}
                </span>
              </span>
            </div>
            <span className="flex flex-wrap items-center gap-1">
              <InkButton
                disabled={pending || !ownerId}
                onClick={() => openFusion(selected?.id)}
              >
                融合
              </InkButton>
              <InkButton
                disabled={pending || warehouseCount >= BEAST_WAREHOUSE_CAPACITY}
                onClick={() => setStoring(true)}
              >
                从灵兽袋存入
              </InkButton>
            </span>
          </div>
          {warehouseCount ? (
            <div className="grid min-w-0 gap-5 md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
              <aside className="border-ink/15 min-w-0 border-b pb-4 md:relative md:min-h-60 md:border-r md:border-b-0 md:pb-0">
                <div className="md:absolute md:inset-0 md:flex md:min-h-0 md:flex-col md:pr-4">
                  <BeastRosterScroll>
                    {stored.map((beast) => (
                      <BeastRosterEntry
                        key={beast.id}
                        beast={beast}
                        selected={selected?.id === beast.id}
                        onSelect={() => {
                          setOverride(undefined);
                          setSelectedId(beast.id);
                        }}
                      />
                    ))}
                  </BeastRosterScroll>
                  <BeastPickerPager
                    page={list.data.page}
                    total={list.data.total}
                    loading={list.loading}
                    onPage={list.setPage}
                  />
                </div>
              </aside>
              {selected ? (
                <div className="min-w-0">
                  <BeastPanel
                    key={`${selected.id}:${selected.revision}:${list.data.ownerLevel}`}
                    beast={selected}
                    ownerLevel={list.data.ownerLevel}
                    isLead={false}
                    pending={pending}
                    lineup={() => undefined}
                    withdraw={() => withdraw(selected)}
                    bagFull={bagFull}
                    fuse={() => openFusion(selected.id)}
                    act={(type) => setAction({ beastId: selected.id, type })}
                    setLocked={(isLocked) => {
                      void operate(selected, isLocked ? 'lock' : 'unlock');
                    }}
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
                        const next = result.beasts.find(
                          (entry) => entry.id === selected.id,
                        );
                        if (next) remember(next);
                        else list.reload();
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
      {storing ? (
        <InkDetailDrawer
          isOpen
          title="从灵兽袋存入"
          description="选择一只随身灵兽，寄入仓库。"
          onClose={() => {
            if (!pending) setStoring(false);
          }}
          size="md"
        >
          {bag.data?.beasts.length ? (
            <ul className="divide-ink/10 divide-y">
              {bag.data.beasts.map((beast) => (
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
                        {bag.data?.lineup.leadBeastId === beast.id
                          ? ' · 首发'
                          : ''}
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
              {bag.loading
                ? '正在读取灵兽袋……'
                : '灵兽袋尚空，没有可存入的灵兽。'}
            </p>
          )}
        </InkDetailDrawer>
      ) : null}
      {selected && renamingId === selected.id ? (
        <BeastRenameModal
          key={renamingId}
          name={selected.name}
          pending={pending}
          close={() => setRenamingId(undefined)}
          save={async (name) => {
            try {
              const result = await combatV6Request<BeastManagementView>(
                '/api/combat-v6/beasts/rename',
                mutationBody({
                  beastId: selected.id,
                  expectedRevision: selected.revision,
                  name,
                }),
              );
              const next = result.beasts.find(
                (entry) => entry.id === selected.id,
              );
              if (next) remember(next);
              else list.reload();
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
          onUpdate={remember}
        />
      ) : null}
      {refiningId ? (
        <BeastBookDrawer
          beastId={refiningId}
          mode="refine"
          close={() => setRefiningId(undefined)}
          onUpdate={remember}
        />
      ) : null}
      {rejuvenatingId ? (
        <BeastBookDrawer
          beastId={rejuvenatingId}
          mode="rejuvenate"
          close={() => setRejuvenatingId(undefined)}
          onUpdate={remember}
        />
      ) : null}
      {learningId ? (
        <BeastBookDrawer
          beastId={learningId}
          close={() => setLearningId(undefined)}
          onUpdate={remember}
        />
      ) : null}
      {action && selected && action.beastId === selected.id && list.data ? (
        <BeastActionDrawer
          key={`${action.type}:${action.beastId}`}
          beast={selected}
          action={action.type}
          spiritStones={list.data.spiritStones}
          pending={pending}
          close={() => {
            if (!busy.current) setAction(undefined);
          }}
          confirm={() => {
            void operate(selected, action.type);
          }}
        />
      ) : null}
    </GameSceneFrame>
  );
}
