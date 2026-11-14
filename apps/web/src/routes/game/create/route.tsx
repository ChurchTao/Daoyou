import { FateDetailModal } from '@app/components/feature/fates/FateDetailModal';
import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import { FateEffectInlineList } from '@app/components/feature/fates/FateEffectInlineList';
import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkDetailDrawer, InkNotice } from '@app/components/ui';
import { apiFetch } from '@app/lib/api/fetch';
import { cn } from '@app/lib/cn';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import {
  CHARACTER_GENERATION_DAILY_LIMIT,
  type CharacterGenerationQuota,
  type CharacterGenerationQuotaResponse,
  type GenerateCharacterResponse,
} from '@daoyou/contracts/character-generation';
import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import { getResourceLabel } from '@daoyou/game-content/presentation/concepts';
import type { Cultivator } from '@daoyou/game-domain/character';
import {
  characterDisplayRows,
  formatCharacterAttributeValue as formatAttributeValue,
  formatCharacterAttributeModifier as formatModifier,
  projectCharacterDisplay,
} from '@daoyou/game-rules/character/display';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

const MIN_PROMPT_LENGTH = 2;
const MAX_PROMPT_LENGTH = 200;
const LEAVE_MS = 450;

const countChars = (input: string): number => Array.from(input).length;

type Fate = Cultivator['pre_heaven_fates'][number];

/** 入世这一段的纸页：和演出同一张纸，同一种排版。 */
function GenesisPaper({
  leaving,
  children,
}: {
  leaving: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-paper text-ink fixed inset-0 z-30 overflow-y-auto transition-opacity ease-out',
        leaving ? 'opacity-0' : 'opacity-100',
      )}
      style={{ transitionDuration: `${LEAVE_MS}ms` }}
    >
      <div className="absolute top-[calc(var(--app-safe-top)+0.15rem)] right-[calc(env(safe-area-inset-right)+0.35rem)] z-10">
        <InkButton href="/game" className="text-ink/35 text-sm">
          返回主界
        </InkButton>
      </div>
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pt-[max(var(--app-safe-top),3rem)] pb-[max(env(safe-area-inset-bottom),2rem)] lg:px-12">
        {children}
      </div>
    </div>
  );
}

/** 一页里的一段：换页时淡入。 */
function Leaf({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-5 motion-safe:animate-[fade-in_0.7s_ease-out]">
      {children}
    </div>
  );
}

function Told({ children, past }: { children: ReactNode; past?: boolean }) {
  return (
    <p
      className={cn(
        'indent-[2em] text-lg leading-9',
        past ? 'text-ink-secondary' : 'text-ink/85',
      )}
    >
      {children}
    </p>
  );
}

function AttributeValue({
  type,
  base,
  modifier,
}: {
  type: Parameters<typeof formatAttributeValue>[0];
  base: number;
  modifier: number;
}) {
  return (
    <span className="text-ink-secondary text-right font-mono">
      {formatAttributeValue(type, base)}
      {modifier !== 0 ? (
        <span
          className={cn(
            'ml-1 font-semibold',
            modifier > 0 ? 'text-emerald-700' : 'text-violet-700',
          )}
        >
          {formatModifier(type, modifier)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * 入世：人间最后一夜 → 心念 → 入梦 → 这具身体 → 命格 → 醒来。
 * 全程一张纸，接着后面的主线演出。
 */
export default function CreatePage() {
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const session = usePlayerSession();
  const hasActiveCultivator = Boolean(session.data?.activeCultivator);
  const isLoading = session.loading;
  const [prologueSeen, setPrologueSeen] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [bodyAccepted, setBodyAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [tempCultivatorId, setTempCultivatorId] = useState<string | null>(null);
  const [availableFates, setAvailableFates] = useState<Fate[]>([]);
  const [selectedFateIndices, setSelectedFateIndices] = useState<number[]>([]);
  const [detailFate, setDetailFate] = useState<Fate | null>(null);
  const [remainingRerolls, setRemainingRerolls] = useState<number>(0);
  const [isGeneratingFates, setIsGeneratingFates] = useState(false);
  const [attributeDrawerOpen, setAttributeDrawerOpen] = useState(false);
  const [generationQuota, setGenerationQuota] =
    useState<CharacterGenerationQuota | null>(null);
  const trimmedPrompt = userPrompt.trim();
  const promptLength = countChars(trimmedPrompt);
  const promptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const promptTooShort =
    trimmedPrompt.length > 0 && promptLength < MIN_PROMPT_LENGTH;
  const quotaExhausted = generationQuota
    ? generationQuota.remaining <= 0
    : false;
  const remainingText = generationQuota
    ? `今天还能想 ${generationQuota.remaining} 次`
    : `每天最多想 ${CHARACTER_GENERATION_DAILY_LIMIT} 次`;
  const promptError = promptTooLong
    ? `写得太长了（${promptLength} 字，最多 ${MAX_PROMPT_LENGTH} 字）。`
    : promptTooShort
      ? `至少写 ${MIN_PROMPT_LENGTH} 个字。`
      : quotaExhausted
        ? '今天已经想了太多次，明天再来。'
        : undefined;
  const canWish =
    Boolean(trimmedPrompt) &&
    !promptTooLong &&
    !promptTooShort &&
    !quotaExhausted;

  useEffect(() => {
    if (isLoading || hasActiveCultivator) {
      return;
    }

    let cancelled = false;

    async function loadGenerationQuota() {
      try {
        const response = await apiFetch('/api/generate-character/quota');
        const result = (await response.json()) as
          CharacterGenerationQuotaResponse | { success: false; error?: string };

        if (!response.ok || !result.success) {
          throw new Error(
            ('error' in result && result.error) || '获取角色推演次数失败',
          );
        }

        if (!cancelled) {
          setGenerationQuota(result.data.quota);
        }
      } catch (error) {
        console.error('Load character generation quota failed:', error);
      }
    }

    void loadGenerationQuota();

    return () => {
      cancelled = true;
    };
  }, [hasActiveCultivator, isLoading]);

  const handleGenerateFates = async (tempId: string) => {
    setIsGeneratingFates(true);
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setConfirming(false);

    try {
      const response = await apiFetch('/api/generate-fates', {
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '生成气运失败';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setIsGeneratingFates(false);
    }
  };

  const handleGenerateCharacter = async () => {
    if (!canWish || isGenerating) return;

    setIsGenerating(true);
    setPlayer(null);
    setBodyAccepted(false);
    setConfirming(false);
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setTempCultivatorId(null);
    setRemainingRerolls(0);
    setAttributeDrawerOpen(false);

    try {
      const aiResponse = await apiFetch('/api/generate-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userInput: userPrompt }),
      });

      const aiResult = (await aiResponse.json()) as
        | GenerateCharacterResponse
        | {
            success: false;
            error?: string;
            quota?: CharacterGenerationQuota;
          };

      if (!aiResponse.ok || !aiResult.success) {
        if ('quota' in aiResult && aiResult.quota) {
          setGenerationQuota(aiResult.quota);
        }
        throw new Error(
          ('error' in aiResult && aiResult.error) || '生成角色失败',
        );
      }

      setPlayer(aiResult.data.cultivator);
      setTempCultivatorId(aiResult.data.tempCultivatorId);
      setGenerationQuota(aiResult.data.quota);

      await handleGenerateFates(aiResult.data.tempCultivatorId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '这一次没能成形，请再试一次。';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleFateSelection = (index: number) => {
    setConfirming(false);
    setSelectedFateIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else if (prev.length < 3) {
        return [...prev, index];
      }
      return prev;
    });
  };

  const handleSaveCharacter = async () => {
    if (!player || !tempCultivatorId || selectedFateIndices.length !== 3) {
      return;
    }

    setIsSaving(true);

    try {
      const saveResponse = await apiFetch('/api/save-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempCultivatorId,
          selectedFateIndices,
        }),
      });

      await consumeResourceMutation(saveResponse);

      // 纸页先淡下去，再接上主线的第一幕。
      setLeaving(true);
      window.setTimeout(() => {
        void navigate('/game/story', { replace: true, viewTransition: true });
      }, LEAVE_MS);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '没能醒过来，请再试一次。';
      pushToast({ message: errorMessage, tone: 'danger' });
      setIsSaving(false);
    }
  };

  const wishAgain = () => {
    setPlayer(null);
    setBodyAccepted(false);
    setConfirming(false);
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setRemainingRerolls(0);
    setTempCultivatorId(null);
    setAttributeDrawerOpen(false);
  };

  const previewStats = useMemo(() => {
    if (!player) return null;
    const panel = projectCharacterDisplay(player, null);
    return {
      maxHp: panel.maxHp,
      maxMp: panel.maxMp,
      ...characterDisplayRows(player.attributes, panel),
    };
  }, [player]);

  if (isLoading) {
    return <GameLoadingState message="检查道身状态……" variant="scene" />;
  }

  if (hasActiveCultivator && !isSaving && !leaving) {
    return (
      <div className="mx-auto max-w-3xl">
        <section className="border-battle-rule-strong bg-paper border border-dashed px-4 py-4 md:px-5 md:py-5">
          <InkNotice tone="warning">
            您已拥有道身，若想重修需先完成转世。
            <div className="mt-3">
              <InkButton href="/game">返回道身</InkButton>
            </div>
          </InkNotice>
        </section>
      </div>
    );
  }

  // 序章：人间的最后一夜。看完或跳过之后才写心念，不记进度。
  if (!prologueSeen) {
    return (
      <div className="fixed inset-0 z-30">
        <PerformancePlayer
          script={getPerformanceScript('v1-last-night')}
          context={{}}
          finalLabel="想那件事"
          exitLabel="跳过"
          onExit={() => setPrologueSeen(true)}
          onFinish={() => setPrologueSeen(true)}
        />
      </div>
    );
  }

  const stage = isGenerating
    ? 'dream'
    : !player
      ? 'wish'
      : bodyAccepted
        ? 'fate'
        : 'body';

  return (
    <GenesisPaper leaving={leaving}>
      {stage === 'wish' ? (
        <Leaf key="wish">
          <Told past>合上眼之前，你想了一件事。</Told>
          <label className="flex flex-col gap-3">
            <span className="text-ink text-xl leading-9">你想的是——</span>
            <textarea
              value={userPrompt}
              rows={4}
              onChange={(event) => setUserPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void handleGenerateCharacter();
                }
              }}
              placeholder="例：做一个靠炼丹翻身的落魄少主……"
              className="border-ink/25 text-ink placeholder:text-ink/30 focus:border-ink/60 w-full resize-none border-0 border-b bg-transparent py-2 text-xl leading-9 outline-none"
            />
          </label>
          <p className="text-ink-secondary text-sm leading-7">
            写下你想成为什么样的人，它决定你醒来时的样子。
            <span className="font-mono">
              {promptLength}/{MAX_PROMPT_LENGTH}
            </span>{' '}
            字 · {remainingText}
          </p>
          {promptError ? (
            <p role="alert" className="text-crimson text-sm leading-7">
              {promptError}
            </p>
          ) : null}
          <div>
            <InkButton
              variant="primary"
              disabled={!canWish}
              onClick={() => void handleGenerateCharacter()}
            >
              就想这个
            </InkButton>
          </div>
        </Leaf>
      ) : null}

      {stage === 'dream' ? (
        <Leaf key="dream">
          <Told past>合上眼之前，你想了一件事。</Told>
          <p className="text-ink-secondary text-right text-xl leading-9">
            「{trimmedPrompt}」
          </p>
          <Told>没有人答应你。</Told>
          <p className="indent-[2em] text-lg leading-9 text-ink/85 motion-safe:animate-[fade-in_1.6s_ease-out]">
            你睡着了。
          </p>
          <p
            role="status"
            className="text-ink-secondary mt-4 text-center text-sm motion-safe:animate-pulse"
          >
            正在入梦，需要十几秒……
          </p>
        </Leaf>
      ) : null}

      {stage === 'body' && player ? (
        <Leaf key="body">
          <Told past>梦里，有什么东西应了你。</Told>
          <Told>它给你备下的，是这样一个人——</Told>
          <div className="border-ink/20 bg-ink/[0.03] border px-5 py-5">
            <p className="font-heading text-ink text-center text-4xl leading-tight">
              {player.name}
            </p>
            <p className="text-ink-secondary mt-2 text-center text-sm tracking-[0.18em]">
              {player.gender} · <span className="font-mono">{player.age}</span>{' '}
              岁 · 寿元 <span className="font-mono">{player.lifespan}</span>
            </p>
            <dl className="mt-5 space-y-3 text-lg leading-9">
              <div>
                <dt className="text-ink-secondary text-sm">出身</dt>
                <dd>{player.origin || '来历不详'}</dd>
              </div>
              {player.personality ? (
                <div>
                  <dt className="text-ink-secondary text-sm">性情</dt>
                  <dd>{player.personality}</dd>
                </div>
              ) : null}
              {player.background ? (
                <div>
                  <dt className="text-ink-secondary text-sm">来历</dt>
                  <dd>{player.background}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-ink-secondary text-sm">灵根</dt>
                <dd>
                  {player.spiritual_roots.length > 0
                    ? player.spiritual_roots.map((root, index) => (
                        <span key={root.element}>
                          {index > 0 ? '　' : ''}
                          {root.element}
                          <span className="text-ink-secondary ml-1 font-mono text-base">
                            {root.strength ?? '--'}
                          </span>
                        </span>
                      ))
                    : '无'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-secondary text-sm">
                  {getResourceLabel('hp')}与{getResourceLabel('mp')}
                </dt>
                <dd className="font-mono">
                  {previewStats?.maxHp} / {previewStats?.maxMp}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setAttributeDrawerOpen(true)}
              className="text-ink-secondary hover:text-ink mt-4 min-h-11 cursor-pointer text-sm underline underline-offset-4"
            >
              看看根基
            </button>
          </div>
          <Told past>这些事，你醒来以后一样也不会记得。</Told>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <InkButton variant="primary" onClick={() => setBodyAccepted(true)}>
              就是这个人
            </InkButton>
            <InkButton variant="secondary" onClick={wishAgain}>
              换一个念头
            </InkButton>
          </div>
          <p className="text-ink-secondary text-sm leading-7">
            换一个念头会用掉一次机会。{remainingText}。
          </p>
        </Leaf>
      ) : null}

      {stage === 'fate' && player ? (
        <Leaf key="fate">
          <Told past>它给你备下的，是{player.name}这个人。</Told>
          <Told>它又在这个人身上落了几笔。留得下的，只有三笔。</Told>
          <div className="flex items-center justify-between gap-4">
            <p className="text-ink-secondary text-sm">
              已留{' '}
              <span className="font-mono">{selectedFateIndices.length}/3</span>
            </p>
            {tempCultivatorId ? (
              <InkButton
                variant="secondary"
                disabled={remainingRerolls <= 0}
                pending={isGeneratingFates}
                pendingLabel="正在重落……"
                onClick={() => void handleGenerateFates(tempCultivatorId)}
              >
                {`重落一遍（还能 ${remainingRerolls} 次）`}
              </InkButton>
            ) : null}
          </div>

          {isGeneratingFates ? (
            <p
              role="status"
              className="text-ink-secondary py-6 text-center text-sm motion-safe:animate-pulse"
            >
              笔还没落定……
            </p>
          ) : availableFates.length > 0 ? (
            <ul className="border-ink/10 flex flex-col border-t">
              {availableFates.map((fate, idx) => {
                const isSelected = selectedFateIndices.includes(idx);
                const full = !isSelected && selectedFateIndices.length >= 3;
                const display = toFateDisplayModel(fate);
                return (
                  <li
                    key={fate.name + idx}
                    className="border-ink/10 flex items-start gap-3 border-b py-3"
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      disabled={full}
                      onClick={() => toggleFateSelection(idx)}
                      className="group focus-visible:outline-crimson relative min-h-11 min-w-0 flex-1 cursor-pointer bg-transparent pl-7 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'border-crimson absolute top-[0.85rem] left-1 size-2.5 rounded-full border',
                          isSelected && 'bg-crimson',
                        )}
                      />
                      <span
                        className={cn(
                          'text-xl leading-9',
                          isSelected ? 'text-ink' : 'text-ink/80',
                        )}
                      >
                        {fate.name}
                        <span className="text-ink-secondary ml-2 text-sm">
                          {fate.quality}
                        </span>
                      </span>
                      <FateEffectInlineList lines={display.previewLines} />
                      {fate.description ? (
                        <span className="text-ink-secondary mt-1 block text-sm leading-7">
                          {fate.description}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailFate(fate)}
                      className="text-ink-secondary hover:text-ink min-h-11 shrink-0 cursor-pointer px-1 text-sm underline underline-offset-4"
                    >
                      细看
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-ink-secondary py-4 text-center text-sm">
              这一遍什么也没落下，请重落一遍。
            </p>
          )}

          {confirming ? (
            <div className="flex flex-col gap-3">
              <p className="text-ink text-lg leading-9">
                醒来之后，这个人和这三笔就不能再改了。
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <InkButton
                  variant="primary"
                  pending={isSaving}
                  pendingLabel="正在醒来……"
                  onClick={() => void handleSaveCharacter()}
                >
                  醒来
                </InkButton>
                <InkButton
                  variant="secondary"
                  disabled={isSaving}
                  onClick={() => setConfirming(false)}
                >
                  再想想
                </InkButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <InkButton
                variant="primary"
                disabled={selectedFateIndices.length !== 3}
                onClick={() => setConfirming(true)}
              >
                就这三笔
              </InkButton>
              <InkButton
                variant="secondary"
                onClick={() => {
                  setBodyAccepted(false);
                  setConfirming(false);
                }}
              >
                回头看看这个人
              </InkButton>
            </div>
          )}
        </Leaf>
      ) : null}

      <InkDetailDrawer
        isOpen={attributeDrawerOpen}
        onClose={() => setAttributeDrawerOpen(false)}
        title="根基"
        description="这个人眼下的根基与各项战斗属性。"
        size="md"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ...(previewStats?.primaryRows ?? []),
            ...(previewStats?.secondaryAll ?? []),
          ].map((item) => (
            <div
              key={item.type}
              className="border-ink/15 flex items-baseline justify-between gap-3 border-b border-dashed py-2 text-sm"
            >
              <span className="text-ink">{item.label}</span>
              <AttributeValue
                type={item.type}
                base={item.baseValue}
                modifier={item.modifier}
              />
            </div>
          ))}
        </div>
        {player?.balance_notes ? (
          <p className="text-ink-secondary mt-4 text-sm leading-7">
            推演说明：{player.balance_notes}
          </p>
        ) : null}
      </InkDetailDrawer>

      <FateDetailModal
        isOpen={detailFate !== null}
        onClose={() => setDetailFate(null)}
        fate={detailFate}
      />
    </GenesisPaper>
  );
}
