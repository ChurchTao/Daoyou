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
import {
  formatAllEffects,
  getSkillDisplayInfo,
  getSkillElementInfo,
} from '@/lib/utils/effectDisplay';
import { Material, Skill } from '@/types/cultivator';
import { getElementInfo } from '@/types/dictionaries';
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

export default function SkillCreationPage() {
  const { cultivator, refreshCultivator, note, isLoading } = useCultivator();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdSkill, setCreatedSkill] = useState<Skill | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<CostEstimate | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  // Fetch cost estimate when materials change
  useEffect(() => {
    if (selectedMaterialIds.length > 0) {
      fetchCostEstimate('create_skill', selectedMaterialIds);
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
        message: '请注入神念，描述神通法门。',
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
        (m) => m.id === id && m.type === 'manual',
      ),
    );

    if (!hasManual) {
      pushToast({
        message: '参悟必须以功法典籍(manual)为核心。',
        tone: 'warning',
      });
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
      setCreatedSkill(skill);

      const successMessage = `神通【${skill.name}】推演成功！`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setPrompt('');
      setSelectedMaterialIds([]);
      await refreshCultivator();
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
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">入定冥想中……</p>
      </div>
    );
  }

  // Filter materials to only show manual type
  const validMaterials = cultivator?.inventory?.materials.filter(
    (m) => m.type === 'manual',
  ) || [];

  const createdSkillRender = (createdSkill: Skill) => {
    if (!createdSkill) return null;
    const typeInfo = getSkillElementInfo(createdSkill);
    const skillTypeInfo = {
      label: typeInfo.typeName,
      icon: typeInfo.icon,
      description: createdSkill.description || '',
    };
    const elementInfo = getElementInfo(createdSkill.element);
    const displayInfo = getSkillDisplayInfo(createdSkill);
    const effectsList = formatAllEffects(createdSkill.effects);

    return (
      <div className="space-y-4 p-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-ink-primary">
            {skillTypeInfo.icon}
            {createdSkill.name}
          </h3>
          <InkBadge tier={createdSkill.grade}>{skillTypeInfo.label}</InkBadge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-ink-secondary">
          <div>
            元素：{elementInfo.icon}
            {elementInfo.label}
          </div>
          <div>
            目标：{createdSkill.target_self ? '自身' : '敌方'}
          </div>
          <div>威力：{displayInfo.power}%</div>
          {displayInfo.healPercent !== undefined && displayInfo.healPercent > 0 && (
            <div>治疗：{displayInfo.healPercent}%</div>
          )}
          <div>消耗：{createdSkill.cost || 0}灵力</div>
          <div>冷却：{createdSkill.cooldown || 0} 回合</div>
        </div>

        {effectsList.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-bold text-ink-primary">效果列表</div>
            <div className="bg-ink/5 p-3 rounded-lg border border-ink/10 space-y-1">
              {effectsList.map((effect, index) => (
                <div key={index} className="text-sm text-ink-secondary">
                  {effect.icon && <span className="mr-1">{effect.icon}</span>}
                  <span>{effect.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-ink/5 p-3 rounded-lg border border-ink/10 text-sm leading-relaxed whitespace-pre-wrap">
          {createdSkill.description || '此神通玄妙异常，无法言喻。'}
        </div>

        <div className="flex justify-end">
          <InkButton onClick={() => setCreatedSkill(null)}>了然于胸</InkButton>
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

      <InkSection title="预计消耗">
        {estimatedCost ? (
          <div className="flex items-center justify-between p-3 bg-ink/5 rounded-lg border border-ink/10">
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
      <InkModal isOpen={!!createdSkill} onClose={() => setCreatedSkill(null)}>
        {createdSkill && createdSkillRender(createdSkill)}
      </InkModal>

      {/* Material Detail Modal */}
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
