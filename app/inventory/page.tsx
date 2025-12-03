'use client';

import { InkButton, InkCard, InkDivider } from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Artifact } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getArtifactTypeLabel,
  getStatusLabel,
} from '@/types/dictionaries';
import { useState } from 'react';

export default function InventoryPage() {
  const {
    cultivator,
    inventory,
    equipped,
    isLoading,
    refresh,
    note,
    usingMock,
  } = useCultivatorBundle();
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
      setFeedback(
        error instanceof Error
          ? `此法有违天道：${error.message}`
          : '操作失败，请稍后重试。',
      );
    } finally {
      setPendingId(null);
    }
  };

  // 获取装备特效描述
  const getEffectText = (
    effect: NonNullable<Artifact['special_effects']>[0],
  ) => {
    if (effect.type === 'damage_bonus') {
      return `${effect.element}系伤害 +${Math.round(effect.bonus * 100)}%`;
    } else if (effect.type === 'on_hit_add_effect') {
      return `命中时${effect.chance}%概率附加${getStatusLabel(effect.effect)}`;
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
          <InkButton href="/">返回主界</InkButton>
          <span className="text-ink-secondary">[整理法宝]</span>
        </div>
      }
    >
      {feedback && (
        <>
          <div className="mb-4 text-center text-sm text-ink">{feedback}</div>
          <InkDivider />
        </>
      )}

      {!cultivator ? (
        <div className="text-center">尚无角色，自然也无储物袋可查。</div>
      ) : totalEquipments > 0 ? (
        <div className="space-y-2">
          {inventory.artifacts.map((item) => {
            const equippedNow = Boolean(
              item.id &&
              (equipped.weapon === item.id ||
                equipped.armor === item.id ||
                equipped.accessory === item.id),
            );

            const slotIcon =
              item.slot === 'weapon'
                ? '🗡️'
                : item.slot === 'armor'
                  ? '🛡️'
                  : '📿';
            const artifactType = getArtifactTypeLabel(item.slot);

            const bonusText = formatAttributeBonusMap(item.bonus);

            const effectText =
              item.special_effects?.map((e) => getEffectText(e)).join('｜') ||
              '';

            return (
              <InkCard key={item.id ?? item.name} highlighted={equippedNow}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {slotIcon} {item.name}（{item.element}·{artifactType}）
                      {equippedNow && (
                        <span className="equipped-mark">← 已装备</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-secondary">
                      {bonusText}
                      {effectText && `｜${effectText}`}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <InkButton
                      disabled={pendingId === item.id}
                      onClick={() => handleEquipToggle(item)}
                      className="text-sm"
                    >
                      {pendingId === item.id
                        ? '操作中…'
                        : equippedNow
                          ? '卸下'
                          : '装备'}
                    </InkButton>
                  </div>
                </div>
              </InkCard>
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
