import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  AUCTION_MAX_UNIT_PRICE,
  calculateAuctionSettlement,
} from '@shared/config/auctionConfig';
import { AuctionBeastListSchema } from '@shared/contracts/auction';
import { beastAuctionBlockReason } from '@shared/contracts/beastTrade';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import type { FriendCultivatorSummary } from '@shared/contracts/friends';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request } from '../feature/combat-v6/request';
import { ListItemModal } from './ListItemModal';

export function ListBeastModal({
  onClose,
  onSuccess,
  onSelectItems,
}: {
  onClose: () => void;
  onSuccess: () => void;
  onSelectItems: () => void;
}) {
  const [view, setView] = useState<BeastManagementView>();
  const [selected, setSelected] = useState('');
  const [price, setPrice] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [target, setTarget] = useState('');
  const [friends, setFriends] = useState<FriendCultivatorSummary[]>([]);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(undefined);
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<BeastManagementView>('/api/combat-v6/beasts', {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setView(data);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (visibility !== 'private') return;
    const controller = new AbortController();
    void fetch('/api/friends', { signal: controller.signal })
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
  const beast = view?.beasts.find((b) => b.id === selected);
  const quote = calculateAuctionSettlement(Number(price) || 0, 1);
  async function submit() {
    if (pending.current || !beast || !view) return;
    const reason = beastAuctionBlockReason(
      beast,
      beast.ownerCultivatorId,
      beast.revision,
      view.lineup,
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
        fetch('/api/auction/list-beast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.data),
        }),
      );
      pushToast({ message: result.message, tone: 'success' });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : '上架失败');
      setView(undefined);
      setRefresh((v) => v + 1);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <InkModal
      isOpen
      title="上架寄售"
      className="max-w-3xl"
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <InkButton disabled={busy} onClick={onSelectItems}>
            物品
          </InkButton>
          <InkButton variant="primary" disabled>
            灵兽
          </InkButton>
        </div>
        {error && <InkNotice tone="warning">{error}</InkNotice>}
        <InkSelect
          label="选择灵兽"
          value={selected}
          onChange={setSelected}
          disabled={busy || !view}
        >
          <option value="">
            {view ? '选择未携带的灵兽' : '正在读取灵兽……'}
          </option>
          {view?.beasts.map((b) => {
            const reason = beastAuctionBlockReason(
              b,
              b.ownerCultivatorId,
              b.revision,
              view.lineup,
            );
            return (
              <option key={b.id} value={b.id} disabled={!!reason}>
                {b.name} ·{' '}
                {BEAST_SPECIES.find((s) => s.id === b.speciesId)?.name} ·{' '}
                {b.level}级{b.isMutant ? ' · 变异' : ''}
                {reason ? ` · ${reason}` : ''}
              </option>
            );
          })}
        </InkSelect>
        <InkButton
          disabled={busy}
          onClick={() => {
            setError('');
            setView(undefined);
            setRefresh((v) => v + 1);
          }}
        >
          刷新灵兽
        </InkButton>
        {beast && <BeastTradeDetails beast={beast} />}
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
          <span className="font-mono">
            {AUCTION_MAX_UNIT_PRICE.toLocaleString()}
          </span>{' '}
          灵石
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
          <span className="font-mono">{quote.feeAmount.toLocaleString()}</span>
          ，实得{' '}
          <span className="font-mono">
            {quote.sellerAmount.toLocaleString()}
          </span>{' '}
          灵石。
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
            disabled={busy || !beast}
            pending={busy}
            onClick={() => void submit()}
          >
            确认上架
          </InkButton>
        </div>
      </div>
    </InkModal>
  );
}

export function ListAuctionModal(props: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [kind, setKind] = useState<'item' | 'beast'>('item');
  return kind === 'item' ? (
    <ListItemModal {...props} onSelectBeasts={() => setKind('beast')} />
  ) : (
    <ListBeastModal {...props} onSelectItems={() => setKind('item')} />
  );
}
