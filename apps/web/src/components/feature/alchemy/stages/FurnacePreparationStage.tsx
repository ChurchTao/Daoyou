import { InkButton } from '@app/components/ui';
import { cn } from '@app/lib/cn';
import type { AlchemyPropertyKey } from '@daoyou/game-domain/consumables';
import { GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES } from '@daoyou/game-rules/alchemy';
import { useLayoutEffect, useRef, useState } from 'react';
import { useAlchemyCraftSession } from '../alchemyCraftContext';
import { ALCHEMY_MAX_MATERIALS } from '../useAlchemyCraftSessionState.js';

const ALCHEMY_INTENT_COPY = {
  restore_hp: { label: '补充气血', prompt: '炼一炉能补充气血的丹' },
  heal_wounds: { label: '治愈伤势', prompt: '炼一炉能治愈伤势的丹' },
  restore_mp: { label: '回补法力', prompt: '炼一炉能回补法力的丹' },
  detox: { label: '解毒祛浊', prompt: '炼一炉能解毒祛浊的丹' },
  cultivation: { label: '积蓄修为', prompt: '炼一炉能积蓄修为的丹' },
  beast_cultivation: { label: '灵兽修为', prompt: '炼一炉能滋养灵兽修为的丹' },
  insight: { label: '澄明感悟', prompt: '炼一炉能澄明感悟的丹' },
  clear_mind_support: { label: '清心定神', prompt: '炼一炉能清心定神的丹' },
  protect_meridians_support: {
    label: '护脉稳络',
    prompt: '炼一炉能护脉稳络的丹',
  },
  breakthrough_support: { label: '冲关蓄势', prompt: '炼一炉能冲关蓄势的丹' },
  extend_lifespan: { label: '延长寿元', prompt: '炼一炉能延长寿元的丹' },
  body_skin: { label: '炼体皮肤', prompt: '炼一炉能炼厚皮膜的丹' },
  body_sinew_bone: { label: '炼体筋骨', prompt: '炼一炉能锻骨强筋的丹' },
  body_organs: { label: '炼体脏腑', prompt: '炼一炉能温养脏腑的丹' },
  body_qi_blood: { label: '炼体气血', prompt: '炼一炉能炼厚气血的丹' },
  body_primordial_spirit: {
    label: '炼体元神',
    prompt: '炼一炉能稳固元神的丹',
  },
  marrow_wash: { label: '洗髓伐脉', prompt: '炼一炉能洗髓伐脉的丹' },
} as const satisfies Record<
  AlchemyPropertyKey,
  { label: string; prompt: string }
>;

const ALCHEMY_INTENT_PRESETS = GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES.map(
  (key) => ALCHEMY_INTENT_COPY[key],
);
const ALCHEMY_INTENT_PRESET_SET = new Set<string>(
  ALCHEMY_INTENT_PRESETS.map((preset) => preset.prompt),
);

const intentChipClass =
  'hover:bg-ink/10 hover:text-crimson focus-visible:ring-crimson/50 aria-pressed:bg-crimson/5 aria-pressed:text-crimson aria-pressed:hover:bg-crimson/10 inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-sm px-2 text-xs leading-none whitespace-nowrap text-ink transition-colors focus-visible:ring-1 motion-reduce:transition-none aria-pressed:font-semibold';

function collapsedIntentPresets(visibleCount: number, selected: string) {
  if (visibleCount >= ALCHEMY_INTENT_PRESETS.length)
    return ALCHEMY_INTENT_PRESETS;
  const head = ALCHEMY_INTENT_PRESETS.slice(0, visibleCount);
  const selectedIndex = ALCHEMY_INTENT_PRESETS.findIndex(
    (preset) => preset.prompt === selected,
  );
  if (selectedIndex < visibleCount) return head;
  return [...head.slice(0, -1), ALCHEMY_INTENT_PRESETS[selectedIndex]];
}

function IntentChip({
  children,
  label,
  pressed,
  expanded,
  onClick,
}: {
  children: string;
  label?: string;
  pressed?: boolean;
  expanded?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      onClick={onClick}
      className={intentChipClass}
    >
      {children}
    </button>
  );
}

function AlchemyIntentField() {
  const session = useAlchemyCraftSession();
  const [manual, setManual] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const intent = session.intent.trim();
  const custom = intent.length > 0 && !ALCHEMY_INTENT_PRESET_SET.has(intent);
  const shownPresets = expanded
    ? ALCHEMY_INTENT_PRESETS
    : collapsedIntentPresets(visibleCount, intent);
  const hasMore = visibleCount < ALCHEMY_INTENT_PRESETS.length;

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const update = () => {
      const rowWidth = row.clientWidth;
      if (rowWidth <= 0) return;
      const gap = Number.parseFloat(getComputedStyle(measure).columnGap) || 0;
      const presetWidths = [
        ...measure.querySelectorAll<HTMLElement>('[data-preset]'),
      ].map((item) => item.offsetWidth);
      const moreWidth =
        measure.querySelector<HTMLElement>('[data-more]')?.offsetWidth ?? 0;
      const handWidth =
        measure.querySelector<HTMLElement>('[data-hand]')?.offsetWidth ?? 0;
      const presetsWidth = presetWidths.reduce(
        (sum, width, index) => sum + width + (index > 0 ? gap : 0),
        0,
      );
      const count =
        presetsWidth + gap + handWidth <= rowWidth
          ? presetWidths.length
          : Math.max(
              1,
              presetWidths.reduce(
                (fitted, width) => {
                  if (fitted.done) return fitted;
                  const next =
                    fitted.used + width + (fitted.count > 0 ? gap : 0);
                  if (next > rowWidth - moreWidth - handWidth - gap * 2)
                    return { ...fitted, done: true };
                  return { used: next, count: fitted.count + 1, done: false };
                },
                { used: 0, count: 0, done: false },
              ).count,
            );
      setVisibleCount((current) => (current === count ? current : count));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  return (
    <div data-guide="alchemy.intent" className="relative space-y-1">
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
        <div ref={measureRef} className="pointer-events-none flex w-max gap-1">
          {ALCHEMY_INTENT_PRESETS.map((preset) => (
            <span
              key={preset.prompt}
              data-preset
              className={cn(intentChipClass, 'font-semibold')}
            >
              {preset.label}
            </span>
          ))}
          <span data-more className={cn(intentChipClass, 'font-semibold')}>
            更多
          </span>
          <span data-hand className={cn(intentChipClass, 'font-semibold')}>
            手写
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span
          id="alchemy-intent-label"
          className="text-ink-secondary shrink-0 text-xs"
        >
          炼制目标
        </span>
        {manual ? (
          <button
            type="button"
            className="text-ink-secondary hover:text-crimson shrink-0 text-xs"
            onClick={() => setManual(false)}
          >
            快捷
          </button>
        ) : intent ? (
          <span
            className="text-crimson min-w-0 truncate text-xs"
            title={intent}
          >
            {intent}
          </span>
        ) : null}
      </div>
      {manual ? (
        <input
          aria-labelledby="alchemy-intent-label"
          autoFocus
          value={session.intent}
          maxLength={300}
          placeholder="如：炼一炉能补充气血、并护住经脉的丹"
          onChange={(event) => session.setIntent(event.target.value)}
          className="border-ink/20 w-full border-b bg-transparent py-1 text-sm"
        />
      ) : (
        <div
          ref={rowRef}
          role="group"
          aria-labelledby="alchemy-intent-label"
          className={cn(
            'flex items-center gap-1',
            expanded ? 'flex-wrap' : 'flex-nowrap',
          )}
        >
          {shownPresets.map((preset) => (
            <IntentChip
              key={preset.prompt}
              label={preset.prompt}
              pressed={intent === preset.prompt}
              onClick={() =>
                session.setIntent(intent === preset.prompt ? '' : preset.prompt)
              }
            >
              {preset.label}
            </IntentChip>
          ))}
          {hasMore ? (
            <IntentChip
              expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? '收起' : '更多'}
            </IntentChip>
          ) : null}
          <IntentChip pressed={custom} onClick={() => setManual(true)}>
            手写
          </IntentChip>
        </div>
      )}
    </div>
  );
}

export function FurnacePreparationStage() {
  const session = useAlchemyCraftSession();
  const problem =
    session.readiness.error ||
    session.readiness.validation?.blockingReason ||
    session.analysis.error ||
    (session.readiness.estimatedSpiritStones !== null &&
    !session.readiness.canAfford
      ? '灵石不足'
      : '');
  return (
    <div className="space-y-3">
      {session.mode === 'improvised' ? <AlchemyIntentField /> : null}
      {problem ? (
        <p role="alert" className="text-crimson text-xs">
          {problem}
        </p>
      ) : null}
      <footer className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="text-ink-secondary space-y-1 text-xs">
          <p className="font-mono">
            {session.materials.ids.length} / {ALCHEMY_MAX_MATERIALS} 味 ·{' '}
            {session.totalDose} 份
          </p>
          <p>
            {session.readiness.estimatedSpiritStones !== null
              ? `${session.readiness.estimatedSpiritStones.toLocaleString()} 灵石 · ${session.qiCost} 天地灵气`
              : '投入灵材后确定本次消耗'}
          </p>
        </div>
        <span data-guide="alchemy.fire" className="inline-flex">
          <InkButton
            variant="primary"
            pending={session.readiness.loading || session.analysis.loading}
            pendingLabel="正在核对……"
            disabled={
              session.mode === 'improvised'
                ? !session.readyForImprovisedFire
                : !session.readyForFormulaAnalysis ||
                  session.analysis.cooldownRemaining > 0
            }
            onClick={() =>
              session.mode === 'improvised'
                ? session.requestImprovisedFire()
                : void session.analyzeFormula()
            }
          >
            {session.mode === 'improvised'
              ? '开炉炼丹'
              : session.analysis.cooldownRemaining > 0
                ? `${session.analysis.cooldownRemaining} 秒后可预览`
                : '预览丹方'}
          </InkButton>
        </span>
      </footer>
    </div>
  );
}
