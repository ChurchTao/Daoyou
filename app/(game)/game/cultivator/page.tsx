'use client';

import { LingGen } from '@/components/func';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkDialog,
  type InkDialogState,
  InkList,
  InkListItem,
  InkNotice,
  InkStatRow,
  InkStatusBar,
} from '@/components/ui';
import { ItemCard } from '@/components/ui/ItemCard';
import { getCultivatorDisplayAttributes } from '@/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Attributes } from '@/types/cultivator';
import { getAttributeInfo, getEquipmentSlotInfo } from '@/types/dictionaries';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CultivatorPage() {
  const { cultivator, inventory, skills, equipped, isLoading } =
    useCultivator();
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useInkUI();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  const handleReincarnate = async () => {
    if (!cultivator) return;
    try {
      const res = await fetch('/api/cultivator/active-reincarnate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '兵解失败');

      // 成功后跳转到转世页
      router.push('/reincarnate');
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : '兵解失败',
        tone: 'danger',
      });
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">道友真形尚在凝聚……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell
        title="【道我真形】"
        subtitle="需先觉醒方可照鉴真形"
        backHref="/game"
        actions={
          <InkButton href="/game/create" variant="primary">
            觉醒灵根
          </InkButton>
        }
      >
        <div className="text-center">
          尚无角色资料，先去觉醒灵根，再来凝视真形。
        </div>
      </InkPageShell>
    );
  }

  // 计算最终属性
  const { finalAttributes: finalAttrs, maxHp, maxMp } =
    getCultivatorDisplayAttributes(cultivator);

  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id ||
        equipped.armor === item.id ||
        equipped.accessory === item.id),
  );

  return (
    <InkPageShell
      title={`道我真形`}
      subtitle="大道五十，我遁其一"
      backHref="/game"
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回</InkButton>
          <InkButton
            onClick={() =>
              setDialog({
                id: 'reincarnate-confirm',
                title: '轮回重修',
                content: (
                  <div className="space-y-2">
                    <p className="text-crimson text-lg font-bold">
                      道友当真要轮回重修？
                    </p>
                    <p>
                      轮回后，当前修为将尽数散去，
                      <span className="text-crimson">
                        角色状态变为「已陨落」
                      </span>
                      。
                    </p>
                    <p>
                      但可保留部分前世记忆（名字、故事）进入轮回，开启新的一世。
                    </p>
                    <p className="text-sm opacity-60">此操作不可撤销。</p>
                  </div>
                ),
                confirmLabel: '轮回',
                cancelLabel: '不可',
                onConfirm: handleReincarnate,
              })
            }
            variant="secondary"
          >
            转世重修
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="【道身】">
        <InkList dense>
          <InkListItem
            title={
              <span>
                ☯ 姓名：{cultivator.name}
                <InkBadge tier={cultivator.realm} className="ml-2">
                  {cultivator.realm_stage}
                </InkBadge>
              </span>
            }
            meta={
              <div className="py-1">
                <p>身世：{cultivator.origin || '散修'}</p>
                <p>性格：{cultivator.personality}</p>
                <p>背景：{cultivator.background}</p>
                {cultivator?.balance_notes && (
                  <p>天道评语：{cultivator.balance_notes}</p>
                )}
              </div>
            }
            description={
              <InkStatusBar
                className="mt-2 grid! grid-cols-3! gap-2"
                items={[
                  { label: '年龄：', value: cultivator.age, icon: '⏳' },
                  { label: '寿元：', value: cultivator.lifespan, icon: '🔮' },
                  {
                    label: '性别：',
                    value: cultivator.gender,
                    icon: cultivator.gender === '男' ? '♂' : '♀',
                  },
                  { label: '气血：', value: maxHp, icon: '❤️' },
                  { label: '灵力：', value: maxMp, icon: '⚡️' },
                ]}
              />
            }
          />
        </InkList>
      </InkSection>

      <LingGen spiritualRoots={cultivator.spiritual_roots || []} />

      {cultivator.pre_heaven_fates?.length > 0 && (
        <InkSection title="【先天命格】">
          <InkList>
            {cultivator.pre_heaven_fates.map((fate, idx) => (
              <ItemCard
                key={fate.name + idx}
                name={fate.name}
                quality={fate.quality}
                description={fate.description}
              />
            ))}
          </InkList>
        </InkSection>
      )}

      <InkSection title="【根基属性】">
        {Object.entries(cultivator.attributes).map(([key, baseValue]) => {
          const attrKey = key as keyof Attributes;
          const attrInfo = getAttributeInfo(attrKey);
          const finalValue = finalAttrs[attrKey];

          return (
            <div
              key={key}
              onClick={() =>
                setDialog({
                  id: `attr-help-${key}`,
                  title: `${attrInfo.icon} ${attrInfo.label}`,
                  content: attrInfo.description,
                  confirmLabel: '明悟',
                })
              }
              className="hover:bg-ink/5 -mx-2 cursor-pointer rounded px-2 transition-colors"
            >
              <InkStatRow
                label={`${attrInfo.icon} ${attrInfo.label}`}
                base={baseValue}
                final={finalValue}
              />
            </div>
          );
        })}
        <p className="text-ink-secondary mt-2 text-xs">
          当前境界：{cultivator.realm}（点击属性可查看详情）
        </p>
      </InkSection>

      <InkSection title="【当前所御法宝】">
        {equippedItems.length > 0 ? (
          <InkList>
            {equippedItems.map((item) => {
              const slotInfo = getEquipmentSlotInfo(item.slot);

              return (
                <ItemCard
                  key={item.id}
                  icon={slotInfo.icon}
                  name={item.name}
                  quality={item.quality}
                  badgeExtra={
                    <InkBadge tone="default">{`${item.element} · ${slotInfo.label}`}</InkBadge>
                  }
                  description={item.description}
                />
              );
            })}
          </InkList>
        ) : (
          <InkNotice>尚未佩戴法宝</InkNotice>
        )}
        <div className="mt-3">
          <InkButton href="/game/inventory" className="text-sm">
            前往储物袋更换装备 →
          </InkButton>
        </div>
      </InkSection>

      <InkSection title="【功法】">
        {(cultivator.cultivations || []).length === 0 ? (
          <InkNotice>尚无功法</InkNotice>
        ) : (
          <InkList>
            {cultivator.cultivations.map((c) => (
              <InkListItem
                key={c.id ?? c.name}
                title={c.name}
                description={c.description}
              />
            ))}
          </InkList>
        )}
      </InkSection>

      <InkSection title="【神通】">
        {skills.length === 0 ? (
          <InkNotice>尚无神通</InkNotice>
        ) : (
          <>
            <InkList>
              {skills.map((s) => (
                <InkListItem
                  key={s.id ?? s.name}
                  title={`${s.name} (${s.element})`}
                  description={s.description}
                />
              ))}
            </InkList>
            <div className="mt-3">
              <InkButton href="/game/skills" className="text-sm">
                所有神通一览 →
              </InkButton>
            </div>
          </>
        )}
      </InkSection>

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </InkPageShell>
  );
}
