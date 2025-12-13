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
import { InkModal } from '@/components/InkModal';
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getEffectText,
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type Tab = 'artifacts' | 'materials' | 'consumables';

export default function InventoryPage() {
  const { cultivator, inventory, equipped, isLoading, refresh, note } =
    useCultivatorBundle();
  const [activeTab, setActiveTab] = useState<Tab>('artifacts');
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Modal state
  const [selectedItem, setSelectedItem] = useState<
    Artifact | Consumable | Material | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleShowDetails = (item: Artifact | Consumable | Material) => {
    setSelectedItem(item);
    setIsModalOpen(true);
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

            const slotInfo = getEquipmentSlotInfo(item.slot);
            const bonusText = formatAttributeBonusMap(item.bonus);
            const effectText =
              item.special_effects?.map((e) => getEffectText(e)).join('\n') ||
              '';

            return (
              <InkListItem
                key={item.id ?? item.name}
                title={
                  <>
                    {slotInfo.icon} {item.name} · {item.element}
                    <InkBadge tier={item.quality}>{slotInfo.label}</InkBadge>
                  </>
                }
                meta={
                  <>
                    {item.required_realm && (
                      <span className="text-xs text-ink-secondary">
                        境界要求：{item.required_realm}
                      </span>
                    )}
                    {equippedNow && (
                      <span className="ml-2 text-xs text-ink-primary font-bold">
                        ← 已装备
                      </span>
                    )}
                  </>
                }
                description={
                  <>
                    {bonusText}
                    {effectText ? `\n${effectText}` : null}
                  </>
                }
                actions={
                  <div className="flex gap-2">
                    <InkButton
                      variant="secondary"
                      className="text-xs px-2"
                      onClick={() => handleShowDetails(item)}
                    >
                      详情
                    </InkButton>
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
                }
              />
            );
          })}
        </InkList>
      ) : (
        <InkNotice>空空如也，道友快去寻宝吧！</InkNotice>
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
                    {typeInfo.icon} {item.name}
                    <InkBadge tier={item.rank} className="ml-2">
                      {typeInfo.label}
                    </InkBadge>
                    <span className="ml-2 text-xs text-ink-secondary">
                      x{item.quantity}
                    </span>
                  </>
                }
                meta={`属性：${item.element}`}
                description={item.description || '平平无奇的材料'}
                actions={
                  <InkButton
                    variant="secondary"
                    className="text-xs px-2"
                    onClick={() => handleShowDetails(item)}
                  >
                    详情
                  </InkButton>
                }
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
                        {item.type}
                      </InkBadge>
                    )}
                  </>
                }
                description={effectDescriptions}
                actions={
                  <div className="flex gap-2">
                    <InkButton
                      variant="secondary"
                      className="text-xs px-2"
                      onClick={() => handleShowDetails(item)}
                    >
                      详情
                    </InkButton>
                    <InkButton
                      disabled={!item.id || pendingId === item.id}
                      onClick={() => handleConsume(item)}
                      variant="primary"
                      className="text-sm"
                    >
                      {pendingId === item.id ? '服用中…' : '服用'}
                    </InkButton>
                  </div>
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

  const renderModalContent = () => {
    if (!selectedItem) return null;

    // Check if it's an artifact (has slot)
    if ('slot' in selectedItem) {
      const item = selectedItem as Artifact;
      const slotInfo = getEquipmentSlotInfo(item.slot);
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
            <div className="text-4xl mb-2">{slotInfo.icon}</div>
            <h4 className="text-lg font-bold">{item.name}</h4>
            <div className="flex gap-2 mt-2">
              <InkBadge tier={item.quality}>{slotInfo.label}</InkBadge>
              <InkBadge tone="default">{item.element}</InkBadge>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {item.required_realm && (
              <div className="flex justify-between border-b border-ink/50 pb-2">
                <span className="opacity-70">境界要求</span>
                <span>{item.required_realm}</span>
              </div>
            )}

            {/* Base Attributes */}
            <div className="pt-2">
              <span className="block opacity-70 mb-1">基础属性</span>
              <div className="grid grid-cols-2 gap-2">
                {formatAttributeBonusMap(item.bonus)
                  .split('\n')
                  .filter(Boolean)
                  .map((line, i) => (
                    <div key={i} className="px-2 py-1 rounded">
                      {line}
                    </div>
                  ))}
              </div>
            </div>

            {/* Special Effects */}
            {item.special_effects && item.special_effects.length > 0 && (
              <div className="pt-2">
                <span className="block opacity-70 mb-1 font-bold text-ink-primary">
                  特殊效果
                </span>
                <ul className="list-disc list-inside space-y-1">
                  {item.special_effects.map((e, i) => (
                    <li key={i}>{getEffectText(e)}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Curses */}
            {item.curses && item.curses.length > 0 && (
              <div className="pt-2">
                <span className="block opacity-70 mb-1 font-bold text-ink-danger">
                  诅咒效果
                </span>
                <ul className="list-disc list-inside space-y-1 text-ink-danger">
                  {item.curses.map((e, i) => (
                    <li key={i}>{getEffectText(e)}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.description && (
              <div className="pt-2">
                <span className="block opacity-70 mb-1">法宝说明</span>
                <p className="indent-4 leading-relaxed opacity-90">
                  {item.description}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Check if consumables (has effect array but no slot)
    else if ('effect' in selectedItem) {
      const item = selectedItem as Consumable;
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
            <div className="text-4xl mb-2">🌕</div>
            <h4 className="text-lg font-bold">{item.name}</h4>
            <div className="flex gap-2 mt-2">
              {item.quality && (
                <InkBadge tier={item.quality}>{item.type}</InkBadge>
              )}
            </div>
          </div>

          <div className="space-y-4 text-sm">
            {item.description && (
              <div>
                <span className="block opacity-70 mb-1">丹药详述</span>
                <p className="indent-4 leading-relaxed opacity-90">
                  {item.description}
                </p>
              </div>
            )}

            {item.effect && item.effect.length > 0 && (
              <div>
                <span className="block opacity-70 mb-1">药效</span>
                <ul className="space-y-2">
                  {item.effect.map((e, i) => (
                    <li
                      key={i}
                      className="flex justify-between items-center bg-paper-2 p-2 rounded"
                    >
                      <span>{e.effect_type}</span>
                      <span className="font-bold text-ink-primary">
                        +{e.bonus}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Materials (fallback)
    else {
      const item = selectedItem as Material;
      const typeInfo = getMaterialTypeInfo(item.type);
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
            <div className="text-4xl mb-2">{typeInfo.icon}</div>
            <h4 className="text-lg font-bold">{item.name}</h4>
            <div className="flex gap-2 mt-2">
              <InkBadge tier={item.rank}>{typeInfo.label}</InkBadge>
              {item.element && (
                <InkBadge tone="default">{item.element}</InkBadge>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="opacity-70">持有数量</span>
              <span className="font-bold">{item.quantity}</span>
            </div>

            {item.description && (
              <div className="pt-2">
                <span className="block opacity-70 mb-1">物品说明</span>
                <p className="indent-4 leading-relaxed opacity-90">
                  {item.description}
                </p>
              </div>
            )}
          </div>
        </div>
      );
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

      <InkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="物品详情"
      >
        {renderModalContent()}
        <div className="pt-4 flex justify-end">
          <InkButton onClick={() => setIsModalOpen(false)} className="w-full">
            关闭
          </InkButton>
        </div>
      </InkModal>
    </InkPageShell>
  );
}
