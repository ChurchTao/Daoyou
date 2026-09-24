import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  ManualMigrationResult,
  ManualMigrationView,
} from '@shared/contracts/manualMigration';
import type { ItemGrant } from '@shared/inventory';
import type { Quality } from '@shared/types/constants';
import { useCallback, useEffect, useRef, useState } from 'react';

const endpoint = '/api/manual-migration';
type Pending = ManualMigrationView['pending'][number];
function RewardList({
  grants,
  view,
}: {
  grants: ItemGrant[];
  view: ManualMigrationView;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {grants.map((g) => (
        <div key={g.definitionId} className="w-20">
          <ItemSlot
            className="w-full"
            quantityLabel="奖励"
            item={{
              ...g,
              name:
                g.instanceData?.name ??
                view.policy?.catalog.find(
                  (m) => m.definitionId === g.definitionId,
                )?.name ??
                g.definitionId,
              instanceData: g.instanceData ?? null,
            }}
          />
        </div>
      ))}
    </div>
  );
}
function MigrationPage({ ownerId }: { ownerId: string }) {
  const [view, setView] = useState<ManualMigrationView>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [result, setResult] = useState<ManualMigrationResult>();
  const [realm, setRealm] = useState('炼气');
  const [page, setPage] = useState(0);
  const alive = useRef(true);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const next = await combatV6Request<ManualMigrationView>(endpoint, {
        signal,
      });
      if (alive.current && !signal?.aborted && next.ownerId === ownerId)
        setView(next);
    },
    [ownerId],
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void refresh(controller.signal).catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [refresh]);
  const selections = Object.entries(selected)
    .filter(([, quantity]) => quantity > 0)
    .map(([definitionId, quantity]) => ({ definitionId, quantity }));
  const total = selections.reduce((n, g) => n + g.quantity, 0);
  async function submit() {
    if (!view || !confirm || total !== confirm.choices || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await consumeResourceMutation<ManualMigrationResult>(
        await fetch(
          `${endpoint}/exchange`,
          mutationBody({ productId: confirm.id, selections }),
        ),
      );
      if (!alive.current) return;
      setResult(data);
      setConfirm(null);
      setSelected({});
      await refresh();
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error &&
            !(e instanceof SyntaxError) &&
            !(e instanceof TypeError)
            ? e.message
            : '结果暂未确认，请刷新旧功法列表并核对背包或仓库后重试',
        );
        setConfirm(null);
        setSelected({});
        await refresh().catch(() => undefined);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await refresh();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const pending = view?.pending ?? [];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(pending.length / 20) - 1),
  );
  return (
    <GameSceneFrame variant="workflow">
      {error && (
        <p role="alert" className="text-crimson break-words">
          {error}
        </p>
      )}
      <p className="text-ink-secondary text-sm">
        每本旧功法一次领完全部奖励；有额外自选时，先选好玉简再兑换抽取。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span>
          待兑换 <span className="font-mono">{pending.length}</span> 本
        </span>
        <InkButton
          variant="secondary"
          disabled={busy}
          onClick={() => void reload()}
        >
          刷新核对
        </InkButton>
      </div>
      {!view ? (
        <p role="status">正在翻阅旧日功法……</p>
      ) : (
        <>
          {view.blockedReason && (
            <p role="status" className="text-ink-secondary">
              {view.blockedReason}
            </p>
          )}
          <div className="divide-ink/15 divide-y">
            {!pending.length && (
              <p className="text-ink-secondary py-6 text-sm">
                没有待兑换的旧功法。已领取的玉简可在背包或仓库查看。
              </p>
            )}
            {pending
              .slice(currentPage * 20, currentPage * 20 + 20)
              .map((source) => (
                <div
                  key={source.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold break-words">{source.name}</p>
                    <p className="text-ink-secondary text-sm">
                      {source.quality ?? '品质待核对'} · 评分{' '}
                      <span className="font-mono">{source.score}</span>
                    </p>
                    {source.problem ? (
                      <p className="text-crimson text-sm">{source.problem}</p>
                    ) : (
                      <p className="text-sm">
                        随机玉简{' '}
                        <span className="font-mono">×{source.count}</span>
                        {source.choices > 0 && (
                          <>
                            {' '}
                            · 自选{' '}
                            <span className="font-mono">×{source.choices}</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <InkButton
                    disabled={busy || !!view.blockedReason || !!source.problem}
                    onClick={() => {
                      setSelected({});
                      setRealm('炼气');
                      setConfirm(source);
                    }}
                  >
                    兑换并抽取
                  </InkButton>
                </div>
              ))}
            {pending.length > 20 && (
              <div className="flex items-center gap-3 py-3">
                <InkButton
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  上一页
                </InkButton>
                <span className="font-mono">
                  {currentPage + 1} / {Math.ceil(pending.length / 20)}
                </span>
                <InkButton
                  disabled={(currentPage + 1) * 20 >= pending.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  下一页
                </InkButton>
              </div>
            )}
          </div>
          <InkModal
            isOpen={!!confirm}
            onClose={() => {
              if (!busy) setConfirm(null);
            }}
            title="兑换旧功法"
            footer={
              <div className="flex justify-end gap-2">
                <InkButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  取消
                </InkButton>
                <InkButton
                  disabled={
                    busy ||
                    !!view.blockedReason ||
                    !confirm ||
                    total !== confirm.choices
                  }
                  onClick={() => void submit()}
                >
                  {busy ? '正在结算…' : '兑换并全部领取'}
                </InkButton>
              </div>
            }
          >
            {confirm && (
              <div className="space-y-4 text-sm">
                <p className="break-words">
                  兑换后收回旧功法「{confirm.name}」，获得随机玉简{' '}
                  <span className="font-mono">{confirm.count}</span> 本
                  {confirm.choices > 0 && (
                    <>
                      及自选玉简{' '}
                      <span className="font-mono">{confirm.choices}</span> 本
                    </>
                  )}
                  。
                </p>
                {confirm.bonusGrants.length > 0 && (
                  <div className="space-y-2">
                    <p>
                      神品额外赠送感悟果 <span className="font-mono">×1</span>
                      ，服用后增加 <span className="font-mono">50</span>{' '}
                      点道心感悟。
                    </p>
                    <RewardList grants={confirm.bonusGrants} view={view} />
                  </div>
                )}
                {view.policy?.rules[confirm.quality as Quality]?.realms.map(
                  (r, i) => (
                    <p key={r} className="flex justify-between">
                      <span>{r}玉简</span>
                      <span className="font-mono">
                        {Number(
                          (
                            view.policy!.rules[confirm.quality as Quality]
                              .weights[i] * 100
                          ).toFixed(2),
                        )}
                        %
                      </span>
                    </p>
                  ),
                )}
                <p className="text-ink-secondary">
                  每次必得玉简，境界内各功法等概率。不消耗感悟或灵气。
                </p>
                {confirm.choices > 0 && (
                  <div className="space-y-4">
                    <p>
                      请选满{' '}
                      <span className="font-mono">{confirm.choices}</span>{' '}
                      本额外玉简，可重复选择同名玉简。
                    </p>
                    <div className="flex flex-wrap gap-2" aria-label="玉简境界">
                      {['炼气', '筑基', '金丹', '元婴'].map((r) => (
                        <InkButton
                          key={r}
                          variant={realm === r ? 'primary' : 'secondary'}
                          onClick={() => setRealm(r)}
                        >
                          {r}
                        </InkButton>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {view.policy?.catalog
                        .filter((m) => m.realm === realm)
                        .map((m) => {
                          const learned = view.learned.find(
                            (l) => `jade.${l.manualId}` === m.definitionId,
                          );
                          return (
                            <div
                              key={m.definitionId}
                              className="min-w-0 space-y-2"
                            >
                              <ItemSlot
                                className="w-full"
                                item={{
                                  definitionId: m.definitionId,
                                  name: m.name,
                                  instanceData: null,
                                  quantity: 1,
                                }}
                                quantityLabel="奖励"
                              />
                              <p className="text-ink-secondary text-xs">
                                {learned
                                  ? `已学 · ${learned.level} 层`
                                  : '尚未学习'}
                              </p>
                              <label className="flex items-center gap-2 text-sm">
                                数量
                                <input
                                  aria-label={`${m.name}自选数量`}
                                  type="number"
                                  min={0}
                                  max={confirm.choices}
                                  step={1}
                                  value={selected[m.definitionId] ?? 0}
                                  disabled={busy || !!view.blockedReason}
                                  onChange={(e) =>
                                    setSelected((old) => ({
                                      ...old,
                                      [m.definitionId]: Math.max(
                                        0,
                                        Math.min(
                                          confirm.choices,
                                          Math.trunc(
                                            Number(e.target.value) || 0,
                                          ),
                                        ),
                                      ),
                                    }))
                                  }
                                  className="border-ink/20 w-16 min-w-0 border bg-transparent p-1 font-mono"
                                />
                              </label>
                            </div>
                          );
                        })}
                    </div>
                    {selections.length > 0 && (
                      <p className="text-sm break-words">
                        已选：
                        {selections
                          .map(
                            (g) =>
                              `${view.policy?.catalog.find((m) => m.definitionId === g.definitionId)?.name} ×${g.quantity}`,
                          )
                          .join('、')}
                      </p>
                    )}
                    <p
                      role="status"
                      className={total > confirm.choices ? 'text-crimson' : ''}
                    >
                      已选{' '}
                      <span className="font-mono">
                        {total} / {confirm.choices}
                      </span>{' '}
                      本
                      {total !== confirm.choices &&
                        '，选满后可一次领取全部奖励。'}
                    </p>
                  </div>
                )}
              </div>
            )}
            <p className="text-ink-secondary mt-3 text-sm">
              背包不足时进入仓库；高于当前境界的玉简可留待以后学习。
            </p>
          </InkModal>
          <InkModal
            isOpen={!!result}
            onClose={() => setResult(undefined)}
            title="传承所得"
            footer={
              <InkButton onClick={() => setResult(undefined)}>收下</InkButton>
            }
          >
            {result && (
              <div className="space-y-3">
                <p className="text-sm">随机所得</p>
                <RewardList grants={result.randomGrants} view={view} />
                {result.selectedGrants.length > 0 && (
                  <>
                    <p className="text-sm">自选所得</p>
                    <RewardList grants={result.selectedGrants} view={view} />
                  </>
                )}
                {result.bonusGrants.length > 0 && (
                  <>
                    <p className="text-sm">神品额外赠送</p>
                    <RewardList grants={result.bonusGrants} view={view} />
                  </>
                )}
                <p className="text-sm">
                  奖励已发放，背包不足的部分已存入仓库。
                </p>
              </div>
            )}
          </InkModal>
        </>
      )}
    </GameSceneFrame>
  );
}
export default function Page() {
  const identity = usePlayerSession();
  const ownerId = identity.data?.activeCultivator?.id;
  return ownerId ? (
    <MigrationPage key={ownerId} ownerId={ownerId} />
  ) : (
    <p role="status">{identity.error ?? '正在核对身份……'}</p>
  );
}
