import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import { manualAttributeValue } from '@shared/engine/combat-v6/manuals/attributes';
import { manualSlot } from '@shared/engine/combat-v6/manuals/compiler';
import {
  CHARACTER_MANUALS_V1,
  manualRule,
} from '@shared/engine/combat-v6/manuals/content';
import { manualEffectLines } from '@shared/engine/combat-v6/manuals/presentation';
import type { CharacterManualDefV1 } from '@shared/engine/combat-v6/manuals/types';
import { itemDefinition } from '@shared/inventory';
import { CHARACTER_ATTRIBUTE_LABELS } from '@shared/lib/characterAttributeLabels';
import { manualJadeCost, previewManualAction } from '@shared/manuals/action';
import { ManualProgress } from './ManualProgress';
import { manualMechanismSummary } from './manualPresentation';

export function ManualDetail({
  manual,
  view,
  pending,
  itemChoice,
  onSubmit,
}: {
  manual: CharacterManualDefV1;
  view: ManualView;
  pending: boolean;
  itemChoice?: { id: string; revision: number };
  onSubmit: (action: ManualAction) => void;
}) {
  const bag = useInventoryBag();
  const state = view.state;
  const progress = state?.learned.find((m) => m.manualId === manual.id);
  const level = progress?.level ?? 1;
  const rule = manualRule(manual);
  const complete = progress?.level === rule.maxLevel;
  const bottleneck =
    !complete && !!progress && progress.level === progress.unlockedLevel;
  const kind = !progress ? 'learn' : bottleneck ? 'unlock' : 'train';
  const mechanism = manualMechanismSummary(manual, level);
  const nextMechanism = manualMechanismSummary(
    manual,
    Math.min(level + 1, rule.maxLevel),
  );
  const equipped = CHARACTER_MANUALS_V1.find(
    (m) =>
      m.realm === manual.realm &&
      state?.build.slots.some((s) => s.manualId === m.id),
  );
  const active = equipped?.id === manual.id;
  const equippedProgress = state?.learned.find(
    (m) => m.manualId === equipped?.id,
  );
  const jadeCost = state
    ? manualJadeCost(state, { action: kind, manualId: manual.id })
    : 0;
  const jades = (bag.data?.items ?? []).filter(
    (i) => itemDefinition(i.definitionId).manualId === manual.id,
  );
  const jade = itemChoice
    ? jades.find((i) => i.id === itemChoice.id)
    : jades.find((i) => i.quantity >= jadeCost);
  const target = state
    ? {
        expectedRevision: state.revision,
        slot: manualSlot(manual),
        manualId: manual.id,
      }
    : undefined;
  const action: ManualAction | undefined = target
    ? kind === 'train'
      ? { ...target, action: kind }
      : jade
        ? {
            ...target,
            action: kind,
            item: itemChoice ?? { id: jade.id, revision: jade.revision },
          }
        : undefined
    : undefined;
  const preview =
    state && action
      ? previewManualAction(state, view.realm, action, view.resources, jade)
      : undefined;
  const cost =
    progress && !complete && !bottleneck
      ? rule.costsByRealm[manual.realm][level - 1]
      : undefined;
  const needsJade = kind !== 'train';
  const bagReady =
    !!bag.data && !bag.isRefreshing && !bag.loading && !bag.error;
  const blocked = pending || !!view.blockedReason || !state;
  const nextCap = rule.bottlenecks.find((n) => n > level) ?? rule.maxLevel;
  return (
    <article
      className="min-w-0 space-y-4 text-sm"
      aria-label={`${manual.name}详情`}
      aria-busy={pending}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{manual.name}</h3>
            <span className="text-ink-secondary text-xs">
              {active ? '正在运转' : progress ? '未生效' : '未习得'}
            </span>
          </div>
          <p className="text-ink-secondary mt-1 text-xs">
            {manual.realm} · {mechanism.tag}
          </p>
        </div>
        {progress && !active && target ? (
          <InkButton
            disabled={blocked}
            onClick={() => onSubmit({ ...target, action: 'activate' })}
            className="min-h-11 shrink-0"
          >
            改修此法
          </InkButton>
        ) : null}
      </header>
      <div>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-ink-secondary text-xs">
            {progress ? '已参悟' : '习得即入'}
          </span>
          <span className="font-mono text-3xl font-semibold tracking-tight">
            {level}
          </span>
          <span>层</span>
          {complete ? (
            <span
              aria-label="九层功成"
              className="border-crimson/60 text-crimson ml-auto rotate-[-6deg] border px-2 py-1"
            >
              圆满
            </span>
          ) : (
            <span className="text-ink-secondary ml-auto text-xs">
              {bottleneck ? '已至瓶颈' : `共 ${rule.maxLevel} 层`}
            </span>
          )}
        </div>
        <ManualProgress
          manual={manual}
          level={progress?.level ?? 0}
          unlockedLevel={progress?.unlockedLevel ?? rule.bottlenecks[0]}
        />
      </div>
      <div className="space-y-3">
        {manual.effects.map((effect) => (
          <div
            key={effect.attribute}
            className="flex items-baseline justify-between gap-3"
          >
            <span>{CHARACTER_ATTRIBUTE_LABELS[effect.attribute]}</span>
            <span className="font-mono text-lg font-semibold">
              +{manualAttributeValue(effect, level)}
              {cost ? (
                <>
                  <span className="text-ink-secondary mx-2 text-sm font-normal">
                    →
                  </span>
                  <span className="text-crimson">
                    +{manualAttributeValue(effect, level + 1)}
                  </span>
                </>
              ) : null}
            </span>
          </div>
        ))}
        <div className="border-ink/20 border-l-2 pl-3">
          <p className="text-ink-secondary mb-1 text-xs leading-relaxed">
            {mechanism.condition}
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span>{mechanism.label}</span>
            <span className="font-mono text-base font-semibold">
              {mechanism.value}
              {cost ? (
                <>
                  <span className="text-ink-secondary mx-2 text-sm font-normal">
                    →
                  </span>
                  <span className="text-crimson">{nextMechanism.value}</span>
                </>
              ) : null}
            </span>
          </div>
        </div>
        {cost ? (
          <p className="text-ink-secondary text-right text-xs">
            当前 → 第 <span className="font-mono">{level + 1}</span> 层
          </p>
        ) : null}
      </div>
      {!active && equipped && equippedProgress ? (
        <details className="border-ink/10 border-t pt-3 text-xs">
          <summary className="text-ink-secondary cursor-pointer py-1">
            与当前所修《{equipped.name}》比较
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {Array.from(
                new Set(
                  [...equipped.effects, ...manual.effects].map(
                    (e) => e.attribute,
                  ),
                ),
              ).map((attribute) => {
                const from = equipped.effects.find(
                  (e) => e.attribute === attribute,
                );
                const to = manual.effects.find(
                  (e) => e.attribute === attribute,
                );
                const before = from
                  ? manualAttributeValue(from, equippedProgress.level)
                  : 0;
                const after = to ? manualAttributeValue(to, level) : 0;
                return (
                  <p key={attribute}>
                    {CHARACTER_ATTRIBUTE_LABELS[attribute]}{' '}
                    <span className="font-mono">
                      {before} → {after}（{after >= before ? '+' : ''}
                      {after - before}）
                    </span>
                  </p>
                );
              })}
            </div>
            <p className="leading-relaxed">
              <span className="text-ink-secondary">当前 · </span>
              {
                manualMechanismSummary(equipped, equippedProgress.level)
                  .description
              }
            </p>
            <p className="leading-relaxed">
              <span className="text-ink-secondary">备选 · </span>
              {mechanism.description}
            </p>
          </div>
        </details>
      ) : null}
      {!complete ? (
        <div className="border-ink/15 relative border-t pt-4">
          {cost ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:mr-44">
                {(
                  [
                    { key: 'experience', label: '修为' },
                    { key: 'insight', label: '感悟' },
                  ] as const
                ).map(({ key, label }) => {
                  const balance = view.resources[key];
                  const missing = Math.max(0, cost[key] - balance);
                  return (
                    <div key={key}>
                      <p className="text-ink-secondary text-xs">消耗{label}</p>
                      <p className="mt-1 font-mono text-lg font-semibold">
                        {cost[key]}
                      </p>
                      <p
                        className={`mt-1 text-xs ${missing ? 'text-crimson' : 'text-ink-secondary'}`}
                      >
                        {missing ? (
                          <>
                            还缺 <span className="font-mono">{missing}</span>
                          </>
                        ) : (
                          <>
                            余{' '}
                            <span className="font-mono">
                              {balance - cost[key]}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
              <details className="text-ink-secondary mt-3 text-xs">
                <summary className="cursor-pointer py-1">
                  修为与境界进度
                </summary>
                <p className="mt-2">
                  参悟后修为{' '}
                  <span className="font-mono">
                    {Math.max(0, view.resources.experience - cost.experience)}
                  </span>
                  ，境界进度{' '}
                  <span className="font-mono">
                    {Math.max(
                      0,
                      Math.min(
                        100,
                        ((view.resources.experience - cost.experience) /
                          Math.max(1, view.resources.experienceCap)) *
                          100,
                      ),
                    ).toFixed(1)}
                    %
                  </span>
                  。
                </p>
              </details>
            </>
          ) : (
            <>
              <p className="font-medium">
                {bottleneck
                  ? `开放第 ${level + 1}—${nextCap} 层`
                  : '习得第一层'}
              </p>
              <p className="text-ink-secondary mt-2 text-xs">
                消耗《{manual.name}》玉简{' '}
                <span className="text-ink font-mono font-semibold">
                  ×{jadeCost}
                </span>
                <span className="ml-3">
                  持有{' '}
                  <span className="font-mono">
                    {bagReady ? jades.reduce((n, i) => n + i.quantity, 0) : '—'}
                  </span>{' '}
                  本
                </span>
              </p>
              {bottleneck ? (
                <p className="text-ink-secondary mt-1 text-xs">
                  突破后仍为第 {level} 层，参悟可继续精进。
                </p>
              ) : null}
              {!jade && bagReady ? (
                <p className="text-crimson mt-2 text-xs">
                  需要一叠至少 {jadeCost} 本的同名玉简。
                </p>
              ) : null}
              {!bagReady ? (
                <div className="text-ink-secondary mt-2 text-xs">
                  {bag.error ?? '正在读取玉简……'}
                  {bag.error ? (
                    <InkButton onClick={() => void bag.reload()}>
                      刷新储物袋
                    </InkButton>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
          {preview &&
          !preview.ok &&
          !(
            cost &&
            (view.resources.experience < cost.experience ||
              view.resources.insight < cost.insight)
          ) ? (
            <p role="status" className="text-crimson mt-2 text-xs">
              {preview.diagnostics.map((d) => d.message).join('；')}
            </p>
          ) : null}
          <div
            className={`mt-3 flex justify-end ${cost ? 'sm:absolute sm:top-4 sm:right-0 sm:mt-0' : ''}`}
          >
            <InkButton
              variant="primary"
              pending={pending}
              disabled={blocked || !preview?.ok || (needsJade && !bagReady)}
              className="min-h-11"
              onClick={() => {
                if (action) onSubmit(action);
              }}
            >
              {kind === 'train'
                ? `参悟至第 ${level + 1} 层`
                : kind === 'unlock'
                  ? '突破瓶颈'
                  : '学习此功法'}
            </InkButton>
          </div>
        </div>
      ) : null}
      <details className="border-ink/10 text-ink-secondary border-t pt-3 text-xs">
        <summary className="cursor-pointer py-1">功法释义与作用范围</summary>
        <div className="mt-3 space-y-3 leading-relaxed">
          <p>{manual.description}</p>
          <p>{mechanism.description}</p>
          {!complete ? (
            <div>
              <p className="text-ink mb-1">九层圆满</p>
              {manualEffectLines(manual, rule.maxLevel).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}
