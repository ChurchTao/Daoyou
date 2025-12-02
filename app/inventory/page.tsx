'use client';

import { InkPageShell } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Artifact } from '@/types/cultivator';
import Link from 'next/link';
import { useState } from 'react';

const attributeLabels: Record<string, string> = {
  vitality: '体魄',
  spirit: '灵力',
  wisdom: '悟性',
  speed: '身法',
  willpower: '神识',
};

export default function InventoryPage() {
  const { cultivator, inventory, equipped, isLoading, refresh, note, usingMock } = useCultivatorBundle();
  const [feedback, setFeedback] = useState<string>('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const totalEquipments = inventory.artifacts.length;

  const handleEquipToggle = async (item: Artifact) => {
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
        body: JSON.stringify({ artifactId: item.id }),
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

  // 获取装备特效描述
  const getEffectText = (effect: typeof inventory.artifacts[0]['special_effects'][0]) => {
    if (effect.type === 'damage_bonus') {
      return `${effect.element}系伤害 +${Math.round(effect.bonus * 100)}%`;
    } else if (effect.type === 'on_hit_add_effect') {
      return `命中时${effect.chance}%概率附加${effect.effect}`;
    }
    return effect.type;
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
      subtitle=""
      backHref="/"
      note={note}
      footer={
        <div className="flex justify-between text-ink">
          <Link href="/" className="hover:text-crimson">
            [返回主界]
          </Link>
          <span className="text-ink-secondary">[整理法宝]</span>
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
      ) : totalEquipments > 0 ? (
        <div className="space-y-4">
          {inventory.artifacts.map((item) => {
            const equippedNow =
              item.id &&
              (equipped.weapon === item.id || equipped.armor === item.id || equipped.accessory === item.id);
            
            const slotIcon = item.slot === 'weapon' ? '🗡️' : item.slot === 'armor' ? '🛡️' : '📿';
            const slotName = item.slot === 'weapon' ? '武器' : item.slot === 'armor' ? '护甲' : '饰品';
            const artifactType = item.slot === 'weapon' ? '道器' : item.slot === 'armor' ? '灵器' : '宝器';
            
            const bonusText = Object.entries(item.bonus)
              .filter(([_, v]) => v !== undefined && v !== 0)
              .map(([k, v]) => {
                const label = attributeLabels[k as keyof typeof attributeLabels] || k;
                return `+${label} ${v}`;
              })
              .join('｜');
            
            const effectText = item.special_effects?.map(e => getEffectText(e)).join('｜') || '';
            
            return (
              <div
                key={item.id ?? item.name}
                className={`rounded-lg border p-4 shadow-sm ${
                  equippedNow ? 'border-crimson/60 bg-crimson/5' : 'border-ink/10 bg-paper-light'
                }`}
              >
                <div className="mb-3">
                  <p className="font-semibold">
                    {slotIcon} {item.name}（{item.element}·{artifactType}）
                    {equippedNow && <span className="equipped-mark">← 已装备</span>}
                  </p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {bonusText}
                    {effectText && `｜${effectText}`}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    className="btn-primary btn-sm"
                    disabled={pendingId === item.id}
                    onClick={() => handleEquipToggle(item)}
                  >
                    {pendingId === item.id ? '操作中…' : equippedNow ? '卸下' : '装备'}
                  </button>
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

