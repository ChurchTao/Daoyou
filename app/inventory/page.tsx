'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
  InkTabs,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Artifact, Consumable } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getArtifactTypeLabel,
  getMaterialTypeInfo,
  getStatusLabel,
} from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type Tab = 'artifacts' | 'materials' | 'consumables';

export default function InventoryPage() {
  const { cultivator, inventory, equipped, isLoading, refresh, note } =
    useCultivatorBundle();
  const [activeTab, setActiveTab] = useState<Tab>('artifacts');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pathname = usePathname();
  const { pushToast } = useInkUI();

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

  const handleConsume = async (item: Consumable) => {
    if (!cultivator || !item.id) {
      pushToast({ message: '此丹药暂无有效 ID，无法服用。', tone: 'warning' });
      return;
    }

    setPendingId(item.id);
    try {
      const response = await fetch(
        `/api/cultivators/${cultivator.id}/consume`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ consumableId: item.id }),
        },
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '服用失败');
      }

      pushToast({ message: result.data.message, tone: 'success' });
      await refresh();
    } catch (error) {
      pushToast({
        message:
          error instanceof Error
            ? `药力冲突：${error.message}`
            : '服用失败，请稍后重试。',
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
                    {slotIcon} {item.name} {/* Added Quality Badge */}
                    {item.quality && (
                      <InkBadge tier={item.quality} className="ml-2">
                        {item.quality}
                      </InkBadge>
                    )}
                    <InkBadge tone="accent" className="ml-2">
                      {artifactType}
                    </InkBadge>
                    {equippedNow && (
                      <span className="ml-2 text-xs text-ink-primary font-bold">
                        ← 已装备
                      </span>
                    )}
                  </>
                }
                meta={
                  <>
                    <span>
                      {item.element} · {bonusText}
                    </span>
                    {item.required_realm && (
                      <span className="block text-xs text-ink-secondary mt-1">
                        境界要求：{item.required_realm}
                      </span>
                    )}
                  </>
                }
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
          {inventory.materials.map((item, idx) => {
            const typeInfo = getMaterialTypeInfo(item.type);
            return (
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
                meta={
                  <span>
                    {typeInfo.icon} {typeInfo.label}
                    {item.element ? ` · ${item.element}` : ''}
                  </span>
                }
                description={item.description || '平平无奇的材料'}
              />
            );
          })}
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
          {inventory.consumables.map((item, idx) => {
            // Parse effects for display
            const effectDescriptions = item.effect
              ? item.effect
                  .map((e) => {
                    const bonus = e.bonus ? `+${e.bonus}` : '';
                    return `${e.effect_type}${bonus}`;
                  })
                  .join('，')
              : '未知效果';

            return (
              <InkListItem
                key={item.id || idx}
                title={
                  <>
                    {item.name}
                    {item.quality && (
                      <InkBadge tier={item.quality} className="ml-2">
                        {item.quality}
                      </InkBadge>
                    )}
                  </>
                }
                meta={item.type}
                description={effectDescriptions}
                actions={
                  <InkButton
                    disabled={!item.id || pendingId === item.id}
                    onClick={() => handleConsume(item)}
                    variant="primary"
                    className="text-sm"
                  >
                    {pendingId === item.id ? '服用中…' : '服用'}
                  </InkButton>
                }
              />
            );
          })}
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
      <InkTabs
        className="mb-4"
        activeValue={activeTab}
        onChange={(val) => setActiveTab(val as Tab)}
        items={[
          { label: '法宝', value: 'artifacts' },
          { label: '材料', value: 'materials' },
          { label: '丹药', value: 'consumables' },
        ]}
      />

      {activeTab === 'artifacts' && renderArtifacts()}
      {activeTab === 'materials' && renderMaterials()}
      {activeTab === 'consumables' && renderConsumables()}
    </InkPageShell>
  );
}
