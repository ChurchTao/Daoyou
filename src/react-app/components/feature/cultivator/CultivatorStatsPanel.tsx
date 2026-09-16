import { InkModal } from '@app/components/layout/InkModal';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkDetailDrawer, InkNotice } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorProgress } from '@app/lib/resources/player';
import { ATTRIBUTE_RESET_TALISMAN_NAME } from '@shared/config/attributeResetTalisman';
import type { AttributePreviewData } from '@shared/contracts/characterAttributes';
import type { CharacterPanelV1 } from '@shared/engine/combat-v6/projection';
import {
  CHARACTER_ATTRIBUTE_LABELS,
  CHARACTER_PANEL_LABELS,
  formatCharacterAttributeValue,
} from '@shared/lib/cultivatorDisplay';
import type { Attributes } from '@shared/types/cultivator';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  canSubmitAttributeAllocation,
  createEmptyAttributeDraft,
} from './attributeAllocationControlLogic';
import { CharacterSheetRow } from './CharacterSheetRow';
import type { CultivatorDisplayProjection } from './useCultivatorDisplayProjection';

const primaryKeys = Object.keys(
  CHARACTER_ATTRIBUTE_LABELS,
) as (keyof Attributes)[];
const mainStats: (keyof CharacterPanelV1)[] = [
  'physicalAtk',
  'magicAtk',
  'physicalDef',
  'magicDef',
  'speed',
];
const groups: { label: string; keys: (keyof CharacterPanelV1)[] }[] = [
  { label: '生存与攻防', keys: ['maxHp', 'maxMp', ...mainStats] },
  {
    label: '命中与辅助',
    keys: ['hit', 'dodge', 'healPower', 'sealHit', 'sealResist'],
  },
  {
    label: '暴击与狂暴',
    keys: ['critRate', 'spellCritRate', 'physicalFuryRate'],
  },
];
const attributeHelp: Record<keyof Attributes, string> = {
  vitality: '增加气血上限，并提供少量法术防御、速度与治疗强度。',
  strength: '增加物理攻击，并提供少量法术防御与速度。',
  spirit: '增加法术攻击、法力上限，并提供少量法术防御与封印命中。',
  endurance: '增加物理防御，并提供少量法术防御与速度。',
  speed: '增加速度、命中与躲避。',
  willpower: '增加法术防御、法力上限、治疗强度与封印抵抗。',
};

export function CultivatorStatsPanel({
  projection,
}: {
  projection: CultivatorDisplayProjection;
}) {
  const { cultivator, display } = projection;
  const progress = useCultivatorProgress();
  const { mutate } = useResourceMutation();
  const { pushToast, openDialog } = useInkUI();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(params.get('allocate') === '1');
  const [attributeDraft, setAttributeDraft] = useState<Attributes>(
    createEmptyAttributeDraft,
  );
  const [isAllocatingAttributes, setIsAllocatingAttributes] = useState(false);
  const [isResettingAttributes, setIsResettingAttributes] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [drawer, setDrawer] = useState<'stats' | 'help' | null>(null);
  const busy = useRef(false);
  const unallocatedAttributePoints =
    cultivator.unallocated_attribute_points ?? 0;
  const spent = Object.values(attributeDraft).reduce(
    (sum, value) => sum + value,
    0,
  );
  const disabled =
    isAllocatingAttributes || isResettingAttributes || confirming;
  const requestKey = JSON.stringify({
    attribute_model_version: 2,
    ...attributeDraft,
  });
  const [previewResult, setPreviewResult] = useState<{
    key: string;
    basis: unknown;
    data?: AttributePreviewData;
    error?: string;
  } | null>(null);
  const basis = display.attrs;
  // A changed draft or resource baseline immediately hides the old preview.
  const preview =
    spent > 0 &&
    editing &&
    previewResult?.key === requestKey &&
    previewResult.basis === basis
      ? previewResult
      : null;
  useEffect(() => {
    if (!editing || spent === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch('/api/cultivator/attributes/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestKey,
            signal: controller.signal,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? '属性预览失败');
          if (!controller.signal.aborted)
            setPreviewResult({ key: requestKey, basis, data: result.data });
        } catch (error) {
          if (!controller.signal.aborted)
            setPreviewResult({
              key: requestKey,
              basis,
              error: error instanceof Error ? error.message : '属性预览失败',
            });
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editing, spent, requestKey, basis]);

  const renderStat = (key: keyof CharacterPanelV1) => {
    const current = preview?.data?.current[key] ?? display.attrs[key];
    const next = preview?.data?.preview[key];
    return (
      <CharacterSheetRow
        key={key}
        label={CHARACTER_PANEL_LABELS[key]}
        className="grid-cols-[auto_minmax(0,1fr)] py-1.5 [&_dd]:text-right"
      >
        <span className="font-mono">
          {formatCharacterAttributeValue(key, current)}
          {next !== undefined && next !== current ? (
            <span className="text-teal">
              {' '}
              → {formatCharacterAttributeValue(key, next)}
            </span>
          ) : null}
        </span>
      </CharacterSheetRow>
    );
  };
  const handleAllocateAttributes = async () => {
    if (busy.current) return;
    if (
      !canSubmitAttributeAllocation({
        draft: attributeDraft,
        unallocatedPoints: unallocatedAttributePoints,
        loading: isAllocatingAttributes,
      })
    ) {
      return;
    }

    try {
      busy.current = true;
      setIsAllocatingAttributes(true);
      await mutate(
        fetch('/api/cultivator/attributes/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attribute_model_version: 2,
            ...attributeDraft,
          }),
        }),
      );
      setAttributeDraft(createEmptyAttributeDraft());
      setConfirming(false);
      setEditing(false);
      pushToast({ message: '根基属性已分配', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '属性分配失败',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setIsAllocatingAttributes(false);
    }
  };

  const handleResetAttributes = async () => {
    if (busy.current) return;

    try {
      busy.current = true;
      setIsResettingAttributes(true);
      const result = await mutate<{
        refunded_attribute_points: number;
        consumed_talisman_name: string;
      }>(
        fetch('/api/cultivator/attributes/reset', {
          method: 'POST',
        }),
      );
      setAttributeDraft(createEmptyAttributeDraft());
      setEditing(false);
      pushToast({
        message: `已启封${result.consumed_talisman_name}，返还 ${result.refunded_attribute_points} 点可分配属性点`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '属性重置失败',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setIsResettingAttributes(false);
    }
  };

  const openResetConfirm = () => {
    openDialog({
      title: `启封${ATTRIBUTE_RESET_TALISMAN_NAME}`,
      content: (
        <div className="space-y-2 py-2 text-center text-sm leading-7">
          <p>
            将消耗 1 张{ATTRIBUTE_RESET_TALISMAN_NAME}
            ，六维回到当前境界自然成长值。
          </p>
          <p className="text-ink-secondary">
            已投入的自由属性会返还为未分配属性点。
          </p>
        </div>
      ),
      confirmLabel: '确认重置',
      cancelLabel: '再想想',
      loadingLabel: '重置中……',
      onConfirm: handleResetAttributes,
    });
  };

  return (
    <div className="space-y-5">
      <div className="border-ink/15 grid gap-5 border-t pt-4 md:grid-cols-2 md:gap-8">
        <section className="min-w-0">
          <div className="mb-2 flex min-h-8 items-center justify-between">
            <h3 className="text-sm font-semibold">战斗属性</h3>
            <InkButton className="text-sm" onClick={() => setDrawer('stats')}>
              更多属性
            </InkButton>
          </div>
          <dl>{mainStats.map(renderStat)}</dl>
          {editing && spent > 0 ? (
            <div
              className="mt-2 hidden space-y-2 text-sm md:block"
              aria-live="polite"
            >
              {preview?.error ? (
                <p className="text-crimson">{preview.error}</p>
              ) : !preview?.data ? (
                <p className="text-ink-secondary">正在推演属性……</p>
              ) : (
                <>
                  <p className="text-teal">加点预览</p>
                  <dl>{(['maxHp', 'maxMp'] as const).map(renderStat)}</dl>
                </>
              )}
            </div>
          ) : null}
        </section>
        <section className="min-w-0">
          <div className="mb-2 flex min-h-8 items-center justify-between">
            <h3 className="text-sm font-semibold">六维根基</h3>
            <InkButton className="text-sm" onClick={() => setDrawer('help')}>
              属性说明
            </InkButton>
          </div>
          <dl>
            {primaryKeys.map((key) => (
              <CharacterSheetRow
                key={key}
                label={CHARACTER_ATTRIBUTE_LABELS[key]}
                className="grid-cols-[auto_minmax(0,1fr)] py-1.5"
              >
                <div className="flex flex-wrap items-center justify-end gap-2 font-mono">
                  <span>
                    {cultivator.attributes[key]}
                    {editing && attributeDraft[key] > 0 ? (
                      <span className="text-teal"> +{attributeDraft[key]}</span>
                    ) : null}
                  </span>
                  {editing ? (
                    <>
                      <button
                        type="button"
                        aria-label={`减少${CHARACTER_ATTRIBUTE_LABELS[key]}`}
                        disabled={disabled || attributeDraft[key] === 0}
                        className="border-ink/20 size-11 rounded-sm border disabled:opacity-30 md:size-8"
                        onClick={() =>
                          setAttributeDraft((previous) => ({
                            ...previous,
                            [key]: Math.max(0, previous[key] - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <button
                        type="button"
                        aria-label={`增加${CHARACTER_ATTRIBUTE_LABELS[key]}`}
                        disabled={
                          disabled || spent >= unallocatedAttributePoints
                        }
                        className="border-teal/30 text-teal size-11 rounded-sm border disabled:opacity-30 md:size-8"
                        onClick={() =>
                          setAttributeDraft((previous) =>
                            Object.values(previous).reduce(
                              (sum, value) => sum + value,
                              0,
                            ) >= unallocatedAttributePoints
                              ? previous
                              : { ...previous, [key]: previous[key] + 1 },
                          )
                        }
                      >
                        +
                      </button>
                    </>
                  ) : null}
                </div>
              </CharacterSheetRow>
            ))}
          </dl>
          {editing && spent > 0 ? (
            <div
              className="mt-3 space-y-2 text-sm md:hidden"
              aria-live="polite"
            >
              {preview?.error ? (
                <p className="text-crimson">{preview.error}</p>
              ) : !preview?.data ? (
                <p className="text-ink-secondary">正在推演属性……</p>
              ) : (
                <>
                  <p className="text-teal">加点预览</p>
                  <dl>
                    {groups
                      .flatMap((group) => group.keys)
                      .filter(
                        (key) =>
                          preview.data!.current[key] !==
                          preview.data!.preview[key],
                      )
                      .map(renderStat)}
                  </dl>
                </>
              )}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
            <span className="text-ink-secondary" aria-live="polite">
              {editing ? '剩余' : '可分配'}{' '}
              <span className="font-mono">
                {unallocatedAttributePoints - (editing ? spent : 0)}
              </span>{' '}
              点
            </span>
            {editing ? (
              <div className="flex gap-3">
                <InkButton
                  disabled={disabled}
                  onClick={() => {
                    setAttributeDraft(createEmptyAttributeDraft());
                    setEditing(false);
                  }}
                >
                  取消
                </InkButton>
                <InkButton
                  disabled={
                    disabled ||
                    spent === 0 ||
                    !preview?.data ||
                    spent > unallocatedAttributePoints
                  }
                  onClick={() => setConfirming(true)}
                >
                  确认分配
                </InkButton>
              </div>
            ) : (
              <InkButton onClick={() => setEditing(true)}>分配</InkButton>
            )}
          </div>
          {editing ? (
            <div className="mt-3 text-right">
              <InkButton
                className="text-sm"
                disabled={disabled}
                onClick={openResetConfirm}
              >
                重置属性点
              </InkButton>
            </div>
          ) : null}
        </section>
      </div>
      {progress.error ? (
        <InkNotice>{progress.error}</InkNotice>
      ) : progress.data ? (
        <div className="pt-2 text-sm">
          <div className="mb-2 flex justify-between gap-3">
            <span className="text-ink-secondary">修为</span>
            <span className="font-mono">
              {progress.data.cultivation_exp} / {progress.data.exp_cap}
            </span>
          </div>
          <div className="bg-battle-faint h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-ink h-full"
              style={{
                width: `${Math.max(0, Math.min(100, (progress.data.cultivation_exp / Math.max(1, progress.data.exp_cap)) * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-ink-secondary text-sm">正在读取修为……</p>
      )}
      <InkDetailDrawer
        isOpen={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer === 'help' ? '六维根基' : '全部战斗属性'}
        size="md"
      >
        {drawer === 'help' ? (
          <dl className="space-y-4 text-sm">
            {primaryKeys.map((key) => (
              <div key={key}>
                <dt className="mb-1 font-semibold">
                  {CHARACTER_ATTRIBUTE_LABELS[key]}
                </dt>
                <dd className="text-ink-secondary leading-6">
                  {attributeHelp[key]}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.label}>
                <h3 className="mb-1 text-sm font-semibold">{group.label}</h3>
                <dl>{group.keys.map(renderStat)}</dl>
              </section>
            ))}
          </div>
        )}
      </InkDetailDrawer>
      <InkModal
        isOpen={confirming}
        title="确认分配根基"
        onClose={() => {
          if (!busy.current) setConfirming(false);
        }}
        footer={
          <div className="flex justify-end gap-3">
            <InkButton
              disabled={isAllocatingAttributes}
              onClick={() => setConfirming(false)}
            >
              返回调整
            </InkButton>
            <InkButton
              pending={isAllocatingAttributes}
              onClick={() => void handleAllocateAttributes()}
            >
              确认分配
            </InkButton>
          </div>
        }
      >
        <p className="text-sm">
          本次消耗{' '}
          <span className="font-mono">
            {Object.values(attributeDraft).reduce(
              (sum, value) => sum + value,
              0,
            )}
          </span>{' '}
          点。确认后如需重新分配，需消耗{ATTRIBUTE_RESET_TALISMAN_NAME}。
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          {(Object.keys(CHARACTER_ATTRIBUTE_LABELS) as (keyof Attributes)[])
            .filter((key) => attributeDraft[key] > 0)
            .map((key) => (
              <div key={key} className="flex justify-between gap-3">
                <dt>{CHARACTER_ATTRIBUTE_LABELS[key]}</dt>
                <dd className="font-mono">
                  {cultivator.attributes[key]} →{' '}
                  <span className="text-teal">
                    {cultivator.attributes[key] + attributeDraft[key]}
                  </span>
                </dd>
              </div>
            ))}
        </dl>
      </InkModal>
    </div>
  );
}
