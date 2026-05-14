import { MaterialSelector } from '@app/routes/game/components/MaterialSelector';
import { InkPageShell, InkSection } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup, InkButton, InkInput, InkList, InkListItem, InkNotice, } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import type { Material } from '@shared/types/cultivator';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';


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
  const { cultivator, note, isLoading } = useCultivator();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast } = useInkUI();
  const { pathname } = useLocation();

  const MAX_MATERIALS = 5;

  useEffect(() => {
    if (selectedMaterialIds.length === 0) {
      return;
    }

    let cancelled = false;

    const loadCostEstimate = async () => {
      try {
        const response = await fetch(
          `/api/craft?craftType=alchemy&materialIds=${selectedMaterialIds.join(',')}`,
        );
        const result: CostResponse = await response.json();
        if (!cancelled && result.success && result.data) {
          setEstimatedCost(result.data.cost);
          setCanAfford(result.data.canAfford);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch cost estimate:', error);
        }
      }
    };

    void loadCostEstimate();

    return () => {
      cancelled = true;
    };
  }, [selectedMaterialIds]);

  const toggleMaterial = (id: string, material?: Material) => {
    setSelectedMaterialIds((prev) => {
      if (prev.includes(id)) {
        setSelectedMaterialMap((map) => {
          const next = { ...map };
          delete next[id];
          return next;
        });
        return prev.filter((mid) => mid !== id);
      }
      if (prev.length >= MAX_MATERIALS) {
        pushToast({
          message: `丹炉容积有限，最多投入 ${MAX_MATERIALS} 种药材`,
          tone: 'warning',
        });
        return prev;
      }
      if (material) {
        setSelectedMaterialMap((map) => ({
          ...map,
          [id]: material,
        }));
      }
      return [...prev, id];
    });
  };

  const displayEstimatedCost =
    selectedMaterialIds.length > 0 ? estimatedCost : null;
  const displayCanAfford = selectedMaterialIds.length > 0 ? canAfford : true;

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
          userPrompt: prompt,
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
      setSelectedMaterialMap({});
      setMaterialsRefreshKey((prev) => prev + 1);
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
      <div className="bg-paper flex min-h-screen items-center justify-center">
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
        <MaterialSelector
          cultivatorId={cultivator?.id}
          selectedMaterialIds={selectedMaterialIds}
          onToggleMaterial={toggleMaterial}
          selectedMaterialMap={selectedMaterialMap}
          isSubmitting={isSubmitting}
          pageSize={20}
          excludeMaterialTypes={[
            'ore',
            'gongfa_manual',
            'skill_manual',
          ]}
          refreshKey={materialsRefreshKey}
          showSelectedMaterialsPanel
          loadingText="正在检索储物袋中的灵草，请稍候……"
          emptyNoticeText="暂无可用于炼丹的灵草。"
          totalText={(total) => `共 ${total} 条灵草记录`}
        />
        <p className="text-ink-secondary mt-1 text-right text-xs">
          {selectedMaterialIds.length}/{MAX_MATERIALS}
        </p>
      </InkSection>

      <InkSection title="预计消耗">
        {displayEstimatedCost ? (
          <div className="bg-ink/5 border-ink/10 flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">
              灵石：
              <span className="font-bold text-amber-600">
                {displayEstimatedCost.spiritStones}
              </span>{' '}
              枚
            </span>
            <span
              className={`text-xs ${displayCanAfford ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {displayCanAfford ? '✓ 资源充足' : '✗ 灵石不足'}
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
              setSelectedMaterialMap({});
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
    </InkPageShell>
  );
}
