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
import { useEffect, useState } from 'react';

type CostEstimate = {
  spiritStones?: number;
  comprehension?: number;
};

type CostResponse = {
  success: boolean;
  data?: {
    cost: CostEstimate;
    canAfford: boolean;
  };
};

export default function AlchemyPage() {
  const { cultivator, inventory, refreshInventory, note, isLoading } =
    useCultivator();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  const MAX_MATERIALS = 5;

  // Fetch cost estimate when materials change
  useEffect(() => {
    if (selectedMaterialIds.length > 0) {
      fetchCostEstimate('alchemy', selectedMaterialIds);
    } else {
      setEstimatedCost(null);
      setCanAfford(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaterialIds]);

  const fetchCostEstimate = async (
    craftType: string,
    materialIds: string[],
  ) => {
    try {
      const response = await fetch(
        `/api/craft?craftType=${craftType}&materialIds=${materialIds.join(',')}`,
      );
      const result: CostResponse = await response.json();
      if (result.success && result.data) {
        setEstimatedCost(result.data.cost);
        setCanAfford(result.data.canAfford);
      }
    } catch (error) {
      console.error('Failed to fetch cost estimate:', error);
    }
  };

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((mid) => mid !== id);
      }
      if (prev.length >= MAX_MATERIALS) {
        pushToast({
          message: `丹炉容积有限，最多投入 ${MAX_MATERIALS} 种药材`,
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
        message: '请注入神念，描述丹药功效。',
        tone: 'warning',
      });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '无药不成丹，请投入灵草。', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    setStatus('文武火候，九转炼丹……');

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialIds: selectedMaterialIds,
          prompt: prompt,
          craftType: 'alchemy',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '炼制失败');
      }

      const successMessage = `【${result.data.name}】出炉！`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setPrompt('');
      setSelectedMaterialIds([]);
      await refreshInventory();
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `炸炉了：${error.message}`
          : '炼制失败，请稍后再试。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">丹火温养中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【炼丹房】"
      subtitle="阴阳调和，九转金丹"
      backHref="/game/craft"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/craft">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            {selectedMaterialIds.length > 0
              ? `已投入 ${selectedMaterialIds.length} 种灵草`
              : '请投入灵草开始炼丹'}
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="1. 甄选灵草">
        {inventory.materials && inventory.materials.length > 0 ? (
          <div className="max-h-60 overflow-y-auto border border-ink-border rounded p-2">
            <InkList dense>
              {inventory.materials
                .filter((m) => m.type != 'ore' && m.type != 'manual')
                .map((m) => {
                  const typeInfo = getMaterialTypeInfo(m.type);
                  const isSelected = selectedMaterialIds.includes(m.id!);
                  return (
                    <div
                      key={m.id}
                      onClick={() => !isSubmitting && toggleMaterial(m.id!)}
                      className={`cursor-pointer border-b border-ink-border/30 last:border-0 p-2 transition-colors ${
                        isSelected
                          ? 'bg-emerald-900/10'
                          : 'hover:bg-ink-primary/5'
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
                          <InkButton
                            variant="secondary"
                            className="text-sm leading-none"
                            onClick={() => {
                              setViewingMaterial(m);
                            }}
                          >
                            详情
                          </InkButton>
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
          <InkNotice>囊中羞涩，暂无灵草。</InkNotice>
        )}
        <p className="text-right text-xs text-ink-secondary mt-1">
          {selectedMaterialIds.length}/{MAX_MATERIALS}
        </p>
      </InkSection>

      <InkSection title="预计消耗">
        {estimatedCost ? (
          <div className="flex items-center justify-between p-3 bg-ink/5 rounded-lg border border-ink/10">
            <span className="text-sm">
              灵石：
              <span className="font-bold text-amber-600">
                {estimatedCost.spiritStones}
              </span>{' '}
              枚
            </span>
            <span
              className={`text-xs ${canAfford ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {canAfford ? '✓ 资源充足' : '✗ 灵石不足'}
            </span>
          </div>
        ) : (
          <InkNotice>请先选择材料以查看消耗</InkNotice>
        )}
      </InkSection>

      <InkSection title="2. 注入神识">
        <div className="mb-4">
          <InkList dense>
            <InkListItem
              title="提示"
              description="描述你期望的丹药功效，如增进修为（灵力）、强健体魄（体魄）。"
            />
            <InkListItem
              title="示例"
              description="“我想炼制一炉能稳固根基、增加体魄的丹药。”"
            />
          </InkList>
        </div>

        <InkInput
          multiline
          rows={6}
          placeholder="请在此注入你的神念……"
          value={prompt}
          onChange={(value) => setPrompt(value)}
          disabled={isSubmitting}
          hint="💡 灵草药性与神念越契合，成丹几率越高。"
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
              isSubmitting ||
              !prompt.trim() ||
              selectedMaterialIds.length === 0 ||
              !canAfford
            }
          >
            {isSubmitting ? '文武火炼……' : '开炉炼丹'}
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
