'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
  InkStatRow,
  InkStatusBar,
  InkTag,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import type { Attributes, Cultivator } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getAttributeInfo,
  getElementInfo,
  getSkillTypeInfo,
  getStatusLabel,
} from '@/types/dictionaries';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const getCombatRating = (cultivator: Cultivator | null): string => {
  if (!cultivator?.attributes) return '--';
  const { vitality, spirit, wisdom, speed, willpower } = cultivator.attributes;
  return Math.round(
    (vitality + spirit + wisdom + speed + willpower) / 5,
  ).toString();
};

const BASE_ATTRIBUTE_KEYS: Array<keyof Cultivator['attributes']> = [
  'vitality',
  'spirit',
  'wisdom',
  'speed',
  'willpower',
];

/**
 * 角色创建页 —— 「凝气篇」
 */
export default function CreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const pathname = usePathname();
  const { pushToast, openDialog } = useInkUI();
  const [userPrompt, setUserPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [tempCultivatorId, setTempCultivatorId] = useState<string | null>(null);
  const [availableFates, setAvailableFates] = useState<
    Cultivator['pre_heaven_fates']
  >([]);
  const [selectedFateIndices, setSelectedFateIndices] = useState<number[]>([]);
  const [balanceNotes, setBalanceNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingCultivator, setHasExistingCultivator] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // 检查用户是否已有角色
  useEffect(() => {
    if (!user) {
      setCheckingExisting(false);
      return;
    }

    const checkExistingCultivator = async () => {
      try {
        const response = await fetch('/api/cultivators');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
          setHasExistingCultivator(true);
        }
      } catch (error) {
        console.error('检查角色失败:', error);
      } finally {
        setCheckingExisting(false);
      }
    };

    checkExistingCultivator();
  }, [user]);

  // 生成角色
  const handleGenerateCharacter = async () => {
    if (!userPrompt.trim()) {
      setError('请输入角色描述');
      pushToast({ message: '请输入角色描述', tone: 'warning' });
      return;
    }

    setLoading(true);
    setError(null);
    setPlayer(null);
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setBalanceNotes([]);

    try {
      // 调用AI生成角色
      const aiResponse = await fetch('/api/generate-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userInput: userPrompt }),
      });

      const aiResult = await aiResponse.json();

      if (!aiResponse.ok || !aiResult.success) {
        throw new Error(aiResult.error || '生成角色失败');
      }

      // 保存临时角色ID和角色数据
      setPlayer(aiResult.data.cultivator);
      setTempCultivatorId(aiResult.data.tempCultivatorId);
      setAvailableFates(aiResult.data.preHeavenFates || []);
      setSelectedFateIndices([]);
      setBalanceNotes(aiResult.data.balanceNotes || []);
      pushToast({ message: '灵气汇聚，真形初现。', tone: 'success' });
    } catch (error) {
      console.error('生成角色失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : '生成角色失败，请检查控制台';
      setError(errorMessage);
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  // 切换气运选择
  const toggleFateSelection = (index: number) => {
    setSelectedFateIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else if (prev.length < 3) {
        return [...prev, index];
      }
      return prev;
    });
  };

  // 保存角色到正式表
  const handleSaveCharacter = async () => {
    if (!player || !tempCultivatorId) {
      return;
    }

    if (selectedFateIndices.length !== 3) {
      setError('请选择3个先天气运');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 调用保存角色API
      const saveResponse = await fetch('/api/save-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempCultivatorId,
          selectedFateIndices,
        }),
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok || !saveResult.success) {
        throw new Error(saveResult.error || '保存角色失败');
      }

      // 保存成功，跳转到首页
      pushToast({ message: '道友真形已落地，速回主界。', tone: 'success' });
      router.push('/');
    } catch (error) {
      console.error('保存角色失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : '保存角色失败，请检查控制台';
      setError(errorMessage);
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const confirmSaveCharacter = () => {
    if (!player || !tempCultivatorId) {
      return;
    }

    if (selectedFateIndices.length !== 3) {
      const warning = '请选择3个先天气运';
      setError(warning);
      pushToast({ message: warning, tone: 'warning' });
      return;
    }

    openDialog({
      title: '以此真身入世？',
      content: (
        <div className="space-y-1 text-sm">
          <p>姓名：{player.name}</p>
          <p>
            境界：{player.realm}
            {player.realm_stage}
          </p>
          <p>
            灵根：
            {player.spiritual_roots.length > 0
              ? player.spiritual_roots
                  .map(
                    (root) =>
                      `${root.element}${root.grade ? `·${root.grade}` : ''}（强度：${root.strength ?? '--'}）`,
                  )
                  .join('｜')
              : '无'}
          </p>
        </div>
      ),
      confirmLabel: '入世',
      cancelLabel: '再想想',
      onConfirm: () => {
        void handleSaveCharacter();
      },
    });
  };

  // 重新生成
  const handleRegenerate = () => {
    setPlayer(null);
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setBalanceNotes([]);
    setError(null);
  };

  const finalAttrsMemo = useMemo(() => {
    if (!player) return null;
    // 计算最终属性
    const finalAttrsResult = calculateFinalAttributes(player);
    const finalAttrs = finalAttrsResult.final;
    const breakdown = finalAttrsResult.breakdown;
    const maxHp = 80 + finalAttrs.vitality;
    const maxMp = finalAttrs.spirit;
    return {
      finalAttrsResult,
      finalAttrs,
      breakdown,
      maxHp,
      maxMp,
    };
  }, [player]);

  if (checkingExisting) {
    return (
      <InkPageShell
        title="【凝气篇】"
        subtitle="以心念唤道，凝气成形"
        backHref="/"
        currentPath={pathname}
        showBottomNav={false}
      >
        <InkNotice tone="info">检查道身状态……</InkNotice>
      </InkPageShell>
    );
  }

  if (hasExistingCultivator) {
    return (
      <InkPageShell
        title="【凝气篇】"
        subtitle="每位修士仅限一具真身"
        backHref="/"
        currentPath={pathname}
        showBottomNav={false}
      >
        <InkNotice tone="warning">
          您已拥有道身，若想重修需先完成转世。
          <div className="mt-3">
            <InkButton href="/">返回道身</InkButton>
          </div>
        </InkNotice>
      </InkPageShell>
    );
  }

  return (
    <InkPageShell
      title="【凝气篇】"
      subtitle="以心念唤道，凝气成形"
      backHref="/"
      currentPath={pathname}
      showBottomNav={false}
    >
      <InkSection title="【以心念唤道】">
        <InkInput
          multiline
          rows={6}
          value={userPrompt}
          onChange={(value) => setUserPrompt(value)}
          placeholder="例：我想成为一位靠炼丹逆袭的废柴少主……"
          hint="💡 Cmd/Ctrl + Enter 可快速提交"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              handleGenerateCharacter();
            }
          }}
        />
        <InkActionGroup align="center">
          {!player && (
            <InkButton
              variant="primary"
              onClick={handleGenerateCharacter}
              disabled={loading || !userPrompt.trim()}
            >
              {loading ? '灵气汇聚中…' : '凝气成形'}
            </InkButton>
          )}
          {player && (
            <InkButton onClick={handleRegenerate} variant="secondary">
              重凝
            </InkButton>
          )}
        </InkActionGroup>
      </InkSection>

      {error && <InkNotice tone="danger">{error}</InkNotice>}

      {player ? (
        <>
          <InkSection title="【真形一瞥】">
            <InkList dense>
              <InkListItem
                title={
                  <span>
                    ☯ 姓名：{player.name}
                    <InkBadge
                      tone="accent"
                      className="ml-2"
                    >{`境界 · ${player.realm}${player.realm_stage}`}</InkBadge>
                  </span>
                }
                meta={
                  <div className="py-1">
                    <p>身世：{player.origin || '散修'}</p>
                    <p>性格：{player.personality}</p>
                  </div>
                }
                description={
                  <InkStatusBar
                    className="mt-2 grid! grid-cols-3! gap-2"
                    items={[
                      { label: '年龄：', value: player.age, icon: '⏳' },
                      { label: '寿元：', value: player.lifespan, icon: '🔮' },
                      {
                        label: '性别：',
                        value: player.gender,
                        icon: player.gender === '男' ? '♂' : '♀',
                      },
                      {
                        label: '气血：',
                        value: `${finalAttrsMemo?.maxHp}`,
                        icon: '❤️',
                      },
                      {
                        label: '灵力：',
                        value: `${finalAttrsMemo?.maxMp}`,
                        icon: '⚡️',
                      },
                    ]}
                  />
                }
              />
            </InkList>
          </InkSection>

          {player.spiritual_roots?.length > 0 && (
            <InkSection title="【灵根】">
              <InkList>
                {player.spiritual_roots.map((root, idx) => (
                  <InkListItem
                    key={root.element + idx}
                    title={
                      <div className="flex items-center">
                        <span>
                          {getElementInfo(root.element).icon} {root.element}
                        </span>
                        <InkBadge tier={root.grade} />
                      </div>
                    }
                    meta={`强度：${root.strength}`}
                  />
                ))}
              </InkList>
            </InkSection>
          )}

          <InkSection title="【根基属性】">
            {Object.entries(player.attributes).map(([key, baseValue]) => {
              const attrKey = key as keyof Attributes;
              const attrInfo = getAttributeInfo(attrKey);
              const finalValue = finalAttrsMemo?.finalAttrs[attrKey];
              const fateMod = finalAttrsMemo?.breakdown.fromFates[attrKey];
              const cultMod =
                finalAttrsMemo?.breakdown.fromCultivations[attrKey];
              const equipMod = finalAttrsMemo?.breakdown.fromEquipment[attrKey];

              const detailParts = [
                fateMod !== 0
                  ? `命格 ${fateMod && fateMod > 0 ? '+' : ''}${fateMod}`
                  : undefined,
                cultMod !== 0
                  ? `功法 ${cultMod && cultMod > 0 ? '+' : ''}${cultMod}`
                  : undefined,
                equipMod !== 0
                  ? `法宝 ${equipMod && equipMod > 0 ? '+' : ''}${equipMod}`
                  : undefined,
              ].filter(Boolean);

              return (
                <InkStatRow
                  key={key}
                  label={`${attrInfo.icon} ${attrInfo.label}`}
                  base={baseValue}
                  final={finalValue}
                  detail={
                    detailParts.length ? detailParts.join('｜') : undefined
                  }
                />
              );
            })}
            <p className="mt-2 text-xs text-ink-secondary">
              境界上限：{finalAttrsMemo?.breakdown.cap}（当前境界：
              {player.realm}）
            </p>
          </InkSection>

          {(balanceNotes.length > 0 || player?.balance_notes) && (
            <InkSection title="【天道评语】">
              {balanceNotes.length > 0 && (
                <InkList dense>
                  {balanceNotes.map((note) => (
                    <InkListItem key={note} title={`· ${note}`} />
                  ))}
                </InkList>
              )}
              {player?.balance_notes && (
                <InkNotice>{player.balance_notes}</InkNotice>
              )}
            </InkSection>
          )}

          {availableFates.length > 0 && (
            <InkSection
              title={`【先天气运】（已选 ${selectedFateIndices.length}/3）`}
            >
              <InkList>
                {availableFates.map((fate, idx) => {
                  const isSelected = selectedFateIndices.includes(idx);
                  return (
                    <div
                      key={fate.name + idx}
                      className={`ink-selectable ${
                        isSelected ? 'ink-selectable-active' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFateSelection(idx)}
                      >
                        <InkListItem
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
                          meta={
                            formatAttributeBonusMap(fate.attribute_mod) ||
                            '无属性加成'
                          }
                          description={fate.description}
                          actions={
                            isSelected ? (
                              <InkTag tone="good">已取</InkTag>
                            ) : null
                          }
                        />
                      </button>
                    </div>
                  );
                })}
              </InkList>
            </InkSection>
          )}

          {player.cultivations && player.cultivations.length > 0 && (
            <InkSection title="【功法】">
              <InkList>
                {player.cultivations.map((cult, idx) => (
                  <InkListItem
                    key={cult.name + idx}
                    title={
                      <div className="flex items-center">
                        <span>📜 {cult.name} </span>
                        {cult.grade && <InkBadge tier={cult.grade} />}
                      </div>
                    }
                    meta={`需求境界：${cult.required_realm}`}
                    description={
                      formatAttributeBonusMap(cult.bonus) || '无属性加成'
                    }
                  />
                ))}
              </InkList>
            </InkSection>
          )}

          {player.skills && player.skills.length > 0 && (
            <InkSection title="【神通】">
              <InkList>
                {player.skills.map((skill) => {
                  const skillInfo = getSkillTypeInfo(skill.type);
                  const typeIcon = skillInfo.icon;
                  const typeName = skillInfo.label;

                  return (
                    <InkListItem
                      key={skill.id || skill.name}
                      title={
                        <div className="flex items-center">
                          <span>
                            {typeIcon} {skill.name}·{skill.element}
                          </span>
                          <InkBadge tier={skill.grade}>{typeName}</InkBadge>
                        </div>
                      }
                      description={`威力：${skill.power}｜冷却：${skill.cooldown}回合${
                        skill.cost ? `｜消耗：${skill.cost} 灵力` : ''
                      }${
                        skill.effect
                          ? `｜效果：${getStatusLabel(skill.effect)}${
                              skill.duration ? `（${skill.duration}回合）` : ''
                            }`
                          : ''
                      }`}
                    />
                  );
                })}
              </InkList>
            </InkSection>
          )}

          <InkSection title="【战力评估】">
            <InkNotice tone="info">
              推演战力：{getCombatRating(player)}（以基础属性估算）
            </InkNotice>
            {player.background && (
              <p className="mt-2 text-ink-secondary italic">
                「{player.background}」
              </p>
            )}
          </InkSection>

          <InkActionGroup align="center">
            <InkButton onClick={handleRegenerate} variant="secondary">
              重凝
            </InkButton>
            <InkButton variant="primary" onClick={confirmSaveCharacter}>
              保存道身
            </InkButton>
          </InkActionGroup>
        </>
      ) : (
        <InkNotice>以心念描摹真身，生成后即可参阅。</InkNotice>
      )}
    </InkPageShell>
  );
}
