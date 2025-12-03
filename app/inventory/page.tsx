'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Artifact } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getArtifactTypeLabel,
  getStatusLabel,
} from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pathname = usePathname();
  const { pushToast } = useInkUI();

  const totalEquipments = inventory.artifacts.length;

  const handleEquipToggle = async (item: Artifact) => {
    if (!cultivator || !item.id) {
      pushToast({ message: '此法宝暂无有效 ID，无法操作。', tone: 'warning' });
      return;
    }

    setPendingId(item.id);
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

      pushToast({ message: '法宝灵性已调顺。', tone: 'success' });
      await refresh();
    } catch (error) {
      pushToast({
        message:
          error instanceof Error
            ? `此法有违天道：${error.message}`
            : '操作失败，请稍后重试。',
        tone: 'danger',
      });
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
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回主界</InkButton>
          <InkButton href="/inventory" variant="secondary">
            整理法宝
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>尚无角色，自然也无储物袋可查。</InkNotice>
      ) : totalEquipments > 0 ? (
        <InkList>
          {inventory.artifacts.map((item) => {
            const equippedNow = Boolean(
              item.id &&
                (equipped.weapon === item.id ||
                  equipped.armor === item.id ||
                  equipped.accessory === item.id),
            );

            const slotIcon =
              item.slot === 'weapon' ? '🗡️' : item.slot === 'armor' ? '🛡️' : '📿';
            const artifactType = getArtifactTypeLabel(item.slot);

            const bonusText = formatAttributeBonusMap(item.bonus);

            const effectText =
              item.special_effects?.map((e) => getEffectText(e)).join('｜') || '';

            return (
              <InkListItem
                key={item.id ?? item.name}
                title={
                  <>
                    {slotIcon} {item.name}{' '}
                    <InkBadge tone="accent">{artifactType}</InkBadge>
                    {equippedNow && <span className="equipped-mark">← 已装备</span>}
                  </>
                }
                meta={`${item.element} · ${bonusText}`}
                description={effectText}
                actions={
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
                }
              />
            );
          })}
        </InkList>
      ) : (
        <InkNotice>储物袋空空如也，道友该去寻宝了。</InkNotice>
      )}

      {usingMock && (
        <p className="mt-6 text-center text-xs text-ink-secondary">
          【占位】当前为示例数据，待真实物品栏接口完成后替换。
        </p>
      )}
    </InkPageShell>
  );
}
