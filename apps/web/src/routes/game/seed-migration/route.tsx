import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  SeedMigrationRequest,
  SeedMigrationResult,
  SeedMigrationSource,
  SeedMigrationView,
} from '@daoyou/contracts/legacy/seeds';
import { useCallback, useEffect, useRef, useState } from 'react';

const endpoint = '/api/seed-migration';
const locationNames = { vault: '旧藏宝库', bag: '储物袋', storage: '储藏室' };

function MigrationPage({ ownerId }: { ownerId: string }) {
  const [view, setView] = useState<SeedMigrationView>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [confirm, setConfirm] = useState<SeedMigrationSource | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [result, setResult] = useState<SeedMigrationResult>();
  const [page, setPage] = useState(0);
  const lock = useRef(false);
  const alive = useRef(true);
  const attempt = useRef<SeedMigrationRequest | null>(null);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const next = await combatV6Request<SeedMigrationView>(endpoint, {
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
    void refresh(controller.signal).catch((cause) => {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : '清点失败');
    });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [refresh]);

  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await refresh();
    } catch (cause) {
      if (alive.current)
        setError(cause instanceof Error ? cause.message : '清点失败');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function perform(input: SeedMigrationRequest) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(
        `${endpoint}/exchange`,
        mutationBody(input),
      );
      if (response.status >= 400 && response.status < 500)
        attempt.current = null;
      const data = await consumeResourceMutation<SeedMigrationResult>(response);
      attempt.current = null;
      if (!alive.current) return;
      setNeedsRetry(false);
      setResult(data);
      setConfirm(null);
      await refresh();
    } catch (cause) {
      if (alive.current) {
        setNeedsRetry(Boolean(attempt.current));
        setError(cause instanceof Error ? cause.message : '转化结果尚未确认');
        if (!attempt.current) setConfirm(null);
        await refresh().catch(() => undefined);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const amount = Number(quantity);
  const maxQuantity = Math.min(999, confirm?.quantity ?? 0);
  const validQuantity =
    Number.isInteger(amount) && amount >= 1 && amount <= maxQuantity;
  function submit() {
    if (
      !confirm ||
      !validQuantity ||
      view?.blockedReason ||
      attempt.current ||
      lock.current
    )
      return;
    const input: SeedMigrationRequest = {
      requestId: crypto.randomUUID(),
      source: confirm.source,
      id: confirm.id,
      quantity: amount,
      expectedQuantity: confirm.quantity,
      ...(confirm.source === 'inventory' ? { revision: confirm.revision } : {}),
    };
    attempt.current = input;
    void perform(input);
  }

  const pending = view?.pending ?? [];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(pending.length / 20) - 1),
  );
  const locked = busy || needsRetry;
  return (
    <GameSceneFrame variant="workflow">
      <p className="text-ink-secondary text-sm leading-7">
        旧灵种无法继续播种。每枚可转化为同品质的新种子，四种物种等概率抽取。
      </p>
      {error ? (
        <p role="alert" className="text-crimson break-words">
          {error}
        </p>
      ) : null}
      {needsRetry ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>上次转化结果尚未确认，请原样重试。重试不会重复消耗或重新抽取。</p>
          <InkButton
            disabled={busy}
            onClick={() => {
              if (attempt.current) void perform(attempt.current);
            }}
          >
            确认上次转化
          </InkButton>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span>
          待转化 <span className="font-mono">{pending.length}</span> 组
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
        <p role="status">正在清点旧日灵种……</p>
      ) : (
        <>
          {view.blockedReason ? (
            <p role="status" className="text-ink-secondary">
              {view.blockedReason}
            </p>
          ) : null}
          <div className="divide-ink/15 divide-y">
            {!pending.length ? (
              <p className="text-ink-secondary py-6 text-sm">
                没有待转化的旧灵种。新种子可在百草集购买。
              </p>
            ) : null}
            {pending
              .slice(currentPage * 20, currentPage * 20 + 20)
              .map((source) => (
                <div
                  key={`${source.source}:${source.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold break-words">
                      {source.name}{' '}
                      <span className="font-mono">×{source.quantity}</span>
                    </p>
                    <p className="text-ink-secondary text-sm">
                      {source.quality} · {locationNames[source.location]}
                    </p>
                    {source.problem ? (
                      <p className="text-crimson text-sm">{source.problem}</p>
                    ) : null}
                  </div>
                  <InkButton
                    disabled={
                      locked || !!view.blockedReason || !!source.problem
                    }
                    onClick={() => {
                      setQuantity('1');
                      setConfirm(source);
                    }}
                  >
                    转化种子
                  </InkButton>
                </div>
              ))}
          </div>
          {pending.length > 20 ? (
            <div className="flex items-center gap-3 py-3">
              <InkButton
                disabled={locked || currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                上一页
              </InkButton>
              <span className="font-mono">
                {currentPage + 1} / {Math.ceil(pending.length / 20)}
              </span>
              <InkButton
                disabled={locked || (currentPage + 1) * 20 >= pending.length}
                onClick={() => setPage(currentPage + 1)}
              >
                下一页
              </InkButton>
            </div>
          ) : null}
        </>
      )}
      <InkModal
        isOpen={!!confirm}
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        title="转化旧灵种"
        footer={
          <div className="flex justify-end gap-2">
            <InkButton
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              {needsRetry ? '返回清单' : '取消'}
            </InkButton>
            <InkButton
              disabled={
                busy ||
                (!needsRetry && (!!view?.blockedReason || !validQuantity))
              }
              onClick={() => {
                if (needsRetry && attempt.current)
                  void perform(attempt.current);
                else submit();
              }}
            >
              {busy ? '正在转化…' : needsRetry ? '确认上次转化' : '确认转化'}
            </InkButton>
          </div>
        }
      >
        {confirm ? (
          <div className="space-y-4 text-sm leading-7">
            {needsRetry ? (
              <p role="alert" className="text-crimson">
                {error}。请原样重试确认，不会重复消耗或重新抽取。
              </p>
            ) : null}
            <p className="break-words">
              消耗「{confirm.name}」，等量获得{confirm.quality}新种子。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="seed-migration-quantity">转化数量</label>
              <input
                id="seed-migration-quantity"
                type="number"
                min={1}
                max={maxQuantity}
                step={1}
                value={quantity}
                disabled={locked}
                onChange={(event) => setQuantity(event.target.value)}
                className="border-ink/20 w-24 border-b bg-transparent p-2 font-mono text-base"
              />
              <InkButton
                variant="secondary"
                disabled={locked}
                onClick={() => setQuantity(String(maxQuantity))}
              >
                本次最多
              </InkButton>
            </div>
            {!validQuantity ? (
              <p className="text-crimson">
                请输入 <span className="font-mono">1–{maxQuantity}</span>{' '}
                的整数。
              </p>
            ) : null}
            <p className="text-ink-secondary">
              每枚独立等概率抽取同品质的四种灵植，可能重复。不消耗灵石或天地灵气；新种子发入储物袋，放不下的部分进入储藏室。
            </p>
            <p className="text-ink-secondary">
              旧灵种的成长时间、习性与用途不会继承。转化完成后，旧灵种将被消耗。
            </p>
          </div>
        ) : null}
      </InkModal>
      <InkModal
        isOpen={!!result}
        onClose={() => setResult(undefined)}
        title="转化所得"
        footer={
          <InkButton onClick={() => setResult(undefined)}>收下</InkButton>
        }
      >
        {result ? (
          <div className="space-y-4 text-sm leading-7">
            <ul className="space-y-3">
              {result.seeds.map((seed) => (
                <li
                  key={seed.speciesId}
                  className="flex items-start justify-between gap-3"
                >
                  <span className={`${tierColorMap[seed.quality]} break-words`}>
                    {seed.name}
                  </span>
                  <span className="shrink-0 font-mono">×{seed.quantity}</span>
                </li>
              ))}
            </ul>
            <p className="text-ink-secondary">
              已送至
              {result.locations
                .map((location) => locationNames[location])
                .join('、')}
              。
            </p>
          </div>
        ) : null}
      </InkModal>
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
