'use client';

import { InkPageShell } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Equipment } from '@/types/cultivator';
import Link from 'next/link';
import { useState } from 'react';

export default function InventoryPage() {
  const { cultivator, inventory, equipped, isLoading, refresh, note, usingMock } = useCultivatorBundle();
  const [feedback, setFeedback] = useState<string>('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const totalEquipments = inventory.equipments.length;

  const handleEquipToggle = async (item: Equipment) => {
    if (!cultivator || !item.id) {
      setFeedback('此法宝暂无有效 ID，无法操作。');
      return;
    }

    setPendingId(item.id);
    setFeedback('');
    try {
      const response = await fetch(`/api/cultivators/${cultivator.id}/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ equipmentId: item.id }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '装备操作失败');
      }

      setFeedback('操作完成，法宝灵性已调顺。');
      await refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? `此法有违天道：${error.message}` : '操作失败，请稍后重试。');
    } finally {
      setPendingId(null);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">储物袋开启中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title={`【储物袋 · 共 ${totalEquipments} 件法宝】`}
      subtitle="仅保留文字 + 氛围排版，操作区域置于拇指热区"
      backHref="/"
      note={note}
      footer={
        <div className="flex justify-between text-ink">
          <Link href="/" className="hover:text-crimson">
            [返回主界]
          </Link>
          <span className="text-ink-secondary">[整理法宝 · TODO]</span>
        </div>
      }
    >
      {feedback && (
        <div className="mb-4 rounded border border-ink/10 bg-white/70 p-3 text-center text-sm text-ink">
          {feedback}
        </div>
      )}

      {!cultivator ? (
        <div className="rounded-lg border border-ink/10 bg-paper-light p-6 text-center">
          尚无角色，自然也无储物袋可查。
        </div>
      ) : totalEquipments ? (
        <div className="space-y-4">
          {inventory.equipments.map((item) => {
            const equippedNow =
              item.id &&
              (equipped.weapon === item.id || equipped.armor === item.id || equipped.accessory === item.id);
            return (
              <div
                key={item.id ?? item.name}
                className={`rounded-lg border p-4 shadow-sm ${
                  equippedNow ? 'border-crimson/60 bg-crimson/5' : 'border-ink/10 bg-paper-light'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-3/4">
                      <p className="font-semibold">
                        {item.type === 'weapon' ? '🗡️ 武器' : item.type === 'armor' ? '🛡️ 护甲' : '📿 饰品'}：{item.name}
                        {equippedNow && <span className="equipped-mark">← 已装备</span>}
                      </p>
                      <p className="text-sm text-ink-secondary">
                        {item.element}·{item.quality ?? '未知品阶'}｜{item.specialEffect ?? '暂无附加描述'}
                      </p>
                    </div>
                    <button
                      className="btn-primary btn-sm"
                      disabled={pendingId === item.id}
                      onClick={() => handleEquipToggle(item)}
                    >
                      {pendingId === item.id ? '操作中…' : equippedNow ? '卸下' : '装备'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">储物袋空空如也，道友该去寻宝了。</p>
      )}

      {usingMock && (
        <p className="mt-6 text-center text-xs text-ink-secondary">
          【占位】当前为示例数据，待真实物品栏接口完成后替换。
        </p>
      )}
    </InkPageShell>
  );
}

