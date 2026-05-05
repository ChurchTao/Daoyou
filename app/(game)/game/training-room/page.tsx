'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatAttributeModal } from '@/components/feature/battle/v5/CombatAttributeModal';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { CombatResultDialog } from '@/components/feature/battle/v5/CombatResultDialog';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import {
  AttributeType,
  ModifierType,
} from '@/engine/battle-v5/core/types';
import {
  getAllCombatStatusTemplates,
} from '@/engine/battle-v5/setup/CombatStatusTemplateRegistry';
import type {
  PersistentCombatStatusV5,
  TrainingRoomModifierDraft,
} from '@/engine/battle-v5/setup/types';
import { ATTR_LABELS } from '@/engine/battle-v5/effects/affixText/attributes';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { BattleRecord } from '@/lib/services/battleResult';
import { simulateBattleV5 } from '@/lib/services/simulateBattleV5';
import {
  buildTrainingBattleInitConfig,
  createDefaultTrainingRoomDraft,
  parseTrainingRoomStorage,
  TRAINING_ROOM_STORAGE_KEY,
  TRAINING_ROOM_STORAGE_VERSION,
  type TrainingRoomDraft,
  type TrainingRoomPreset,
} from '@/lib/training-room/config';
import type { Cultivator } from '@/types/cultivator';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useCombatPlayer } from '../battle/hooks/useCombatPlayer';

const STATUS_TEMPLATES = getAllCombatStatusTemplates();
const ATTRIBUTE_OPTIONS = Object.values(AttributeType);
const MODIFIER_TYPE_OPTIONS = [
  ModifierType.FIXED,
  ModifierType.ADD,
  ModifierType.MULTIPLY,
  ModifierType.FINAL,
  ModifierType.OVERRIDE,
] as const;

const SELECT_CLASSNAME =
  'w-full rounded-md border border-ink/20 bg-transparent px-3 py-2 text-sm focus:border-crimson focus:outline-none';
const INPUT_CLASSNAME =
  'w-full rounded-md border border-ink/20 bg-transparent px-3 py-2 text-sm focus:border-crimson focus:outline-none';

const PRIMARY_ATTRIBUTE_FIELDS = [
  { key: 'spirit', label: '灵力' },
  { key: 'vitality', label: '体魄' },
  { key: 'speed', label: '身法' },
  { key: 'willpower', label: '神识' },
  { key: 'wisdom', label: '悟性' },
] as const;

const MODIFIER_TYPE_LABELS: Record<(typeof MODIFIER_TYPE_OPTIONS)[number], string> = {
  [ModifierType.FIXED]: '直接增加',
  [ModifierType.ADD]: '按比例增加',
  [ModifierType.MULTIPLY]: '按倍数调整',
  [ModifierType.FINAL]: '设为最终值',
  [ModifierType.OVERRIDE]: '直接指定',
};

const MODIFIER_VALUE_HINTS: Record<
  (typeof MODIFIER_TYPE_OPTIONS)[number],
  string
> = {
  [ModifierType.FIXED]: '直接填写要增加或减少的数值。',
  [ModifierType.ADD]: '填写比例，例如 0.2 代表增加 20%。',
  [ModifierType.MULTIPLY]: '填写倍数，例如 1.5 代表调整为 1.5 倍。',
  [ModifierType.FINAL]: '直接填写调整后的最终数值。',
  [ModifierType.OVERRIDE]: '忽略原值，直接指定为这个数值。',
};

function createStatusRef(templateId?: string): PersistentCombatStatusV5 {
  return {
    version: 1,
    templateId: templateId ?? STATUS_TEMPLATES[0]?.id ?? 'weakness',
    stacks: 1,
  };
}

function createModifierDraft(): TrainingRoomModifierDraft {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `training-mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attrType: AttributeType.ATK,
    type: ModifierType.FIXED,
    value: 10,
  };
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type="number"
        className={INPUT_CLASSNAME}
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
      {hint ? <span className="text-xs text-ink/55">{hint}</span> : null}
    </label>
  );
}

function ResourceStateEditor({
  label,
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  label: string;
  mode: 'absolute' | 'percent';
  value: number;
  onModeChange: (mode: 'absolute' | 'percent') => void;
  onValueChange: (value: number) => void;
}) {
  const displayValue = mode === 'percent' ? value * 100 : value;

  return (
    <div className="rounded-md border border-dashed border-ink/10 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <select
          className={SELECT_CLASSNAME}
          value={mode}
          onChange={(event) =>
            onModeChange(event.target.value as 'absolute' | 'percent')
          }
        >
          <option value="percent">按比例</option>
          <option value="absolute">按数值</option>
        </select>
      </div>
      <NumberField
        label={mode === 'percent' ? `${label}百分比` : `${label}数值`}
        value={displayValue}
        step={mode === 'percent' ? 1 : 1}
        min={0}
        hint={mode === 'percent' ? '输入 0-100，对应当前资源占上限的比例。' : undefined}
        onChange={(nextValue) =>
          onValueChange(mode === 'percent' ? nextValue / 100 : nextValue)
        }
      />
    </div>
  );
}

function StatusRefEditor({
  title,
  statuses,
  onChange,
}: {
  title: string;
  statuses: PersistentCombatStatusV5[];
  onChange: (statuses: PersistentCombatStatusV5[]) => void;
}) {
  return (
    <InkCard variant="elevated" className="rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-ink/55">开战时会附带这些状态。</p>
        </div>
        <InkButton
          variant="secondary"
          onClick={() => onChange([...statuses, createStatusRef()])}
        >
          新增状态
        </InkButton>
      </div>

      {statuses.length === 0 ? (
        <p className="text-sm text-ink/55">暂未添加状态。</p>
      ) : (
        <div className="space-y-3">
          {statuses.map((status, index) => (
            <div
              key={`${status.templateId}-${index}`}
              className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-ink/10 p-3 md:grid-cols-[minmax(0,2fr)_120px_auto]"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink/55">状态</span>
                <select
                  className={SELECT_CLASSNAME}
                  value={status.templateId}
                  onChange={(event) => {
                    const next = [...statuses];
                    next[index] = {
                      ...status,
                      templateId: event.target.value,
                    };
                    onChange(next);
                  }}
                >
                  {STATUS_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <NumberField
                label="层数"
                value={status.stacks}
                min={1}
                onChange={(nextValue) => {
                  const next = [...statuses];
                  next[index] = {
                    ...status,
                    stacks: Math.max(1, Math.floor(nextValue)),
                  };
                  onChange(next);
                }}
              />

              <div className="flex items-end justify-end">
                <InkButton
                  variant="ghost"
                  onClick={() =>
                    onChange(statuses.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  删除
                </InkButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </InkCard>
  );
}

function ModifierEditor({
  modifiers,
  onChange,
}: {
  modifiers: TrainingRoomModifierDraft[];
  onChange: (modifiers: TrainingRoomModifierDraft[]) => void;
}) {
  return (
    <InkCard variant="elevated" className="rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">木桩属性调整</p>
        </div>
        <InkButton
          variant="secondary"
          onClick={() => onChange([...modifiers, createModifierDraft()])}
        >
          新增调整
        </InkButton>
      </div>

      {modifiers.length === 0 ? (
        <p className="text-sm text-ink/55">暂未添加额外调整。</p>
      ) : (
        <div className="space-y-3">
          {modifiers.map((modifier, index) => (
            <div
              key={modifier.id}
              className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-ink/10 p-3 md:grid-cols-[minmax(0,2fr)_150px_120px_auto]"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink/55">属性</span>
                <select
                  className={SELECT_CLASSNAME}
                  value={modifier.attrType}
                  onChange={(event) => {
                    const next = [...modifiers];
                    next[index] = {
                      ...modifier,
                      attrType: event.target.value as AttributeType,
                    };
                    onChange(next);
                  }}
                >
                  {ATTRIBUTE_OPTIONS.map((attrType) => (
                    <option key={attrType} value={attrType}>
                      {ATTR_LABELS[attrType] ?? attrType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink/55">调整方式</span>
                <select
                  className={SELECT_CLASSNAME}
                  value={modifier.type}
                  onChange={(event) => {
                    const next = [...modifiers];
                    next[index] = {
                      ...modifier,
                      type: event.target.value as TrainingRoomModifierDraft['type'],
                    };
                    onChange(next);
                  }}
                >
                  {MODIFIER_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {MODIFIER_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>

              <NumberField
                label="数值"
                value={modifier.value}
                step={0.01}
                hint={MODIFIER_VALUE_HINTS[modifier.type]}
                onChange={(nextValue) => {
                  const next = [...modifiers];
                  next[index] = {
                    ...modifier,
                    value: nextValue,
                  };
                  onChange(next);
                }}
              />

              <div className="flex items-end justify-end">
                <InkButton
                  variant="ghost"
                  onClick={() =>
                    onChange(modifiers.filter((item) => item.id !== modifier.id))
                  }
                >
                  删除
                </InkButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </InkCard>
  );
}

export default function TrainingRoomPage() {
  const router = useRouter();
  const { cultivator, isLoading } = useCultivator();
  const [isFighting, setIsFighting] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<TrainingRoomDraft>(
    createDefaultTrainingRoomDraft(),
  );
  const [presets, setPresets] = useState<TrainingRoomPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);

  const {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    reset,
    totalActions,
    progress,
    unitSnapshots,
  } = useCombatPlayer(battleResult);

  useEffect(() => {
    const storage = parseTrainingRoomStorage(
      window.localStorage.getItem(TRAINING_ROOM_STORAGE_KEY),
    );
    setDraft(storage.currentDraft);
    setPresets(storage.presets);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    window.localStorage.setItem(
      TRAINING_ROOM_STORAGE_KEY,
      JSON.stringify({
        version: TRAINING_ROOM_STORAGE_VERSION,
        currentDraft: draft,
        presets,
      }),
    );
  }, [draft, presets, storageReady]);

  const startTrainingWithDraft = useCallback(
    (nextDraft: TrainingRoomDraft) => {
      if (!cultivator || isFighting) return;

      setIsFighting(true);
      setBattleResult(undefined);

      const mockDummy: Cultivator = {
        id: 'dummy',
        name: '木桩',
        age: 0,
        lifespan: 9999,
        attributes: {
          vitality: 10,
          spirit: 10,
          wisdom: 10,
          speed: 10,
          willpower: 10,
        },
        spiritual_roots: [],
        pre_heaven_fates: [],
        cultivations: [],
        skills: [],
        inventory: { artifacts: [], consumables: [], materials: [] },
        equipped: { weapon: null, armor: null, accessory: null },
        max_skills: 0,
        spirit_stones: 0,
        gender: '男',
        realm: '炼气',
        realm_stage: '初期',
        persistent_statuses: [],
      };

      const result = simulateBattleV5(
        cultivator,
        mockDummy,
        buildTrainingBattleInitConfig(nextDraft),
      );

      setBattleResult(result);
    },
    [cultivator, isFighting],
  );

  const handleStartTraining = useCallback(() => {
    startTrainingWithDraft(draft);
  }, [draft, startTrainingWithDraft]);

  const handleStartDefaultTraining = useCallback(() => {
    startTrainingWithDraft(createDefaultTrainingRoomDraft());
  }, [startTrainingWithDraft]);

  useEffect(() => {
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

  const handleLeave = () => {
    if (isFighting && currentIndex < totalActions - 1) {
      if (!confirm('训练尚未结束，确定要离开吗？')) return;
    }
    router.push('/game');
  };

  const savePreset = () => {
    const normalizedName =
      presetName.trim() ||
      presets.find((preset) => preset.id === selectedPresetId)?.name ||
      `训练预设 ${presets.length + 1}`;
    const existingId = selectedPresetId || '';
    const presetId =
      existingId ||
      globalThis.crypto?.randomUUID?.() ||
      `training-preset-${Date.now()}`;

    const nextPreset: TrainingRoomPreset = {
      id: presetId,
      name: normalizedName,
      draft,
      updatedAt: Date.now(),
    };

    setPresets((current) => {
      const exists = current.some((preset) => preset.id === presetId);
      if (!exists) return [nextPreset, ...current];
      return current.map((preset) => (preset.id === presetId ? nextPreset : preset));
    });
    setSelectedPresetId(presetId);
    setPresetName(normalizedName);
  };

  const loadPreset = () => {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) return;
    setDraft(preset.draft);
    setPresetName(preset.name);
  };

  const deletePreset = () => {
    if (!selectedPresetId) return;
    setPresets((current) =>
      current.filter((preset) => preset.id !== selectedPresetId),
    );
    setSelectedPresetId('');
    setPresetName('');
  };

  if (isLoading) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="text-ink/40 animate-pulse">识海构筑中...</p>
      </div>
    );
  }

  const playerUnitId = battleResult?.player || cultivator?.id;
  const opponentUnitId = battleResult?.opponent || 'dummy';
  const currentPlayerFrame = unitSnapshots[playerUnitId || ''];
  const currentOpponentFrame = unitSnapshots[opponentUnitId || ''];
  const initialOpponentHp =
    battleResult?.stateTimeline.frames[0]?.units[opponentUnitId || '']?.hp
      .current ?? 0;
  const totalDamage = Math.max(
    0,
    initialOpponentHp - (currentOpponentFrame?.hp.current ?? initialOpponentHp),
  );
  const isEnded = !!battleResult && currentIndex >= totalActions - 1;

  return (
    <BattlePageLayout
      title="练功房"
      subtitle="直接和木桩切磋；需要时再展开自定义设置。"
      backHref="/game"
      backLabel="离开"
      onBack={handleLeave}
      loading={isFighting && !battleResult}
    >
      {!battleResult ? (
        <div className="space-y-6">
          <InkCard variant="elevated" className="rounded-lg p-5">
            <p className="battle-caption mb-3 text-xs">练功说明</p>
            <p className="text-battle-muted max-w-3xl text-sm leading-7 md:text-base">
              默认会提供一只标准木桩，你可以直接开始训练，快速查看伤害、耗蓝和技能节奏。想做专项测试时，再展开自定义设置即可。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <InkButton
                onClick={handleStartDefaultTraining}
                variant="primary"
                className="text-base md:text-lg"
              >
                直接开始训练
              </InkButton>
              <InkButton
                variant="secondary"
                onClick={() => setIsDebugPanelOpen((current) => !current)}
              >
                {isDebugPanelOpen ? '收起自定义设置' : '打开自定义设置'}
              </InkButton>
            </div>
            <p className="mt-3 text-xs text-ink/55">
              默认配置下，玩家会以完整状态入场，木桩气血为 100000；你在这里保存的设置也会保留在当前浏览器中。
            </p>
          </InkCard>

          {isDebugPanelOpen ? (
            <div className="space-y-6">
              <InkCard variant="elevated" className="rounded-lg p-5">
                <p className="battle-caption mb-4 text-xs">自定义设置</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-ink">预设名称</span>
                    <input
                      className={INPUT_CLASSNAME}
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      placeholder="例如：十万血木桩 / 破防测试"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-ink">已存预设</span>
                    <select
                      className={SELECT_CLASSNAME}
                      value={selectedPresetId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setSelectedPresetId(nextId);
                        const preset = presets.find((item) => item.id === nextId);
                        setPresetName(preset?.name ?? '');
                      }}
                    >
                      <option value="">选择预设</option>
                      {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap items-end justify-end gap-2">
                    <InkButton variant="secondary" onClick={savePreset}>
                      保存当前预设
                    </InkButton>
                    <InkButton
                      variant="secondary"
                      onClick={loadPreset}
                      disabled={!selectedPresetId}
                    >
                      载入
                    </InkButton>
                    <InkButton
                      variant="ghost"
                      onClick={deletePreset}
                      disabled={!selectedPresetId}
                    >
                      删除
                    </InkButton>
                    <InkButton
                      variant="ghost"
                      onClick={() => {
                        setDraft(createDefaultTrainingRoomDraft());
                        setSelectedPresetId('');
                        setPresetName('');
                      }}
                    >
                      恢复默认
                    </InkButton>
                  </div>
                </div>
              </InkCard>

              <div className="space-y-4">
                  <InkCard variant="elevated" className="rounded-lg p-5">
                    <p className="mb-3 text-base font-semibold text-ink">木桩基础设置</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <NumberField
                        label="木桩气血上限"
                        value={draft.dummy.maxHp}
                        min={0}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            dummy: {
                              ...current.dummy,
                              maxHp: Math.max(0, value),
                            },
                          }))
                        }
                      />
                      <NumberField
                        label="木桩真元上限"
                        value={draft.dummy.maxMp}
                        min={0}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            dummy: {
                              ...current.dummy,
                              maxMp: Math.max(0, value),
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {PRIMARY_ATTRIBUTE_FIELDS.map((field) => (
                        <NumberField
                          key={field.key}
                          label={field.label}
                          value={draft.dummy.baseAttributes[field.key]}
                          min={0}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              dummy: {
                                ...current.dummy,
                                baseAttributes: {
                                  ...current.dummy.baseAttributes,
                                  [field.key]: Math.max(0, value),
                                },
                              },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </InkCard>

                  <ModifierEditor
                    modifiers={draft.dummy.modifiers}
                    onChange={(modifiers) =>
                      setDraft((current) => ({
                        ...current,
                        dummy: {
                          ...current.dummy,
                          modifiers,
                        },
                      }))
                    }
                  />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-ink/10 pt-4">
                <p className="text-sm text-ink/55">
                  当前设置会自动保存在本机浏览器中，方便下次继续练功。
                </p>
                <InkButton
                  onClick={handleStartTraining}
                  variant="primary"
                  className="text-base md:text-lg"
                >
                  以当前设置开始
                </InkButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-4">
          {currentPlayerFrame && currentOpponentFrame && (
            <CombatStatusHeader
              player={currentPlayerFrame}
              opponent={currentOpponentFrame}
              onShowPlayerDetails={() => setSelectedUnit(currentPlayerFrame)}
              onShowOpponentDetails={() => setSelectedUnit(currentOpponentFrame)}
              controls={
                <CombatControlBar
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  progress={progress}
                  onToggle={() => (isPlaying ? pause() : play())}
                  onSpeedChange={setPlaybackSpeed}
                  onReset={reset}
                />
              }
            />
          )}

          <CombatActionLog
            spans={battleResult.logSpans}
            currentIndex={currentIndex}
          />
        </div>
      )}

      <CombatAttributeModal
        unit={selectedUnit}
        isOpen={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
      />

      <CombatResultDialog
        key={`training-${battleResult?.turns}-${currentOpponentFrame?.hp.current ?? 0}`}
        dialogKey={`training-${battleResult?.turns}-${currentOpponentFrame?.hp.current ?? 0}`}
        open={isEnded}
        title="本次训练结束"
        content={
          <p className="leading-8">
            本次训练共造成 {totalDamage.toLocaleString()} 点伤害。
          </p>
        }
        confirmLabel="再来一次"
        cancelLabel="先看看"
        onConfirm={() => {
          setIsFighting(false);
          setBattleResult(undefined);
        }}
      />
    </BattlePageLayout>
  );
}
