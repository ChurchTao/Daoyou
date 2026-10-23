import { BeastPickerPager } from '@app/components/feature/beasts/beastPicker';
import { useBeastPicker } from '@app/components/feature/beasts/useBeastPicker';
import { BeastTradeCard } from '@app/components/feature/beasts/BeastTradeCard';
import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { apiFetch } from '@app/lib/api/fetch';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { AuctionBeastListSchema } from '@daoyou/contracts/auction';
import type { FriendCultivatorSummary } from '@daoyou/contracts/friends';
import { AUCTION_MAX_UNIT_PRICE } from '@daoyou/game-domain/auction';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import { calculateAuctionSettlement } from '@daoyou/game-rules/auction';
import { beastAuctionBlockReason } from '@daoyou/game-rules/beasts/trade';
import { useEffect, useRef, useState } from 'react';

export function ListBeastModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const picker = useBeastPicker();
  const [selected, setSelected] = useState<SummonedBeast>();
  const [price, setPrice] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [target, setTarget] = useState('');
  const [friends, setFriends] = useState<FriendCultivatorSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(undefined);
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  useEffect(() => {
    if (visibility !== 'private') return;
    const controller = new AbortController();
    void apiFetch('/api/friends', { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? '好友读取失败');
        if (!controller.signal.aborted) setFriends(data.friends ?? []);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [visibility]);
  const beast = selected;
  const blockReason =
    beast && picker.data
      ? beastAuctionBlockReason(
          beast,
          beast.ownerCultivatorId,
          beast.revision,
          picker.data.lineup,
        )
      : null;
  const quote = calculateAuctionSettlement(Number(price) || 0, 1);
  async function submit() {
    if (pending.current || !beast || !picker.data) return;
    const reason = beastAuctionBlockReason(
      beast,
      beast.ownerCultivatorId,
      beast.revision,
      picker.data.lineup,
    );
    if (reason) {
      setError(reason);
      return;
    }
    const body = {
      beastId: beast.id,
      expectedRevision: beast.revision,
      price: Number(price),
      visibility,
      ...(visibility === 'private' ? { targetCultivatorId: target } : {}),
    };
    const key = JSON.stringify(body);
    if (attempt.current?.key !== key)
      attempt.current = { key, id: crypto.randomUUID() };
    const request = AuctionBeastListSchema.safeParse({
      ...body,
      requestId: attempt.current.id,
    });
    if (!request.success) {
      setError('请检查单价与专属道友');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await mutate<{ message: string }>(
        apiFetch('/api/auction/list-beast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.data),
        }),
      );
      pushToast({ message: result.message, tone: 'success' });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : '上架失败');
      setSelected(undefined);
      picker.reload();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <InkModal
      key={beast?.id ?? 'selection'}
      isOpen
      title="寄售灵兽"
      className="max-w-3xl"
      footer={
        !beast ? <InkButton onClick={onClose}>取消</InkButton> : undefined
      }
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <div className="space-y-4">
        {error && <InkNotice tone="warning">{error}</InkNotice>}
        {!beast ? (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p>
                {picker.data
                  ? '选择灵兽查看详情'
                  : picker.loading
                    ? '正在读取灵兽……'
                    : '灵兽读取失败'}
              </p>
              <InkButton
                disabled={busy}
                onClick={() => {
                  setError('');
                  picker.reload();
                }}
              >
                刷新
              </InkButton>
            </div>
            {picker.error ? (
              <InkNotice tone="warning">{picker.error}</InkNotice>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {(picker.data?.beasts ?? []).map((entry) => {
                const reason = picker.data
                  ? beastAuctionBlockReason(
                      entry,
                      entry.ownerCultivatorId,
                      entry.revision,
                      picker.data.lineup,
                    )
                  : null;
                return (
                  <div key={entry.id}>
                    <BeastTradeCard
                      beast={entry}
                      disabled={busy || entry.isLocked}
                      onClick={() => setSelected(entry)}
                    />
                    {reason && (
                      <p className="text-crimson mt-1 text-xs">{reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {picker.data && !picker.data.total ? (
              <InkNotice>当前没有灵兽</InkNotice>
            ) : null}
            {picker.data ? (
              <BeastPickerPager
                page={picker.data.page}
                total={picker.data.total}
                loading={picker.loading}
                onPage={picker.setPage}
              />
            ) : null}
          </>
        ) : (
          <>
            <InkButton disabled={busy} onClick={() => setSelected(undefined)}>
              重选灵兽
            </InkButton>
            <BeastTradeDetails beast={beast} />
            {blockReason && <InkNotice tone="warning">{blockReason}</InkNotice>}
          </>
        )}
        {beast && (
          <>
            <InkInput
              label="单价（灵石／只）"
              type="number"
              min={1}
              max={AUCTION_MAX_UNIT_PRICE}
              value={price}
              onChange={setPrice}
              disabled={busy}
            />
            <p className="text-ink-secondary text-xs">
              单价上限{' '}
              <SpiritStones amount={AUCTION_MAX_UNIT_PRICE} />
            </p>
            <InkSelect
              label="寄售范围"
              value={visibility}
              onChange={(v) => setVisibility(v as 'public' | 'private')}
              disabled={busy}
            >
              <option value="public">公开寄售</option>
              <option value="private">好友专属</option>
            </InkSelect>
            {visibility === 'private' && (
              <>
                <InkSelect
                  label="专属道友"
                  value={target}
                  onChange={setTarget}
                  disabled={busy}
                >
                  <option value="">选择好友</option>
                  {friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </InkSelect>
                <p className="text-ink-secondary text-xs">
                  上架消耗一张随身拍卖行贵宾符
                </p>
              </>
            )}
            <p>
              预计税费{' '}
              <SpiritStones amount={quote.feeAmount} />
              ，实得{' '}
              <SpiritStones amount={quote.sellerAmount} />。
            </p>
            <p className="text-ink-secondary text-xs">
              寄售48小时，每单一只。上架后暂离灵兽仓，成交款或退回灵兽通过邮件领取。
            </p>
            <div className="flex justify-end gap-3">
              <InkButton disabled={busy} onClick={onClose}>
                取消
              </InkButton>
              <InkButton
                variant="primary"
                disabled={busy || !!blockReason}
                pending={busy}
                onClick={() => void submit()}
              >
                确认上架
              </InkButton>
            </div>
          </>
        )}
      </div>
    </InkModal>
  );
}
