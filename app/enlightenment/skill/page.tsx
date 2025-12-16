'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { InkModal } from '@/components/InkModal'; // Imported InkModal
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { Skill } from '@/types/cultivator'; // Assuming Skill type exists
import {
  getElementInfo,
  getSkillTypeInfo,
  getStatusEffectInfo,
} from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function SkillCreationPage() {
  const { cultivator, finalAttributes, refreshInventory, note, isLoading } =
    useCultivatorBundle();
  const [prompt, setPrompt] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdSkill, setCreatedSkill] = useState<Skill | null>(null); // State for modal
  const { pushToast } = useInkUI();
  const pathname = usePathname();

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
          cultivatorId: cultivator.id,
          materialIds: [], // Skills use no materials
          prompt: prompt,
          craftType: 'create_skill',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '推演失败');
      }

      const skill = result.data;
      setCreatedSkill(skill); // Open modal with result

      const successMessage = `神通【${skill.name}】推演成功！`;
      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setPrompt('');
      await refreshInventory();
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

  // Calculate Context for Display
  const roots =
    cultivator?.spiritual_roots
      .map((r) => `${r.element}(${r.strength})`)
      .join(', ') || '无';

  const equippedWeaponId = cultivator?.equipped.weapon;
  const equippedWeapon = cultivator?.inventory.artifacts.find(
    (a) => a.id === equippedWeaponId,
  );
  const weaponDisplayName = equippedWeapon
    ? `${equippedWeapon.name} [${equippedWeapon.element}]`
    : '赤手空拳';

  const createdSkillRender = (createdSkill: Skill) => {
    if (!createdSkill) return null;
    const skillTypeInfo = getSkillTypeInfo(createdSkill.type);
    const elementInfo = getElementInfo(createdSkill.element);
    const statusInfo = createdSkill.effect
      ? getStatusEffectInfo(createdSkill.effect)
      : null;

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
          <div>威力：{createdSkill.power}</div>
          <div>消耗：{createdSkill.cost || 0}灵力</div>
          <div>冷却：{createdSkill.cooldown || 0} 回合</div>
          {createdSkill.effect && (
            <div>
              附加效果：{statusInfo?.icon}
              {statusInfo?.label}
              {createdSkill.duration ? `（${createdSkill.duration}回合）` : ''}
            </div>
          )}
        </div>

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
      backHref="/enlightenment"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/enlightenment">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            推演消耗大量心力，请慎重。
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="1. 自身底蕴">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <InkList dense>
            <InkListItem
              title="当前境界"
              description={`${cultivator?.realm} ${cultivator?.realm_stage}`}
            />
            <InkListItem
              title="悟性"
              description={`${finalAttributes?.wisdom} （决定神通品阶上限）`}
            />
          </InkList>
          <InkList dense>
            <InkListItem
              title="灵根属性"
              description={`${roots} （决定元素亲和）`}
            />
            <InkListItem
              title="手持兵刃"
              description={`${weaponDisplayName} （决定施法形态）`}
            />
          </InkList>
        </div>
        <InkNotice tone="info">
          提示：创造的神通若与灵根、武器不匹配，威力将大打折扣，甚至推演失败。
        </InkNotice>
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
            }}
            disabled={isSubmitting}
          >
            重置
          </InkButton>
          <InkButton
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !prompt.trim()}
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
    </InkPageShell>
  );
}
