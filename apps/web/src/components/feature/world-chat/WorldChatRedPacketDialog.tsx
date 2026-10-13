import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorCurrency } from '@app/lib/resources/player';
import type {
  RedPacketDetail,
  RedPacketSummary,
} from '@daoyou/contracts/world-chat';
import { useEffect, useRef, useState } from 'react';
import { useWorldChatFeedModel } from './useWorldChatFeedModel';

const amountFormat = new Intl.NumberFormat('zh-CN');
const packetPath = '/api/world-chat/red-packets';

async function readPacketData<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await apiFetch(path, { cache: 'no-store', signal });
  const result = await response.json();
  if (!response.ok || !result.success)
    throw new Error(result.error || '暂时无法读取红包');
  return result.data as T;
}

async function mutatePacket<T>(path: string): Promise<T> {
  return consumeResourceMutation<T>(
    await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
}

function failure(cause: unknown): string {
  return cause instanceof Error ? cause.message : '暂时未能完成，请重试';
}

export function WorldChatGiveRedPacketDialog({
  onClose,
  onSent,
}: {
  onClose(): void;
  onSent(): void;
}) {
  const feed = useWorldChatFeedModel();
  const currency = useCultivatorCurrency();
  const resumed = feed.pendingRedPacket;
  const [amount, setAmount] = useState(() => String(resumed?.amount ?? 50_000));
  const [count, setCount] = useState(() => String(resumed?.count ?? 10));
  const [mode, setMode] = useState<'random' | 'equal'>(
    () => resumed?.mode ?? 'random',
  );
  const [greeting, setGreeting] = useState(
    () => resumed?.greeting ?? '仙途同庆，见者有份',
  );
  const [pending, setPending] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const amountValue = Number(amount);
  const countValue = Number(count);
  const balance = currency.data?.spiritStones;
  const error =
    !Number.isInteger(amountValue) ||
    amountValue < 50_000 ||
    amountValue > 10_000_000
      ? '总金额需为 50,000–10,000,000 的整数'
      : !Number.isInteger(countValue) || countValue < 1 || countValue > 100
        ? '份数需为 1–100 的整数'
        : mode === 'equal' && amountValue % countValue !== 0
          ? '等额红包总金额需能整除份数'
          : !resumed && balance !== undefined && amountValue > balance
            ? '灵石余额不足'
            : null;

  async function submit() {
    if (error || pending || feed.posting || (!resumed && balance === undefined))
      return;
    setPending(true);
    try {
      const sent = await feed.sendRedPacket(
        resumed ?? {
          amount: amountValue,
          count: countValue,
          mode,
          greeting: greeting.trim() || '仙途同庆，见者有份',
          clientMessageId: requestId.current,
        },
      );
      if (sent) {
        onSent();
        onClose();
      } else requestId.current = crypto.randomUUID();
    } finally {
      setPending(false);
    }
  }

  return (
    <InkDetailDrawer
      isOpen
      title="发灵石红包"
      size="sm"
      onClose={() => {
        if (!pending) onClose();
      }}
      closeOnEscape={!pending}
      closeOnOverlayClick={!pending}
      footer={
        <InkButton
          variant="primary"
          className="min-h-11"
          onClick={() => void submit()}
          pending={pending}
          pendingLabel="正在确认扣款……"
          disabled={
            !!error ||
            (!resumed && balance === undefined) ||
            feed.posting ||
            (!resumed && feed.cooldownRemaining > 0)
          }
        >
          {resumed
            ? '确认之前的红包'
            : feed.cooldownRemaining > 0
              ? `${feed.cooldownRemaining} 秒后可发送`
              : `确认发出 ${amountFormat.format(amountValue || 0)} 灵石`}
        </InkButton>
      }
    >
      <div className="space-y-4">
        {feed.redPacketOutcome === 'unknown' ? (
          <InkNotice tone="warning">
            上次发送结果尚未确认。保留原金额与份数，重试同一笔红包不会重复扣款。
          </InkNotice>
        ) : null}
        <p className="text-ink-secondary text-sm">
          发送到{feed.activeChannel === 'sect' ? '宗门频道' : '世界频道'} ·
          可用灵石{' '}
          <span className="font-mono">
            {balance === undefined ? '读取中' : amountFormat.format(balance)}
          </span>
        </p>
        <InkInput
          label="总金额 · 灵石"
          type="number"
          min={50_000}
          max={10_000_000}
          value={amount}
          onChange={setAmount}
          hint="单个红包总额至少 50,000 灵石"
          disabled={pending || !!resumed}
        />
        <div className="flex gap-3">
          {[50_000, 100_000, 500_000].map((value) => (
            <InkButton
              key={value}
              disabled={pending || !!resumed}
              onClick={() => setAmount(String(value))}
            >
              {value / 10_000} 万
            </InkButton>
          ))}
        </div>
        <InkInput
          label="红包数量"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={setCount}
          disabled={pending || !!resumed}
        />
        <fieldset disabled={pending || !!resumed}>
          <legend className="mb-2 font-semibold">分配方式</legend>
          <div className="flex gap-4">
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="red-packet-mode"
                checked={mode === 'random'}
                onChange={() => setMode('random')}
              />
              拼手气
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="red-packet-mode"
                checked={mode === 'equal'}
                onChange={() => setMode('equal')}
              />
              等额
            </label>
          </div>
        </fieldset>
        <InkInput
          label="祝福语"
          value={greeting}
          onChange={(value) =>
            setGreeting(Array.from(value).slice(0, 24).join(''))
          }
          disabled={pending || !!resumed}
          hint={`${Array.from(greeting).length}/24`}
        />
        {error ? (
          <InkNotice tone="warning">{error}</InkNotice>
        ) : (
          <p className="text-sm">
            {mode === 'equal' ? (
              <>
                每份{' '}
                <span className="font-mono">
                  {amountFormat.format(amountValue / countValue)}
                </span>{' '}
                灵石
              </>
            ) : (
              <>
                共{' '}
                <span className="font-mono">
                  {amountFormat.format(amountValue)}
                </span>{' '}
                灵石，随机分为 <span className="font-mono">{countValue}</span>{' '}
                份
              </>
            )}
          </p>
        )}
        <p className="text-ink-secondary text-sm leading-6">
          24
          小时未领完，余款退回。余额无法容纳或出资角色已退场时，余款保留在待退款中。
        </p>
      </div>
    </InkDetailDrawer>
  );
}

export function WorldChatRedPacketDialog({
  packetId,
  onClose,
  onClaimed,
}: {
  packetId: string;
  onClose(): void;
  onClaimed(packetId: string): void;
}) {
  const { refreshRedPacket } = useWorldChatFeedModel();
  const [detail, setDetail] = useState<RedPacketDetail>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const onClaimedRef = useRef(onClaimed);
  useEffect(() => {
    onClaimedRef.current = onClaimed;
  }, [onClaimed]);
  useEffect(() => {
    const abort = new AbortController();
    void readPacketData<RedPacketDetail>(
      `${packetPath}/${packetId}`,
      abort.signal,
    )
      .then((data) => {
        if (!abort.signal.aborted) {
          setDetail(data);
          setError('');
          refreshRedPacket(data.packet);
          if (data.myClaim) onClaimedRef.current(packetId);
        }
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) setError(failure(cause));
      });
    return () => abort.abort();
  }, [packetId, revision, refreshRedPacket]);
  useEffect(() => {
    if (!detail) return;
    const delay = new Date(detail.packet.expiresAt).getTime() - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(delay + 1, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [detail]);

  async function act(refund: boolean) {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const result = await mutatePacket<{ packet: RedPacketSummary }>(
        `${packetPath}/${packetId}/${refund ? 'refund' : 'claim'}`,
      );
      refreshRedPacket(result.packet);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(failure(cause));
      setRevision((value) => value + 1);
    } finally {
      setPending(false);
    }
  }

  const canClaim =
    detail &&
    !detail.isSender &&
    !detail.myClaim &&
    detail.packet.status === 'open' &&
    new Date(detail.packet.expiresAt).getTime() > now;
  const canRefund =
    detail?.isSender && detail.packet.refundStatus === 'pending';
  const expired =
    detail &&
    (detail.packet.status === 'expired' ||
      new Date(detail.packet.expiresAt).getTime() <= now);
  return (
    <InkDetailDrawer
      isOpen
      size="sm"
      title="灵石红包"
      onClose={onClose}
      footer={
        canClaim ? (
          <InkButton
            variant="primary"
            className="min-h-11"
            pending={pending}
            onClick={() => void act(false)}
          >
            开启红包
          </InkButton>
        ) : canRefund ? (
          <InkButton
            variant="primary"
            className="min-h-11"
            pending={pending}
            onClick={() => void act(true)}
          >
            领取待退款
          </InkButton>
        ) : undefined
      }
    >
      {error ? (
        <InkNotice tone="warning">
          {error}{' '}
          <InkButton onClick={() => setRevision((value) => value + 1)}>
            重试
          </InkButton>
        </InkNotice>
      ) : null}
      {!detail ? (
        <p className="text-ink-secondary py-6">正在读取红包……</p>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2 py-4 text-center">
            <GameIcon value="🧧" className="text-4xl" />
            <p className="text-lg">{detail.packet.greeting}</p>
            <p className="text-ink-secondary text-sm">
              {detail.packet.mode === 'equal' ? '等额' : '拼手气'} ·{' '}
              <span className="font-mono">{detail.packet.count}</span> 份
            </p>
            {detail.myClaim ? (
              <div className="py-3">
                <p className="text-crimson font-mono text-3xl">
                  {amountFormat.format(detail.myClaim.amount)}
                </p>
                <p className="text-ink-secondary text-sm">灵石已到账</p>
              </div>
            ) : null}
            {detail.packet.status === 'exhausted' ? (
              <p className="text-ink-secondary">已领完</p>
            ) : expired ? (
              <p className="text-ink-secondary">
                已过期
                {detail.packet.refundStatus === 'refunded'
                  ? ' · 余款已退回'
                  : ''}
              </p>
            ) : detail.isSender ? (
              <p className="text-ink-secondary">你发出的红包</p>
            ) : null}
            {canRefund ? (
              <p className="text-sm">
                待退款{' '}
                <span className="font-mono">
                  {amountFormat.format(detail.packet.refundAmount)}
                </span>{' '}
                灵石，将退回当前活跃角色。
              </p>
            ) : null}
          </div>
          <p className="text-ink-secondary text-sm">
            已领{' '}
            <span className="font-mono">
              {detail.packet.count - detail.packet.remainingCount}/
              {detail.packet.count}
            </span>{' '}
            份 · 共{' '}
            <span className="font-mono">
              {amountFormat.format(detail.packet.amount)}
            </span>{' '}
            灵石
          </p>
          <div className="divide-ink/10 divide-y">
            {detail.claims.map((claim, index) => (
              <div
                key={`${claim.claimedAt}:${index}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p>{claim.senderName}</p>
                  <p className="text-ink-secondary font-mono text-xs">
                    {new Date(claim.claimedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <span className="shrink-0 font-mono">
                  {amountFormat.format(claim.amount)}
                </span>
              </div>
            ))}
            {!detail.claims.length ? (
              <p className="text-ink-secondary py-3 text-sm">尚无道友领取</p>
            ) : null}
          </div>
        </div>
      )}
    </InkDetailDrawer>
  );
}

export function WorldChatRefundsDialog({ onClose }: { onClose(): void }) {
  const { refreshRedPacket } = useWorldChatFeedModel();
  const [packets, setPackets] = useState<RedPacketSummary[]>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void readPacketData<RedPacketSummary[]>(
      `${packetPath}/refunds`,
      abort.signal,
    )
      .then((data) => {
        if (!abort.signal.aborted) {
          setPackets(data);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) setError(failure(cause));
      });
    return () => abort.abort();
  }, [revision]);
  async function refund(id: string) {
    if (pending) return;
    setPending(id);
    setError('');
    try {
      const result = await mutatePacket<{ packet: RedPacketSummary }>(
        `${packetPath}/${id}/refund`,
      );
      refreshRedPacket(result.packet);
      setPackets((current) => current?.filter((packet) => packet.id !== id));
    } catch (cause) {
      setError(failure(cause));
    } finally {
      setPending(null);
    }
  }
  return (
    <InkDetailDrawer
      isOpen
      size="sm"
      title="红包待退款"
      onClose={onClose}
      description="未退回的余款保留在账号中，可领取到当前活跃角色。"
    >
      {error ? (
        <InkNotice tone="warning">
          {error}{' '}
          <InkButton onClick={() => setRevision((value) => value + 1)}>
            重试
          </InkButton>
        </InkNotice>
      ) : null}
      {!packets ? (
        <p className="text-ink-secondary">正在读取待退款……</p>
      ) : packets.length ? (
        <div className="divide-ink/10 divide-y">
          {packets.map((packet) => (
            <div key={packet.id} className="py-4">
              <p>{packet.greeting}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-mono">
                  {amountFormat.format(packet.refundAmount)} 灵石
                </span>
                <InkButton
                  variant="primary"
                  disabled={!!pending && pending !== packet.id}
                  pending={pending === packet.id}
                  onClick={() => void refund(packet.id)}
                >
                  领取退款
                </InkButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-secondary">暂无待退款</p>
      )}
    </InkDetailDrawer>
  );
}
