'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
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

type Tab = 'artifacts' | 'materials' | 'consumables';

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
  const [activeTab, setActiveTab] = useState<Tab>('artifacts');
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

  const renderArtifacts = () => (
    <>
      {inventory.artifacts.length > 0 ? (
        <InkList>
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
              <InkListItem
                key={item.id ?? item.name}
                title={
                  <>
                    {slotIcon} {item.name}{' '}
                    <InkBadge tone="accent">{artifactType}</InkBadge>
                    {equippedNow && (
                      <span className="ml-2 text-xs text-ink-primary font-bold">
                        ← 已装备
                      </span>
                    )}
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
        <InkNotice>法宝囊空空如也。</InkNotice>
      )}
    </>
  );

  const renderMaterials = () => (
    <>
      {inventory.materials && inventory.materials.length > 0 ? (
        <InkList>
          {inventory.materials.map((item, idx) => (
            <InkListItem
              key={item.id || idx}
              title={
                <>
                  {item.name}
                  <InkBadge tier={item.rank} className="ml-2">
                    {item.rank}
                  </InkBadge>
                  <span className="ml-2 text-xs text-ink-secondary">
                    x{item.quantity}
                  </span>
                </>
              }
              meta={`${item.type}${item.element ? ` · ${item.element}` : ''}`}
              description={item.description || '平平无奇的材料'}
            />
          ))}
        </InkList>
      ) : (
        <InkNotice>暂无修炼材料。</InkNotice>
      )}
    </>
  );

  const renderConsumables = () => (
    <>
      {inventory.consumables && inventory.consumables.length > 0 ? (
        <InkList>
          {inventory.consumables.map((item, idx) => (
            <InkListItem
              key={idx}
              title={item.name}
              meta={item.type}
              description="暂未实装使用效果"
            />
          ))}
        </InkList>
      ) : (
        <InkNotice>暂无丹药储备。</InkNotice>
      )}
    </>
  );

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">储物袋开启中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title={`【储物袋】`}
      subtitle={cultivator ? `灵石余额：${cultivator.spirit_stones}` : ''}
      backHref="/"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回主界</InkButton>
          <InkButton href="/market" variant="primary">
            前往坊市
          </InkButton>
          <InkButton href="/craft" variant="secondary">
            开炉炼造
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="筛选">
        <div className="flex gap-2 mb-4 border-b border-ink-border pb-2">
          <button
            onClick={() => setActiveTab('artifacts')}
            className={`px-3 py-1 ${activeTab === 'artifacts' ? 'text-ink-primary font-bold border-b-2 border-ink-primary' : 'text-ink-secondary'}`}
          >
            法宝
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-3 py-1 ${activeTab === 'materials' ? 'text-ink-primary font-bold border-b-2 border-ink-primary' : 'text-ink-secondary'}`}
          >
            材料
          </button>
          <button
            onClick={() => setActiveTab('consumables')}
            className={`px-3 py-1 ${activeTab === 'consumables' ? 'text-ink-primary font-bold border-b-2 border-ink-primary' : 'text-ink-secondary'}`}
          >
            丹药
          </button>
        </div>

        {activeTab === 'artifacts' && renderArtifacts()}
        {activeTab === 'materials' && renderMaterials()}
        {activeTab === 'consumables' && renderConsumables()}
      </InkSection>

      {usingMock && (
        <p className="mt-6 text-center text-xs text-ink-secondary">
          【占位】当前为示例数据，待真实物品栏接口完成后替换。
        </p>
      )}
    </InkPageShell>
  );
}
