'use client';

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
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { GongFa, LingGen, ShenTong } from '@/components/func';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Attributes } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getAttributeInfo,
  getAttributeLabel,
  getEffectText,
  getEquipmentSlotInfo,
} from '@/types/dictionaries';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CultivatorPage() {
  const { cultivator, inventory, skills, equipped, isLoading } =
    useCultivatorBundle();
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useInkUI();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  const handleReincarnate = async () => {
    if (!cultivator) return;
    try {
      const res = await fetch('/api/cultivators/active-reincarnate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cultivatorId: cultivator.id }),
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
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">道友真形尚在凝聚……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell
        title="【道我真形】"
        subtitle="需先觉醒方可照鉴真形"
        backHref="/"
        actions={
          <InkButton href="/create" variant="primary">
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
  const finalAttrsResult = calculateFinalAttributes(cultivator);
  const finalAttrs = finalAttrsResult.final;
  const breakdown = finalAttrsResult.breakdown;
  const maxHp = finalAttrsResult.maxHp;
  const maxMp = finalAttrsResult.maxMp;

  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id ||
        equipped.armor === item.id ||
        equipped.accessory === item.id),
  );

  // 获取命格属性加成说明
  const getFateModText = (fate: (typeof cultivator.pre_heaven_fates)[0]) => {
    const mods = Object.entries(fate.attribute_mod)
      .filter(([, v]) => v !== undefined && v !== 0)
      .map(([k, v]) => {
        const label = getAttributeLabel(k as keyof Attributes);
        return `${label} ${v > 0 ? '+' : ''}${v}`;
      });
    return mods.length > 0 ? mods.join('，') : '无属性加成';
  };

  return (
    <InkPageShell
      title={`道我真形`}
      subtitle="大道五十，我遁其一"
      backHref="/"
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回</InkButton>
          <InkButton
            onClick={() =>
              setDialog({
                id: 'reincarnate-confirm',
                title: '轮回重修',
                content: (
                  <div className="space-y-2">
                    <p className="font-bold text-lg text-crimson">
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
              <InkListItem
                key={fate.name + idx}
                title={
                  <div className="flex items-center">
                    <span>
                      {fate.type === '吉' ? '🍀' : '😈'} {fate.name}
                    </span>
                    {fate.quality && (
                      <InkBadge tier={fate.quality}>气运</InkBadge>
                    )}
                  </div>
                }
                meta={`加成：${getFateModText(fate)}`}
                description={fate.description}
                highlight={fate.type === '吉'}
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
          const fateMod = breakdown.fromFates[attrKey];
          const cultMod = breakdown.fromCultivations[attrKey];
          const equipMod = breakdown.fromEquipment[attrKey];

          const detailParts = [
            fateMod !== 0
              ? `命格 ${fateMod > 0 ? '+' : ''}${fateMod}`
              : undefined,
            cultMod !== 0
              ? `功法 ${cultMod > 0 ? '+' : ''}${cultMod}`
              : undefined,
            equipMod !== 0
              ? `法宝 ${equipMod > 0 ? '+' : ''}${equipMod}`
              : undefined,
          ].filter(Boolean);

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
              className="cursor-pointer hover:bg-ink/5 rounded px-2 -mx-2 transition-colors"
            >
              <InkStatRow
                label={`${attrInfo.icon} ${attrInfo.label}`}
                base={baseValue}
                final={finalValue}
                detail={detailParts.length ? detailParts.join('｜') : undefined}
              />
            </div>
          );
        })}
        <p className="mt-2 text-xs text-ink-secondary">
          境界上限：{breakdown.cap}（当前境界：{cultivator.realm}
          ）(点击属性可查看详情)
        </p>
      </InkSection>

      <InkSection title="【当前所御法宝】">
        {equippedItems.length > 0 ? (
          <InkList>
            {equippedItems.map((item) => {
              const slotInfo = getEquipmentSlotInfo(item.slot);
              const bonusText =
                formatAttributeBonusMap(item.bonus) || '无属性加成';
              const effectText =
                item.special_effects?.map((e) => getEffectText(e)).join('\n') ||
                '';

              return (
                <InkListItem
                  key={item.id}
                  title={
                    <div>
                      <span>{`${slotInfo.icon} ${item.name}`}</span>
                      <InkBadge
                        tier={item.quality}
                      >{`${item.element} · ${slotInfo.label}`}</InkBadge>
                    </div>
                  }
                  description={`${bonusText}${effectText ? '\n' + effectText : ''}`}
                />
              );
            })}
          </InkList>
        ) : (
          <InkNotice>尚未佩戴法宝</InkNotice>
        )}
        <div className="mt-3">
          <InkButton href="/inventory" className="text-sm">
            前往储物袋更换装备 →
          </InkButton>
        </div>
      </InkSection>

      <GongFa cultivations={cultivator.cultivations || []} />

      <ShenTong
        skills={skills}
        footer={
          skills.length > 0 ? (
            <div className="mt-3">
              <InkButton href="/skills" className="text-sm">
                所有神通一览 →
              </InkButton>
            </div>
          ) : undefined
        }
      />

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </InkPageShell>
  );
}
