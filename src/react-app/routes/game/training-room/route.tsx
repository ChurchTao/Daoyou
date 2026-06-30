import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { inkFieldVariants } from '@app/components/ui/inkFieldStyles';
import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type { TrainingRoomModifierDraft } from '@shared/engine/battle-v5/setup/types';
import { ATTR_LABELS } from '@shared/engine/battle-v5/effects/affixText/attributes';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import type { BattleRecord } from '@shared/types/battle';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import { getResourceText } from '@shared/lib/gameConceptDisplay';
import {
  buildTrainingBattleInitConfig, createDefaultTrainingRoomDraft, parseTrainingRoomStorage, TRAINING_ROOM_STORAGE_KEY, TRAINING_ROOM_STORAGE_VERSION, type TrainingRoomDraft, type TrainingRoomPreset, } from '@shared/lib/training-room/config';
import type { Cultivator } from '@shared/types/cultivator';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

const ATTRIBUTE_OPTIONS = Object.values(AttributeType);
const MODIFIER_TYPE_OPTIONS = [
  ModifierType.FIXED,
  ModifierType.ADD,
  ModifierType.MULTIPLY,
  ModifierType.FINAL,
  ModifierType.OVERRIDE,
] as const;

const SELECT_CLASSNAME = inkFieldVariants({ size: 'sm' });
const INPUT_CLASSNAME = inkFieldVariants({ size: 'sm' });

const PRIMARY_ATTRIBUTE_FIELDS = [
  { key: AttributeType.SPIRIT, label: ATTR_LABELS[AttributeType.SPIRIT] },
  { key: AttributeType.VITALITY, label: ATTR_LABELS[AttributeType.VITALITY] },
  { key: AttributeType.SPEED, label: ATTR_LABELS[AttributeType.SPEED] },
  { key: AttributeType.WILLPOWER, label: ATTR_LABELS[AttributeType.WILLPOWER] },
  { key: AttributeType.WISDOM, label: ATTR_LABELS[AttributeType.WISDOM] },
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

function readTrainingRoomStorage() {
  if (typeof window === 'undefined') return null;
  return parseTrainingRoomStorage(
    window.localStorage.getItem(TRAINING_ROOM_STORAGE_KEY),
  );
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

function ModifierEditor({
  modifiers,
  onChange,
}: {
  modifiers: TrainingRoomModifierDraft[];
  onChange: (modifiers: TrainingRoomModifierDraft[]) => void;
}) {
  return (
    <InkCard variant="elevated" className="p-4">
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
              className="grid grid-cols-1 gap-3 border border-dashed border-ink/10 p-3 md:grid-cols-[minmax(0,2fr)_150px_120px_auto]"
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
  const navigate = useNavigate();
  const { cultivator, isLoading } = usePlayerStateView();
  const [isFighting, setIsFighting] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [draft, setDraft] = useState<TrainingRoomDraft>(() => {
    return readTrainingRoomStorage()?.currentDraft ?? createDefaultTrainingRoomDraft();
  });
  const [presets, setPresets] = useState<TrainingRoomPreset[]>(() => {
    return readTrainingRoomStorage()?.presets ?? [];
  });
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [storageReady] = useState(typeof window !== 'undefined');
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const playback = useBattlePlaybackState(battleResult);

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
        spirit_stones: 0,
        gender: '男',
        realm: '炼气',
        realm_stage: '初期',
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

  const handleLeave = useCallback(() => {
    if (isFighting && !playback.isPlaybackFinished) {
      if (!confirm('训练尚未结束，确定要离开吗？')) return;
    }
    navigate('/game');
  }, [isFighting, navigate, playback.isPlaybackFinished]);

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
    return <GameImmersiveLoading message="识海构筑中……" />;
  }

  const opponentUnitId = battleResult?.opponent || 'dummy';
  const initialOpponentHp =
    battleResult?.stateTimeline.frames[0]?.units[opponentUnitId || '']?.hp
      .current ?? 0;
  const totalDamage = Math.max(
    0,
    initialOpponentHp -
      (playback.currentOpponentFrame?.hp.current ?? initialOpponentHp),
  );
  const isEnded = !!battleResult && playback.isPlaybackFinished;

  return (
    <BattlePageLayout
      title="练功房"
      subtitle="直接和木桩切磋；需要时再展开自定义设置。"
      variant={battleResult ? 'immersive-battle' : 'page'}
      loading={isFighting && !battleResult}
    >
      {!battleResult ? (
        <div className="space-y-6">
          <InkCard variant="elevated" className="p-5">
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
          </InkCard>

          {isDebugPanelOpen ? (
            <div className="space-y-6">
              <InkCard variant="elevated" className="p-5">
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
                  <InkCard variant="elevated" className="p-5">
                    <p className="mb-3 text-base font-semibold text-ink">木桩基础设置</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <NumberField
                        label={`木桩${getResourceText('maxHp')}`}
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
                        label={`木桩${getResourceText('maxMp')}`}
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
        <BattlePlaybackPanel
          battleResult={battleResult}
          playback={playback}
          statusAction={{
            label: '离开练功房',
            onClick: handleLeave,
          }}
        />
      )}

      <CombatResultDialog
        key={`training-${battleResult?.turns}-${playback.currentOpponentFrame?.hp.current ?? 0}`}
        dialogKey={`training-${battleResult?.turns}-${playback.currentOpponentFrame?.hp.current ?? 0}`}
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
