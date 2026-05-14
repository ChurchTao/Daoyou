import { LingGen } from '@app/components/func';
import { FateDetailModal } from '@app/components/feature/fates/FateDetailModal';
import {
  FateEffectInlineList,
} from '@app/components/feature/fates/FateEffectInlineList';
import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import {
  AbilityMetaLine,
  AffixInlineList,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { InkPageShell, InkSection } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
  InkStatusBar,
  InkTag,
} from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { attrLabel } from '@shared/engine/battle-v5/effects/affixText/attributes';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { cn } from '@shared/lib/cn';
import type { Cultivator } from '@shared/types/cultivator';
import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';


const MIN_PROMPT_LENGTH = 2;
const MAX_PROMPT_LENGTH = 200;

const countChars = (input: string): number => Array.from(input).length;

const PRIMARY_ATTR_ORDER: AttributeType[] = [
  AttributeType.SPIRIT,
  AttributeType.VITALITY,
  AttributeType.SPEED,
  AttributeType.WILLPOWER,
  AttributeType.WISDOM,
];

const SECONDARY_ATTR_ORDER: AttributeType[] = [
  AttributeType.ATK,
  AttributeType.DEF,
  AttributeType.MAGIC_ATK,
  AttributeType.MAGIC_DEF,
  AttributeType.CRIT_RATE,
  AttributeType.CRIT_DAMAGE_MULT,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
];

const PERCENT_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_RATE,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
]);

const MULTIPLIER_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_DAMAGE_MULT,
]);

function formatAttributeValue(attrType: AttributeType, value: number): string {
  if (PERCENT_ATTRS.has(attrType)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (MULTIPLIER_ATTRS.has(attrType)) {
    return `${value.toFixed(2)}x`;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatModifier(attrType: AttributeType, value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (PERCENT_ATTRS.has(attrType)) {
    return `${sign}${(abs * 100).toFixed(1)}%`;
  }
  if (MULTIPLIER_ATTRS.has(attrType)) {
    return `${sign}${abs.toFixed(2)}x`;
  }
  const rendered = Number.isInteger(abs) ? `${abs}` : abs.toFixed(2);
  return `${sign}${rendered}`;
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

/**
 * 角色创建页 —— 「凝气篇」
 */
export default function CreatePage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { pushToast, openDialog } = useInkUI();
  const { hasActiveCultivator, isLoading, refresh } = useCultivator();
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [tempCultivatorId, setTempCultivatorId] = useState<string | null>(null);
  const [availableFates, setAvailableFates] = useState<
    Cultivator['pre_heaven_fates']
  >([]);
  const [selectedFateIndices, setSelectedFateIndices] = useState<number[]>([]);
  const [detailFate, setDetailFate] = useState<
    Cultivator['pre_heaven_fates'][number] | null
  >(null);
  const [remainingRerolls, setRemainingRerolls] = useState<number>(0);
  const [isGeneratingFates, setIsGeneratingFates] = useState(false);
  const [showAllAttributes, setShowAllAttributes] = useState(false);
  const trimmedPrompt = userPrompt.trim();
  const promptLength = countChars(trimmedPrompt);
  const promptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const promptTooShort =
    trimmedPrompt.length > 0 && promptLength < MIN_PROMPT_LENGTH;
  const promptHint = `已输入 ${promptLength}/${MAX_PROMPT_LENGTH} 字 · Cmd/Ctrl + Enter 可快速提交`;
  const promptError = promptTooLong
    ? `角色描述过长（当前 ${promptLength} 字，最多 ${MAX_PROMPT_LENGTH} 字）。`
    : promptTooShort
      ? `角色描述至少需要 ${MIN_PROMPT_LENGTH} 个字。`
      : undefined;

  // 生成气运
  const handleGenerateFates = async (tempId: string) => {
    setIsGeneratingFates(true);
    setAvailableFates([]);
    setSelectedFateIndices([]);

    try {
      const response = await fetch('/api/generate-fates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempId }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '生成气运失败');
      }

      setAvailableFates(result.data.fates);
      setRemainingRerolls(result.data.remainingRerolls);
      if (result.data.remainingRerolls < 5) {
        pushToast({ message: '天机变幻，气运已更易。', tone: 'success' });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '生成气运失败';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setIsGeneratingFates(false);
    }
  };

  // 生成角色
  const handleGenerateCharacter = async () => {
    if (!trimmedPrompt) {
      pushToast({ message: '请输入角色描述', tone: 'warning' });
      return;
    }

    if (promptLength < MIN_PROMPT_LENGTH) {
      pushToast({
        message: `角色描述至少需要 ${MIN_PROMPT_LENGTH} 个字。`,
        tone: 'warning',
      });
      return;
    }

    if (promptLength > MAX_PROMPT_LENGTH) {
      pushToast({
        message: `角色描述过长（当前 ${promptLength} 字，最多 ${MAX_PROMPT_LENGTH} 字）。`,
        tone: 'warning',
      });
      return;
    }

    setIsGenerating(true);
    setPlayer(null);
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setTempCultivatorId(null);
    setRemainingRerolls(0);
    setShowAllAttributes(false);

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

      pushToast({
        message: '灵气汇聚，真形初现。正在推演气运...',
        tone: 'success',
      });

      // 自动生成第一次气运
      await handleGenerateFates(aiResult.data.tempCultivatorId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '生成角色失败，请检查控制台';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setIsGenerating(false);
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
      pushToast({ message: '请选择3个先天气运', tone: 'warning' });
      return;
    }

    setIsSaving(true);

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
      await refresh();
      navigate('/game');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '保存角色失败，请检查控制台';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSaveCharacter = () => {
    if (!player || !tempCultivatorId) {
      return;
    }

    if (selectedFateIndices.length !== 3) {
      pushToast({ message: '请选择3个先天气运', tone: 'warning' });
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
    setRemainingRerolls(0);
    setTempCultivatorId(null);
    setShowAllAttributes(false);
  };

  const previewStats = useMemo(() => {
    if (!player) return null;
    const { unit, maxHp, maxMp } = getCultivatorDisplayAttributes(player);
    const orderedAttributes = [...PRIMARY_ATTR_ORDER, ...SECONDARY_ATTR_ORDER];
    const displayAttributes = orderedAttributes.map((attrType) => {
      const baseValue = unit.attributes.getBaseValue(attrType);
      const finalValue = unit.attributes.getValue(attrType);
      const modifier = finalValue - baseValue;
      return {
        type: attrType,
        label: attrLabel(attrType),
        baseValue,
        finalValue,
        modifier,
      };
    });

    return {
      maxHp,
      maxMp,
      primaryRows: displayAttributes.slice(0, PRIMARY_ATTR_ORDER.length),
      secondaryAll: displayAttributes.slice(PRIMARY_ATTR_ORDER.length),
    };
  }, [player]);

  const secondaryVisible = showAllAttributes
    ? previewStats?.secondaryAll ?? []
    : previewStats?.secondaryAll.slice(0, 4) ?? [];
  const secondaryRows = chunkPairs(secondaryVisible);

  if (isLoading) {
    return (
      <InkPageShell
        title="【凝气篇】"
        subtitle="以心念唤道，凝气成形"
        backHref="/game"
        currentPath={pathname}
        showBottomNav={false}
      >
        <InkNotice tone="info">检查道身状态……</InkNotice>
      </InkPageShell>
    );
  }

  if (hasActiveCultivator) {
    return (
      <InkPageShell
        title="【凝气篇】"
        subtitle="每位修士仅限一具真身"
        backHref="/game"
        currentPath={pathname}
        showBottomNav={false}
      >
        <InkNotice tone="warning">
          您已拥有道身，若想重修需先完成转世。
          <div className="mt-3">
            <InkButton href="/game">返回道身</InkButton>
          </div>
        </InkNotice>
      </InkPageShell>
    );
  }

  return (
    <InkPageShell
      title="【凝气篇】"
      subtitle="以心念唤道，凝气成形"
      backHref="/game"
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
          hint={promptHint}
          error={promptError}
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
              disabled={
                isGenerating ||
                !trimmedPrompt ||
                promptTooLong ||
                promptTooShort
              }
            >
              {isGenerating ? '灵气汇聚中…' : '凝气成形'}
            </InkButton>
          )}
          {player && (
            <InkButton onClick={handleRegenerate} variant="secondary">
              重凝
            </InkButton>
          )}
        </InkActionGroup>
      </InkSection>

      {player ? (
        <>
          <InkSection title="【道身】">
            <InkList dense>
              <InkListItem
                title={
                  <span>
                    ☯ 姓名：{player.name}
                    <InkBadge tier={player.realm} className="ml-2">
                      {player.realm_stage}
                    </InkBadge>
                  </span>
                }
                meta={
                  <div className="py-1">
                    <p>身世：{player.origin || '散修'}</p>
                    <p>性格：{player.personality}</p>
                    {player.background ? <p>背景：{player.background}</p> : null}
                    {player.balance_notes ? (
                      <p>天道评语：{player.balance_notes}</p>
                    ) : null}
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
                        value: `${previewStats?.maxHp}`,
                        icon: '❤️',
                      },
                      {
                        label: '灵力：',
                        value: `${previewStats?.maxMp}`,
                        icon: '⚡️',
                      },
                    ]}
                  />
                }
              />
            </InkList>
          </InkSection>

          <LingGen spiritualRoots={player.spiritual_roots || []} />

          <InkSection title="【根基属性】">
            <div className="border-ink/30 bg-bgpaper overflow-x-auto border-dashed border">
              <table className="border-ink/10 w-full border-collapse text-sm">
                <tbody>
                  {previewStats?.primaryRows.map((item) => (
                    <tr
                      key={item.type}
                      className="border-ink/10 border-b last:border-b-0"
                    >
                      <td className="text-crimson w-[40%] py-2 pl-3 pr-2 font-semibold">
                        {item.label}
                      </td>
                      <td className="text-ink-secondary py-2 pr-3 text-right">
                        <span>{formatAttributeValue(item.type, item.baseValue)}</span>
                        {item.modifier !== 0 && (
                          <>
                            {' '}
                            <span
                              className={cn(
                                'font-semibold',
                                item.modifier > 0
                                  ? 'text-emerald-700'
                                  : 'text-violet-700',
                              )}
                            >
                              {formatModifier(item.type, item.modifier)}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {secondaryRows.map((pair, rowIdx) => (
                    <tr
                      key={`sec-${rowIdx}`}
                      className="border-ink/10 border-b last:border-b-0"
                    >
                      {pair.map((item, colIdx) => (
                        <td
                          key={item.type}
                          colSpan={pair.length === 1 ? 2 : 1}
                          className={cn(
                            'min-w-0 w-1/2 py-2 pl-3 pr-2 align-top',
                            colIdx === 0 &&
                              pair.length === 2 &&
                              'border-ink/10 border-r',
                          )}
                        >
                          <div className="flex min-w-0 items-baseline justify-between gap-2">
                            <span className="text-ink shrink-0">{item.label}</span>
                            <span className="text-ink-secondary min-w-0 text-right">
                              <span>
                                {formatAttributeValue(item.type, item.baseValue)}
                              </span>
                              {item.modifier !== 0 && (
                                <>
                                  {' '}
                                  <span
                                    className={cn(
                                      'font-semibold',
                                      item.modifier > 0
                                        ? 'text-emerald-700'
                                        : 'text-violet-700',
                                    )}
                                  >
                                    {formatModifier(item.type, item.modifier)}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(previewStats?.secondaryAll.length ?? 0) > 4 && (
              <div className="mt-3">
                <InkButton
                  onClick={() => setShowAllAttributes((prev) => !prev)}
                  className="text-sm"
                >
                  {showAllAttributes ? '收起次级属性' : '展开全部属性'}
                </InkButton>
              </div>
            )}
            <p className="text-ink-secondary mt-2 text-xs">
              当前境界：{player.realm}
            </p>
          </InkSection>

          <InkSection title="【先天命格】">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-ink-secondary text-sm">{`已选 ${selectedFateIndices.length}/3`}</span>
              {tempCultivatorId && (
                <InkButton
                  variant="secondary"
                  disabled={isGeneratingFates || remainingRerolls <= 0}
                  onClick={() => handleGenerateFates(tempCultivatorId)}
                >
                  {isGeneratingFates
                    ? '推演中...'
                    : `逆天改命 (${remainingRerolls})`}
                </InkButton>
              )}
            </div>

            {isGeneratingFates ? (
              <div className="text-ink-secondary py-8 text-center">
                <p>正在推演天机...</p>
              </div>
            ) : availableFates.length > 0 ? (
              <InkList>
                {availableFates.map((fate, idx) => {
                  const isSelected = selectedFateIndices.includes(idx);
                  const fateDisplay = toFateDisplayModel(fate);
                  return (
                    <div
                      key={fate.name + idx}
                      className={`ink-selectable ${
                        isSelected ? 'ink-selectable-active' : ''
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full text-left"
                        onClick={() => toggleFateSelection(idx)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleFateSelection(idx);
                          }
                        }}
                      >
                        <ItemCard
                          name={fate.name}
                          quality={fate.quality}
                          meta={<FateEffectInlineList lines={fateDisplay.previewLines} />}
                          description={fate.description}
                          actions={
                            <div
                              className="flex gap-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <InkButton
                                variant="secondary"
                                onClick={() => setDetailFate(fate)}
                              >
                                详情
                              </InkButton>
                              {isSelected ? (
                                <InkTag tone="good">已取</InkTag>
                              ) : null}
                            </div>
                          }
                          layout="col"
                        />
                      </div>
                    </div>
                  );
                })}
              </InkList>
            ) : (
              <div className="text-ink-secondary py-4 text-center">
                <p>暂无气运，请尝试逆天改命</p>
              </div>
            )}
          </InkSection>
          <FateDetailModal
            isOpen={detailFate !== null}
            onClose={() => setDetailFate(null)}
            fate={detailFate}
          />

          <InkSection title="【功法】">
            {(player.cultivations || []).length === 0 ? (
              <InkNotice>尚无功法</InkNotice>
            ) : (
              <InkList>
                {player.cultivations.map((technique) => {
                  const product = toProductDisplayModel(
                    technique as ProductRecordLike,
                  );
                  return (
                    <ItemCard
                      key={technique.id ?? technique.name}
                      icon="📘"
                      name={technique.name}
                      quality={technique.quality}
                      badgeExtra={
                        technique.element ? (
                          <InkBadge tone="default">{technique.element}</InkBadge>
                        ) : undefined
                      }
                      meta={<AffixInlineList affixes={product.affixes} />}
                      description={technique.description}
                      layout="col"
                    />
                  );
                })}
              </InkList>
            )}
          </InkSection>

          <InkSection title="【神通】">
            {(player.skills || []).length === 0 ? (
              <InkNotice>尚无神通</InkNotice>
            ) : (
              <InkList>
                {player.skills.map((skill) => {
                  const product = toProductDisplayModel(
                    skill as ProductRecordLike,
                  );
                  return (
                    <ItemCard
                      key={skill.id ?? skill.name}
                      icon="📜"
                      name={skill.name}
                      quality={skill.quality}
                      badgeExtra={
                        <InkBadge tone="default">{skill.element}</InkBadge>
                      }
                      meta={
                        <div className="space-y-1">
                          <AffixInlineList affixes={product.affixes} />
                          <AbilityMetaLine projection={product.projection} />
                        </div>
                      }
                      description={skill.description}
                      layout="col"
                    />
                  );
                })}
              </InkList>
            )}
          </InkSection>

          <InkActionGroup align="center">
            <InkButton onClick={handleRegenerate} variant="secondary">
              重凝
            </InkButton>
            <InkButton
              variant="primary"
              onClick={confirmSaveCharacter}
              disabled={isSaving}
            >
              {isSaving ? '入世中…' : '保存道身'}
            </InkButton>
          </InkActionGroup>
        </>
      ) : (
        <InkNotice>以心念描摹真身，生成后即可参阅。</InkNotice>
      )}
    </InkPageShell>
  );
}
