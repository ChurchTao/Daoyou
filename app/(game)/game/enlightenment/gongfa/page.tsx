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
import { EffectDetailModal } from '@/components/ui/EffectDetailModal';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { isGongFaManual } from '@/engine/material/materialTypeUtils';
import { CultivationTechnique, Material } from '@/types/cultivator';
import { getMaterialTypeInfo } from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const MAX_MATERIALS = 5;

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

export default function GongfaCreationPage() {
  const { cultivator, refreshCultivator, note, isLoading } = useCultivator();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdGongfa, setCreatedGongfa] =
    useState<CultivationTechnique | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  // Fetch cost estimate when materials change
  useEffect(() => {
    if (selectedMaterialIds.length > 0) {
      fetchCostEstimate('create_gongfa', selectedMaterialIds);
    } else {
      setEstimatedCost(null);
      setCanAfford(true);
    }
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
        message: '请注入神念，描述功法理念。',
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
      cultivator.inventory?.materials.find(
        (m) => m.id === id && isGongFaManual(m.type),
      ),
    );

    if (!hasManual) {
      pushToast({
        message: '参悟必须以功法典籍(gongfa_manual)为核心。',
        tone: 'warning',
      });
      return;
    }

    setSubmitting(true);
    setStatus('感悟天地，参悟大道……');
    setCreatedGongfa(null);

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialIds: selectedMaterialIds,
          prompt: prompt,
          craftType: 'create_gongfa',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '参悟失败');
      }

      const gongfa = result.data;
      setCreatedGongfa(gongfa);

      const successMessage = `功法【${gongfa.name}】参悟成功！`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setPrompt('');
      setSelectedMaterialIds([]);
      await refreshCultivator();
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `走火入魔：${error.message}`
          : '参悟失败，灵感中断。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">布置静室中……</p>
      </div>
    );
  }

  // Filter materials to only show manual type
  const validMaterials =
    cultivator?.inventory?.materials.filter((m) => isGongFaManual(m.type)) ||
    [];

  const renderGongfaExtraInfo = (gongfa: CultivationTechnique) => (
    <div className="space-y-1 text-sm">
      <div className="border-ink/50 flex justify-between border-b pb-1">
        <span className="opacity-70">需求境界</span>
        <span>{gongfa.required_realm}</span>
      </div>
    </div>
  );

  return (
    <InkPageShell
      title="【功法参悟】"
      subtitle="万法归宗，神念通玄"
      backHref="/game/enlightenment"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/enlightenment">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            {selectedMaterialIds.length > 0
              ? `已选 ${selectedMaterialIds.length} 种典籍`
              : '请选择典籍开始参悟'}
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="1. 甄选典籍">
        {validMaterials.length > 0 ? (
          <div className="border-ink-border max-h-60 overflow-y-auto rounded border p-2">
            <InkList dense>
              {validMaterials.map((m) => {
                const typeInfo = getMaterialTypeInfo(m.type);
                const isSelected = selectedMaterialIds.includes(m.id!);
                return (
                  <div
                    key={m.id}
                    onClick={() => !isSubmitting && toggleMaterial(m.id!)}
                    className={`border-ink-border/30 cursor-pointer border-b p-2 transition-colors last:border-0 ${
                      isSelected ? 'bg-orange-900/10' : 'hover:bg-ink-primary/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
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
                        <span className="text-ink-secondary text-xs">
                          x{m.quantity}
                        </span>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
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
                    </div>
                    <div className="text-ink-secondary mt-1 ml-6 truncate text-xs">
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
        <p className="text-ink-secondary mt-1 text-right text-xs">
          {selectedMaterialIds.length}/{MAX_MATERIALS}
        </p>
      </InkSection>

      <InkSection title="预计消耗">
        {estimatedCost ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">
              道心感悟：
              <span className="font-bold text-purple-600">
                {estimatedCost.comprehension}
              </span>{' '}
              点
            </span>
            <span
              className={`text-xs ${canAfford ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {canAfford ? '✓ 感悟充足' : '✗ 感悟不足'}
            </span>
          </div>
        ) : (
          <InkNotice>请先选择典籍以查看消耗</InkNotice>
        )}
      </InkSection>

      <InkSection title="2. 注入感悟">
        <div className="mb-4">
          <InkList dense>
            <InkListItem
              title="提示"
              description="描述你对该功法的理解，或希望获得的效果方向。"
            />
            <InkListItem
              title="示例"
              description="“我想创造一门能提升灵力恢复速度，并在突破时增加成功率的功法。”"
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
              isSubmitting ||
              !prompt.trim() ||
              selectedMaterialIds.length === 0 ||
              !canAfford
            }
          >
            {isSubmitting ? '参悟中……' : '开始参悟'}
          </InkButton>
        </InkActionGroup>
      </InkSection>

      {status && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      {/* Result Modal */}
      {createdGongfa && (
        <EffectDetailModal
          isOpen={!!createdGongfa}
          onClose={() => setCreatedGongfa(null)}
          icon="📖"
          name={createdGongfa.name}
          badges={[
            createdGongfa.grade && (
              <InkBadge key="g" tier={createdGongfa.grade}>
                {createdGongfa.grade}
              </InkBadge>
            ),
          ].filter(Boolean)}
          extraInfo={renderGongfaExtraInfo(createdGongfa)}
          effects={createdGongfa.effects}
          description={createdGongfa.description}
          effectTitle="功法效果"
          descriptionTitle="功法详述"
          footer={
            <InkButton
              onClick={() => setCreatedGongfa(null)}
              className="w-full"
            >
              了然于胸
            </InkButton>
          }
        />
      )}

      {/* Material Detail Modal */}
      <InkModal
        isOpen={!!viewingMaterial}
        onClose={() => setViewingMaterial(null)}
      >
        {viewingMaterial && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-ink/5 border-ink/10 rounded-lg border p-2 text-4xl">
                {getMaterialTypeInfo(viewingMaterial.type).icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{viewingMaterial.name}</h3>
                  <InkBadge tier={viewingMaterial.rank}>
                    {`${getMaterialTypeInfo(viewingMaterial.type).label} · ${viewingMaterial.element}`}
                  </InkBadge>
                </div>
                <p className="text-ink-secondary text-sm">
                  拥有数量：{viewingMaterial.quantity}
                </p>
              </div>
            </div>

            <div className="bg-ink/5 border-ink/10 rounded-lg border p-3">
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
