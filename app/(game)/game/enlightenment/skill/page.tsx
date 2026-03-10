'use client';

import { MaterialSelector } from '@/app/(game)/game/components/MaterialSelector';
import { InkPageShell, InkSection } from '@/components/layout';
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
import {
  getSkillDisplayInfo,
  getSkillElementInfo,
} from '@/lib/utils/effectDisplay';
import type { Material, Skill } from '@/types/cultivator';
import { getElementInfo } from '@/types/dictionaries';
import { usePathname, useRouter } from 'next/navigation';
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

export default function SkillCreationPage() {
  const router = useRouter();
  const { cultivator, refreshCultivator, note, isLoading } = useCultivator();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialMap, setSelectedMaterialMap] = useState<
    Record<string, Material>
  >({});
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdSkill, setCreatedSkill] = useState<Skill | null>(null);
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast, openDialog } = useInkUI();
  const pathname = usePathname();

  useEffect(() => {
    const checkPending = async () => {
      if (!cultivator) return;
      try {
        const res = await fetch('/api/craft/pending?type=create_skill');
        const data = await res.json();
        if (data.success && data.hasPending) {
          openDialog({
            title: '感应天机',
            content: (
              <p className="py-2">
                系统感应到道友先前推演了一门神通，但尚未将其纳入道基。是否立即前往处理？
              </p>
            ),
            confirmLabel: '继续推演',
            cancelLabel: '暂不处理',
            onConfirm: () => {
              router.push('/game/enlightenment/replace?type=create_skill');
            },
          });
        }
      } catch (e) {
        console.error('检查待定失败:', e);
      }
    };
    checkPending();
  }, [cultivator, openDialog, router]);

  // Fetch cost estimate when materials change
  useEffect(() => {
    if (selectedMaterialIds.length > 0) {
      fetchCostEstimate('create_skill', selectedMaterialIds);
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
          message: `悟道精力有限，最多参悟 ${MAX_MATERIALS} 种典籍`,
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

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (!prompt.trim()) {
      pushToast({
        message: '请注入神念，描述神通法门。',
        tone: 'warning',
      });
      return;
    }

    if (selectedMaterialIds.length === 0) {
      pushToast({ message: '请选择要参悟的功法典籍。', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    setStatus('感悟天地，推演法则……');
    setCreatedSkill(null);

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialIds: selectedMaterialIds,
          prompt: prompt,
          craftType: 'create_skill',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '推演失败');
      }

      const skill = result.data;

      // 检查是否需要替换
      if (skill.needs_replace) {
        pushToast({
          message: '神通已达上限，请选择一个进行替换',
          tone: 'default',
        });
        router.push('/game/enlightenment/replace?type=create_skill');
        return;
      }

      setCreatedSkill(skill);

      const successMessage = `神通【${skill.name}】推演成功！`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setPrompt('');
      setSelectedMaterialIds([]);
      setSelectedMaterialMap({});
      await refreshCultivator();
      setMaterialsRefreshKey((prev) => prev + 1);
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `走火入魔：${error.message}`
          : '推演失败，灵感中断。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">入定冥想中……</p>
      </div>
    );
  }

  const renderSkillExtraInfo = (skill: Skill) => {
    const elementInfo = getElementInfo(skill.element);
    const displayInfo = getSkillDisplayInfo(skill);

    return (
      <div className="space-y-1 text-sm">
        <div className="border-ink/50 flex justify-between border-b pb-1">
          <span className="opacity-70">元素</span>
          <span>
            {elementInfo.icon} {elementInfo.label}
          </span>
        </div>
        <div className="border-ink/50 flex justify-between border-b pb-1">
          <span className="opacity-70">目标</span>
          <span>{skill.target_self ? '自身' : '敌方'}</span>
        </div>
        <div className="border-ink/50 flex justify-between border-b pb-1">
          <span className="opacity-70">威力</span>
          <span>{displayInfo.power}%</span>
        </div>
        {displayInfo.healPercent !== undefined &&
          displayInfo.healPercent > 0 && (
            <div className="border-ink/50 flex justify-between border-b pb-1">
              <span className="opacity-70">治疗</span>
              <span>{displayInfo.healPercent}%</span>
            </div>
          )}
        <div className="border-ink/50 flex justify-between border-b pb-1">
          <span className="opacity-70">消耗</span>
          <span>{skill.cost || 0} 灵力</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">冷却</span>
          <span>{skill.cooldown || 0} 回合</span>
        </div>
      </div>
    );
  };

  return (
    <InkPageShell
      title="【神通推演】"
      subtitle="神念所至，万法皆生"
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
        <MaterialSelector
          cultivatorId={cultivator?.id}
          selectedMaterialIds={selectedMaterialIds}
          onToggleMaterial={toggleMaterial}
          selectedMaterialMap={selectedMaterialMap}
          isSubmitting={isSubmitting}
          pageSize={20}
          includeMaterialTypes={['skill_manual', 'manual']}
          refreshKey={materialsRefreshKey}
          showSelectedMaterialsPanel
          loadingText="正在检索可参悟典籍，请稍候……"
          emptyNoticeText="暂无可用于推演神通的典籍。"
          totalText={(total) => `共 ${total} 部可参悟典籍`}
        />
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

      <InkSection title="2. 注入神念">
        <div className="mb-4">
          <InkList dense>
            <InkListItem
              title="提示"
              description="描述你期望的神通形态，如“漫天剑雨”、“护身火罩”。"
            />
            <InkListItem
              title="示例"
              description="“我手持离火剑，想创造一门能召唤九条火龙护体并反击敌人的防御剑阵。”"
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
          hint="💡 描述越具体、越符合自身条件，成功率越高。"
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
            {isSubmitting ? '推演中……' : '开始推演'}
          </InkButton>
        </InkActionGroup>
      </InkSection>

      {status && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}

      {/* Result Modal */}
      {createdSkill && (
        <EffectDetailModal
          isOpen={!!createdSkill}
          onClose={() => setCreatedSkill(null)}
          icon={getSkillElementInfo(createdSkill).icon}
          name={createdSkill.name}
          badges={[
            createdSkill.grade && (
              <InkBadge key="g" tier={createdSkill.grade}>
                {getSkillElementInfo(createdSkill).typeName}
              </InkBadge>
            ),
            <InkBadge key="e" tone="default">
              {getElementInfo(createdSkill.element).label}
            </InkBadge>,
          ].filter(Boolean)}
          extraInfo={renderSkillExtraInfo(createdSkill)}
          effects={createdSkill.effects}
          description={createdSkill.description}
          effectTitle="神通效果"
          descriptionTitle="神通描述"
          footer={
            <InkButton onClick={() => setCreatedSkill(null)} className="w-full">
              了然于胸
            </InkButton>
          }
        />
      )}
    </InkPageShell>
  );
}

