import { ArtifactListCard } from '@app/components/feature/products';
import { InkButton } from '@app/components/ui/InkButton';
import { useArtifactInventoryResource } from '@app/lib/resources/inventory';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  SellConfirmResponse,
  SellPreviewResponse,
} from '@shared/types/market';
import { useRef, useState } from 'react';

/** Historical artifact transactions remain separate from the new bag's material/pill flow. */
export function LegacyArtifactRecycle() {
  const inventory = useArtifactInventoryResource({ pageSize: 20 });
  const [quote, setQuote] = useState<SellPreviewResponse>();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function act(id?: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/market/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          id
            ? { phase: 'preview', itemType: 'artifact', itemIds: [id] }
            : { phase: 'confirm', sessionId: quote?.sessionId },
        ),
      });
      if (id) {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? '询价失败');
        setQuote(result);
        setMessage('');
      } else {
        const result =
          await consumeResourceMutation<SellConfirmResponse>(response);
        setMessage(`旧物已收妥，付你 ${result.gainedSpiritStones} 灵石。`);
        setQuote(undefined);
        await inventory.reload();
      }
    } catch (error) {
      setQuote(undefined);
      setMessage(error instanceof Error ? error.message : '回收失败');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="space-y-3 pt-3 text-sm">
      <p>旧法宝仍按原价收购。</p>
      {message ? <p role="status">{message}</p> : null}
      {quote ? (
        <div className="space-y-2">
          <p>
            {quote.items.map((item) => item.name).join('、')}，合计{' '}
            <span className="font-mono">{quote.totalSpiritStones}</span> 灵石。
          </p>
          {quote.appraisal ? (
            <p className="text-ink-secondary">{quote.appraisal.comment}</p>
          ) : null}
          <InkButton disabled={pending} onClick={() => void act()}>
            确认出售旧法宝
          </InkButton>
        </div>
      ) : null}
      {inventory.loading ? (
        <p>正在翻看旧藏……</p>
      ) : inventory.error ? (
        <p role="alert">
          旧藏读取失败。
          <InkButton onClick={() => void inventory.reload()}>重试</InkButton>
        </p>
      ) : inventory.items?.length ? (
        inventory.items.map((item) => (
          <ArtifactListCard
            key={item.id}
            artifact={item}
            actions={
              <InkButton disabled={pending} onClick={() => void act(item.id)}>
                询价
              </InkButton>
            }
          />
        ))
      ) : (
        <p className="text-ink-secondary">暂无历史法宝。</p>
      )}
      <div className="flex justify-between">
        <InkButton
          disabled={pending || inventory.page === 1}
          onClick={inventory.goPrevPage}
        >
          上一页
        </InkButton>
        <InkButton
          disabled={pending || !inventory.pagination?.hasMore}
          onClick={inventory.goNextPage}
        >
          下一页
        </InkButton>
      </div>
    </div>
  );
}
