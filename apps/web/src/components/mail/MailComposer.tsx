import { apiFetch } from '@app/lib/api/fetch';
import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkButton,
  InkInput,
  InkNotice,
  InkQuantityInput,
  InkSelect,
} from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type { FriendCultivatorSummary } from '@daoyou/contracts/friends';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { mailGiftBlockReason } from '@daoyou/game-rules/mail';
import {
  hasReachedLateQiRefining,
  LATE_QI_FRIEND_GIFT_DENIED,
} from '@daoyou/game-rules/progression/realm-access';
import { SendMailSchema } from '@daoyou/contracts/mail';
import { useRef, useState } from 'react';

export function MailComposer({
  friends,
  recipientId,
  onRecipientChange,
  onClose,
}: {
  friends: FriendCultivatorSummary[];
  recipientId: string;
  onRecipientChange: (id: string) => void;
  onClose: () => void;
}) {
  const profile = useCultivatorIdentity();
  const identity = profile.data?.cultivator;
  const giftOpen = identity
    ? hasReachedLateQiRefining(identity.realm, identity.realm_stage)
    : false;
  const bagQuery = useInventoryBag(giftOpen);
  const bag = bagQuery.data;
  const bagUnavailable =
    giftOpen && (!bag || bagQuery.isRefreshing || !!bagQuery.error);
  const error = bagQuery.error;
  const [content, setContent] = useState('');
  const [selectedRef, setSelected] = useState<InventoryView['items'][number]>();
  const selected = bag?.items.find(
    (item) =>
      item.id === selectedRef?.id && item.revision === selectedRef.revision,
  );
  const [quantity, setQuantity] = useState('1');
  const [bagOpen, setBagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(undefined);
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const refresh = bagQuery.reload;
  function choose(item: InventoryView['items'][number]) {
    if (pending.current || bagUnavailable) return;
    const reason = mailGiftBlockReason(item);
    if (reason) {
      pushToast({ message: reason, tone: 'warning' });
      return;
    }
    setSelected(item);
    setQuantity('1');
    setBagOpen(false);
  }
  async function send() {
    if (pending.current || bagUnavailable || (giftOpen && selectedRef && !selected))
      return;
    if (selected && !giftOpen) {
      pushToast({ message: LATE_QI_FRIEND_GIFT_DENIED, tone: 'warning' });
      return;
    }
    const body = {
      recipientCultivatorId: recipientId,
      content: content.trim(),
      attachment:
        giftOpen && selected
          ? {
              itemId: selected.id,
              revision: selected.revision,
              quantity: Number(quantity),
            }
          : undefined,
    };
    const key = JSON.stringify(body);
    if (attempt.current?.key !== key)
      attempt.current = { key, id: crypto.randomUUID() };
    const parsed = SendMailSchema.safeParse({
      ...body,
      requestId: attempt.current.id,
    });
    if (!parsed.success || (selected && Number(quantity) > selected.quantity)) {
      pushToast({ message: '请检查收信道友、正文与附件数量', tone: 'warning' });
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await mutate(
        apiFetch('/api/cultivator/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        }),
      );
      pushToast({ message: '传音已发出', tone: 'success' });
      onClose();
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '发送失败',
        tone: 'danger',
      });
      await refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const inventory = (
    <div className="space-y-3">
      <InventoryHeader
        capacity={<> {bag?.used ?? '—'} / 40</>}
        actions={
          <InkButton
            disabled={busy || bagQuery.isRefreshing}
            onClick={() => void refresh()}
          >
            刷新
          </InkButton>
        }
      />
      {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
      <InventoryItems
        items={bag?.items ?? []}
        slotProps={(item) => ({
          disabled: !item || busy || bagUnavailable,
          selected: !!item && item.id === selected?.id,
          badge: item && !mailGiftBlockReason(item) ? '可选' : undefined,
          onQuickAction:
            item && !mailGiftBlockReason(item) ? () => choose(item) : undefined,
          children: item
            ? (close) => (
                <>
                  <p className="text-ink-secondary">
                    {mailGiftBlockReason(item)}
                  </p>
                  <InkButton
                    disabled={
                      busy || bagUnavailable || !!mailGiftBlockReason(item)
                    }
                    onClick={() => {
                      choose(item);
                      close();
                    }}
                  >
                    附带
                  </InkButton>
                </>
              )
            : undefined,
        })}
      />
    </div>
  );
  return (
    <InkModal
      isOpen
      onClose={() => {
        if (!pending.current) {
          if (bagOpen) setBagOpen(false);
          else onClose();
        }
      }}
      title="发送传音"
      className={giftOpen ? 'max-w-5xl' : 'max-w-xl'}
    >
      <div
        className={giftOpen ? 'grid min-w-0 gap-6 lg:grid-cols-2' : 'min-w-0'}
      >
        <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
          <InkSelect
            label="收信道友"
            value={recipientId}
            onChange={onRecipientChange}
            disabled={busy || !friends.length}
          >
            <option value="">选择好友</option>
            {friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.realm}
                {f.realmStage}
              </option>
            ))}
          </InkSelect>
          <InkInput
            label="传音内容"
            value={content}
            onChange={setContent}
            multiline
            rows={5}
            disabled={busy}
          />
          {!identity ? (
            profile.loading ? (
              <p className="text-ink-secondary text-sm">正在确认境界……</p>
            ) : (
              <InkNotice tone="warning">
                {profile.error || '角色信息读取失败，暂不能附带物品'}
              </InkNotice>
            )
          ) : giftOpen ? (
            <>
              <div className="flex items-center gap-4">
                <div className="w-20 shrink-0">
                  <ItemSlot
                    className="w-full"
                    item={selected}
                    emptyLabel="选择附件"
                    disabled={busy}
                    onQuickAction={() => setBagOpen(true)}
                  >
                    {(close) => (
                      <InkButton
                        disabled={busy || bagUnavailable}
                        onClick={() => {
                          setSelected(undefined);
                          close();
                        }}
                      >
                        移出
                      </InkButton>
                    )}
                  </ItemSlot>
                </div>
                {selected ? (
                  <InkQuantityInput
                    label="数量"
                    max={selected.quantity}
                    value={quantity}
                    onChange={setQuantity}
                    disabled={busy || bagUnavailable}
                  />
                ) : (
                  <span className="text-ink-secondary text-sm">
                    可附带一叠随身物品
                  </span>
                )}
              </div>
              {selectedRef && (
                <InkButton
                  disabled={busy || bagUnavailable}
                  onClick={() => setSelected(undefined)}
                >
                  移出附件
                </InkButton>
              )}
              {selectedRef && !selected ? (
                <p role="alert">附件已变化，请重新选择或移出附件。</p>
              ) : null}
            </>
          ) : (
            <p className="text-ink-secondary text-sm">
              {LATE_QI_FRIEND_GIFT_DENIED}
            </p>
          )}
          <p className="text-ink-secondary text-xs">发送消耗一张空白传音符</p>
          <div className="flex justify-end gap-3">
            <InkButton disabled={busy} onClick={onClose}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={busy}
              disabled={
                !friends.length ||
                busy ||
                bagUnavailable ||
                (giftOpen && !!selectedRef && !selected)
              }
              onClick={() => void send()}
            >
              发出
            </InkButton>
          </div>
        </div>
        {giftOpen ? (
          <section className="hidden min-w-0 lg:block" aria-label="角色物品">
            {inventory}
          </section>
        ) : null}
      </div>
      {giftOpen ? (
        <InkDetailDrawer
          isOpen={bagOpen}
          onClose={() => setBagOpen(false)}
          title="随身物品"
          size="sm"
        >
          {inventory}
        </InkDetailDrawer>
      ) : null}
    </InkModal>
  );
}
