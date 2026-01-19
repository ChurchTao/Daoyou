'use client';

import { InkModal, InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { Material } from '@/types/cultivator';
import { getMaterialTypeInfo } from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type EnlightenmentType = 'create_skill' | 'create_gongfa';

export default function EnlightenPage() {
  const { cultivator, inventory, refreshInventory, note, isLoading } =
    useCultivator();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [enlightenmentType, setEnlightenmentType] =
    useState<EnlightenmentType>('create_skill');
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  const MAX_MATERIALS = 5;

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((mid) => mid !== id);
      }
      if (prev.length >= MAX_MATERIALS) {
        pushToast({
          message: `悟道精力有限，最多参悟 ${MAX_MATERIALS} 种典籍`,
          tone: 'warning',
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (!prompt.trim()) {
      pushToast({
        message: '请注入神念，描述感悟方向。',
        tone: 'warning',
      });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '请选择要参悟的功法典籍。', tone: 'warning' });
      return;
    }

    // 检查是否包含典籍
    const hasManual = selectedMaterialIds.some((id) =>
      inventory.materials.find((m) => m.id === id && m.type === 'manual'),
    );

    if (!hasManual) {
      pushToast({
        message: '参悟必须以功法典籍(manual)为核心。',
        tone: 'warning',
      });
      return;
    }

    setSubmitting(true);
    setStatus('闭关参悟中，神游太虚……');

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialIds: selectedMaterialIds,
          prompt: prompt,
          craftType: enlightenmentType,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '参悟失败');
      }

      const typeName = enlightenmentType === 'create_skill' ? '神通' : '功法';
      const successMessage = `参悟成功！习得${typeName}【${result.data.name}】`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setPrompt('');
      setSelectedMaterialIds([]);
      await refreshInventory();
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `参悟中断：${error.message}`
          : '参悟失败，请稍后再试。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">正在布置静室……</p>
      </div>
    );
  }

  const validMaterials = inventory.materials.filter((m) =>
    ['manual', 'consumable'].includes(m.type),
  );

  return (
    <InkPageShell
      title="【悟道室】"
      subtitle="参悟典籍，演化神通"
      backHref="/game/craft"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/craft">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            {selectedMaterialIds.length > 0
              ? `已选 ${selectedMaterialIds.length} 种典籍/辅助`
              : '请选择典籍开始参悟'}
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="1. 选择参悟方向">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setEnlightenmentType('create_skill')}
            className={`flex-1 p-4 border rounded-lg transition-colors text-center ${
              enlightenmentType === 'create_skill'
                ? 'bg-ink-primary text-white border-ink-primary'
                : 'border-ink-border hover:bg-ink-primary/5'
            }`}
          >
            <div className="text-xl mb-1">⚡</div>
            <div className="font-bold">神通 (主动)</div>
            <div className="text-xs opacity-80 mt-1">用于战斗施放</div>
          </button>
          <button
            onClick={() => setEnlightenmentType('create_gongfa')}
            className={`flex-1 p-4 border rounded-lg transition-colors text-center ${
              enlightenmentType === 'create_gongfa'
                ? 'bg-ink-primary text-white border-ink-primary'
                : 'border-ink-border hover:bg-ink-primary/5'
            }`}
          >
            <div className="text-xl mb-1">📖</div>
            <div className="font-bold">功法 (被动)</div>
            <div className="text-xs opacity-80 mt-1">提升属性/被动效果</div>
          </button>
        </div>
      </InkSection>

      <InkSection title="2. 甄选典籍">
        {validMaterials.length > 0 ? (
          <div className="max-h-60 overflow-y-auto border border-ink-border rounded p-2">
            <InkList dense>
              {validMaterials.map((m) => {
                const typeInfo = getMaterialTypeInfo(m.type);
                const isSelected = selectedMaterialIds.includes(m.id!);
                return (
                  <div
                    key={m.id}
                    onClick={() => !isSubmitting && toggleMaterial(m.id!)}
                    className={`cursor-pointer border-b border-ink-border/30 last:border-0 p-2 transition-colors ${
                      isSelected ? 'bg-orange-900/10' : 'hover:bg-ink-primary/5'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="accent-ink-primary"
                        />
                        <span className="font-bold">
                          {typeInfo.icon} {m.name}
                        </span>
                        <InkBadge tier={m.rank}>{typeInfo.label}</InkBadge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-secondary">
                          x{m.quantity}
                        </span>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <InkButton
                            variant="secondary"
                            className="text-xs leading-none"
                            onClick={() => {
                              setViewingMaterial(m);
                            }}
                          >
                            详情
                          </InkButton>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-ink-secondary ml-6 mt-1 truncate">
                      {m.description || '无描述'}
                    </div>
                  </div>
                );
              })}
            </InkList>
          </div>
        ) : (
          <InkNotice>囊中羞涩，暂无典籍。</InkNotice>
        )}
        <p className="text-right text-xs text-ink-secondary mt-1">
          {selectedMaterialIds.length}/{MAX_MATERIALS}
        </p>
      </InkSection>

      <InkSection title="3. 注入感悟">
        <div className="mb-4">
          <InkList dense>
            <InkListItem
              title="提示"
              description="描述你对该功法/神通的理解，或希望获得的效果方向。"
            />
          </InkList>
        </div>

        <InkInput
          multiline
          rows={6}
          placeholder="请在此注入你的感悟……"
          value={prompt}
          onChange={(value) => setPrompt(value)}
          disabled={isSubmitting}
          hint="💡 典籍品质决定下限，感悟深度决定上限。"
        />

        <InkActionGroup align="right">
          <InkButton
            onClick={() => {
              setPrompt('');
              setStatus('');
              setSelectedMaterialIds([]);
            }}
            disabled={isSubmitting}
          >
            重置
          </InkButton>
          <InkButton
            variant="primary"
            onClick={handleSubmit}
            disabled={
              isSubmitting || !prompt.trim() || selectedMaterialIds.length === 0
            }
          >
            {isSubmitting ? '闭关参悟中……' : '开始参悟'}
          </InkButton>
        </InkActionGroup>
      </InkSection>

      {status && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}
      {/* 物品详情弹窗 */}
      <InkModal
        isOpen={!!viewingMaterial}
        onClose={() => setViewingMaterial(null)}
      >
        {viewingMaterial && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl p-2 bg-ink/5 rounded-lg border border-ink/10">
                {getMaterialTypeInfo(viewingMaterial.type).icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold ">{viewingMaterial.name}</h3>
                  <InkBadge tier={viewingMaterial.rank}>
                    {`${getMaterialTypeInfo(viewingMaterial.type).label} · ${viewingMaterial.element}`}
                  </InkBadge>
                </div>
                <p className="text-sm text-ink-secondary">
                  拥有数量：{viewingMaterial.quantity}
                </p>
              </div>
            </div>

            <div className="bg-ink/5 p-3 rounded-lg border border-ink/10">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {viewingMaterial.description || '此物灵韵内敛，暂无详细记载。'}
              </p>
            </div>
          </div>
        )}
      </InkModal>
    </InkPageShell>
  );
}
