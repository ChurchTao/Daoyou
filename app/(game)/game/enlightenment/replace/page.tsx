'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkActionGroup, InkButton, InkList, InkNotice } from '@/components/ui';
import { EffectCard } from '@/components/ui/EffectCard';
import {
  getSkillDisplayInfo,
  getSkillElementInfo,
} from '@/lib/utils/effectDisplay';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { CultivationTechnique, Skill } from '@/types/cultivator';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

function ReplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const craftType = searchParams.get('type') as
    | 'create_skill'
    | 'create_gongfa';
  const { cultivator, refreshCultivator } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pendingItem, setPendingItem] = useState<
    Skill | CultivationTechnique | null
  >(null);
  const [selectedOldId, setSelectedOldId] = useState<string | null>(null);
  const [acceptNew, setAcceptNew] = useState(true);

  const isSkill = craftType === 'create_skill';

  const fetchPendingStatus = useCallback(async () => {
    if (!craftType) return;
    try {
      const res = await fetch(`/api/craft/pending?type=${craftType}`);
      const data = await res.json();
      if (data.success && data.hasPending) {
        setPendingItem(data.item);
      } else {
        router.back();
      }
    } catch (e) {
      console.error('获取待定状态失败:', e);
    } finally {
      setInitializing(false);
    }
  }, [craftType, router]);

  useEffect(() => {
    if (cultivator) {
      fetchPendingStatus();
    }
  }, [cultivator, fetchPendingStatus]);

  const handleConfirm = async (isAbandon: boolean) => {
    if (!isAbandon && !selectedOldId) {
      pushToast({ message: '请勾选需要舍弃的旧法门', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/craft/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          craftType,
          replaceId: isAbandon ? null : selectedOldId,
          abandon: isAbandon,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '确认失败');

      openDialog({
        title: isAbandon ? '尘缘尽散' : '领悟成功',
        content: <p>{data.message}</p>,
        onConfirm: async () => {
          await refreshCultivator();
          router.push(isSkill ? '/game/skills' : '/game/techniques');
        },
        confirmLabel: '善哉',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '操作失败';
      pushToast({ message: msg, tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  if (initializing || !cultivator) return null;
  if (!pendingItem) return <InkNotice>无可领悟之法</InkNotice>;

  const existingItems = isSkill ? cultivator.skills : cultivator.cultivations;

  return (
    <InkPageShell
      title={isSkill ? '神通突围' : '功法破障'}
      subtitle="万法随心，取舍有道"
      backHref="/game/enlightenment"
    >
      <div className="space-y-6 pb-12">
        <InkNotice>
          请勾选需要<b>舍弃的旧法门</b>和需要<b>承接的新机缘</b>。<br />
          确认后，未选之新法将消散归于虚无，未选之旧法将固守道身。
        </InkNotice>

        <InkSection title={`【现有${isSkill ? '神通' : '功法'}】（勾选以舍弃）`}>
          <InkList>
            {existingItems.map((item) => {
              const isSelected = selectedOldId === item.id;
              const { icon: typeIcon } = isSkill
                ? getSkillElementInfo(item as Skill)
                : { icon: '📜' };
              const displayInfo = isSkill
                ? getSkillDisplayInfo(item as Skill)
                : null;

              return (
                <EffectCard
                  key={item.id}
                  highlight={isSelected}
                  icon={typeIcon}
                  name={item.name}
                  quality={item.grade}
                  effects={item.effects}
                  meta={
                    isSkill && displayInfo
                      ? `威力：${displayInfo.power}｜冷却：${(item as Skill).cooldown}回合${
                          (item as Skill).cost
                            ? `｜消耗：${(item as Skill).cost} 灵力`
                            : ''
                        }`
                      : undefined
                  }
                  badgeExtra={
                    !isSkill ? (
                      <span className="text-ink-secondary border-ink/20 bg-ink/5 rounded-xs border px-1 text-xs">
                        {(item as CultivationTechnique).required_realm}
                      </span>
                    ) : undefined
                  }
                  description={item.description}
                  actions={
                    <InkButton
                      variant={isSelected ? 'primary' : 'secondary'}
                      onClick={() =>
                        setSelectedOldId(isSelected ? null : item.id || null)
                      }
                    >
                      {isSelected ? '将舍弃' : '固守'}
                    </InkButton>
                  }
                  layout="col"
                />
              );
            })}
          </InkList>
        </InkSection>

        <InkSection title={`【新领悟】（勾选以承接）`}>
          <InkList>
            {(() => {
              const { icon: typeIcon } = isSkill
                ? getSkillElementInfo(pendingItem as Skill)
                : { icon: '📜' };
              const displayInfo = isSkill
                ? getSkillDisplayInfo(pendingItem as Skill)
                : null;

              return (
                <EffectCard
                  highlight={acceptNew}
                  icon={typeIcon}
                  name={pendingItem.name}
                  quality={pendingItem.grade}
                  effects={pendingItem.effects}
                  meta={
                    isSkill && displayInfo
                      ? `威力：${displayInfo.power}｜冷却：${(pendingItem as Skill).cooldown}回合${
                          (pendingItem as Skill).cost
                            ? `｜消耗：${(pendingItem as Skill).cost} 灵力`
                            : ''
                        }`
                      : undefined
                  }
                  badgeExtra={
                    !isSkill ? (
                      <span className="text-ink-secondary border-ink/20 bg-ink/5 rounded-xs border px-1 text-xs">
                        {(pendingItem as CultivationTechnique).required_realm}
                      </span>
                    ) : undefined
                  }
                  description={pendingItem.description}
                  actions={
                    <InkButton
                      variant={acceptNew ? 'primary' : 'outline'}
                      onClick={() => setAcceptNew(!acceptNew)}
                    >
                      {acceptNew ? '已定' : '契合'}
                    </InkButton>
                  }
                  layout="col"
                />
              );
            })()}
          </InkList>
        </InkSection>

        <InkActionGroup>
          <InkButton
            variant="outline"
            onClick={() => {
              openDialog({
                title: '确认放弃',
                content: (
                  <p>
                    道友当真要放弃此次造化之机？
                    <br />
                    一旦放弃，灵感将消散归于虚无。
                  </p>
                ),
                onConfirm: () => handleConfirm(true),
                confirmLabel: '确认放弃',
                cancelLabel: '再想想',
              });
            }}
            disabled={loading}
          >
            放弃领悟
          </InkButton>
          <InkButton
            variant="primary"
            onClick={() => handleConfirm(false)}
            disabled={loading || !selectedOldId || !acceptNew}
          >
            {loading ? '演化中...' : '确认替换'}
          </InkButton>
        </InkActionGroup>
      </div>
    </InkPageShell>
  );
}

export default function ReplacePage() {
  return (
    <Suspense fallback={<InkNotice>感知天机中...</InkNotice>}>
      <ReplaceContent />
    </Suspense>
  );
}
