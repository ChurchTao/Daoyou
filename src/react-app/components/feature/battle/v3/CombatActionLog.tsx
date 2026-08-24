import { InkSwitch } from '@app/components/ui/InkSwitch';
import {
  CombatPresenterV3,
  type CombatLogPresentationModeV3,
  type CombatSequenceV3,
  type PresentedLogGroupV3,
  type PresentedLogLineV3,
  type PresentedLogPartV3,
  type PresentedLogReferenceV3,
} from '@shared/engine/battle-v5/v3';
import { cn } from '@shared/lib/cn';
import type { BattlePlaybackRecordV3 } from '@shared/types/battle';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CombatLogDetailModal } from './CombatLogDetailModal';
import {
  resolveCombatLogDetail,
  type CombatLogDetail,
} from './combatLogDetails';
import { getCombatLogPartClassNameV3 } from './combatLogPresentation';

interface CombatActionLogProps {
  battleResult: BattlePlaybackRecordV3;
  sequences: CombatSequenceV3[];
  currentIndex: number;
  onInspect: () => void;
}

export function CombatActionLogV3({
  battleResult,
  sequences,
  currentIndex,
  onInspect,
}: CombatActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CombatLogPresentationModeV3>('concise');
  const [selectedDetail, setSelectedDetail] = useState<CombatLogDetail | null>(
    null,
  );
  const presenter = useMemo(() => new CombatPresenterV3(mode), [mode]);
  const formattedLogs = useMemo(
    () =>
      sequences
        .map((sequence, originalIdx) => ({
          id: sequence.id,
          originalIdx,
          presentation: presenter.present(sequence),
        }))
        .filter(
          (item) =>
            item.presentation.heading || item.presentation.groups.length > 0,
        ),
    [presenter, sequences],
  );
  const visibleLogs = useMemo(
    () => formattedLogs.filter((item) => item.originalIdx <= currentIndex),
    [currentIndex, formattedLogs],
  );
  const currentSequenceId = sequences[currentIndex]?.id;

  useEffect(() => {
    if (!currentSequenceId) return;
    const timer = setTimeout(() => {
      const scrollContainer = scrollRef.current;
      if (!scrollContainer) return;
      const exactElement = scrollContainer.querySelector(
        `[data-sequence-id="${currentSequenceId}"]`,
      );
      const renderedSequences =
        scrollContainer.querySelectorAll('[data-sequence-id]');
      const activeElement =
        exactElement ?? renderedSequences[renderedSequences.length - 1];
      if (!activeElement) return;
      const activeRect = activeElement.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      scrollContainer.scrollTo({
        top: Math.max(
          0,
          scrollContainer.scrollTop +
            activeRect.top -
            containerRect.top -
            (containerRect.height - activeRect.height) / 2,
        ),
        behavior: 'smooth',
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [currentSequenceId]);

  const inspectReference = (reference: PresentedLogReferenceV3) => {
    onInspect();
    setSelectedDetail(resolveCombatLogDetail(battleResult, reference));
  };

  return (
    <>
      <section className="battle-divider mt-1 flex min-h-0 flex-1 flex-col pt-3">
        <div className="mb-2.5 flex shrink-0 items-center justify-between gap-3">
          <p className="battle-caption text-xs">战斗日志</p>
          <div className="text-battle-muted flex items-center gap-2 text-xs">
            <span className={mode === 'concise' ? 'text-ink' : undefined}>
              精简
            </span>
            <InkSwitch
              checked={mode === 'detailed'}
              onCheckedChange={(checked) =>
                setMode(checked ? 'detailed' : 'concise')
              }
              aria-label="显示详细战斗日志"
            />
            <span className={mode === 'detailed' ? 'text-ink' : undefined}>
              详细
            </span>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="battle-report battle-scroll min-h-0 flex-1 overflow-y-auto pr-1"
        >
          <div className="space-y-1.5 pb-8 [--battle-log-optical-center:0.625rem]">
            {visibleLogs.map((item, index) => {
              const isActive = index === visibleLogs.length - 1;
              return (
                <article
                  key={item.id}
                  data-sequence-id={item.id}
                  className={cn(
                    'px-1 py-1.5 transition-colors',
                    isActive && 'bg-battle-crimson-soft',
                  )}
                >
                  <div className="grid grid-cols-[1.125rem_minmax(0,1fr)] items-stretch gap-x-2">
                    <TimelineRail
                      isActive={isActive}
                      continues={index < visibleLogs.length - 1}
                    />
                    <div className="min-w-0">
                      {item.presentation.heading && (
                        <LogLine
                          line={item.presentation.heading}
                          isActive={isActive}
                          level="sequence"
                          onInspect={inspectReference}
                        />
                      )}
                      {item.presentation.groups.length > 0 && (
                        <LogGroupList
                          groups={item.presentation.groups}
                          isActive={isActive}
                          nested={!!item.presentation.heading}
                          onInspect={inspectReference}
                        />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {visibleLogs.length === 0 && (
              <div className="text-battle-muted flex min-h-full items-center justify-center py-12 text-sm italic">
                战斗即将开始...
              </div>
            )}
          </div>
        </div>
      </section>
      <CombatLogDetailModal
        detail={selectedDetail}
        onClose={() => setSelectedDetail(null)}
      />
    </>
  );
}

function TimelineRail({
  isActive,
  continues,
}: {
  isActive: boolean;
  continues: boolean;
}) {
  return (
    <div className="relative flex justify-center" aria-hidden="true">
      {continues && (
        <span className="border-battle-faint absolute top-[var(--battle-log-optical-center)] bottom-[-0.75rem] left-1/2 -translate-x-1/2 border-l" />
      )}
      <div className="relative h-6 w-full">
        <span
          className={cn(
            'bg-bgpaper absolute top-[var(--battle-log-optical-center)] left-1/2 block size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border',
            isActive ? 'border-crimson bg-crimson' : 'border-battle-muted',
          )}
        />
      </div>
    </div>
  );
}

function LogGroupList({
  groups,
  isActive,
  nested,
  onInspect,
}: {
  groups: PresentedLogGroupV3[];
  isActive: boolean;
  nested: boolean;
  onInspect: (reference: PresentedLogReferenceV3) => void;
}) {
  const content = groups.map((group, groupIndex) => (
    <LogGroup
      key={`${group.id}-${groupIndex}`}
      group={group}
      isActive={isActive}
      nested={nested}
      onInspect={onInspect}
    />
  ));

  if (!nested) {
    return <div className="space-y-0.5">{content}</div>;
  }

  return (
    <div className="border-battle-faint mt-1 ml-1.5 space-y-0.5 border-l pl-3">
      {content}
    </div>
  );
}

function LogGroup({
  group,
  isActive,
  nested,
  onInspect,
}: {
  group: PresentedLogGroupV3;
  isActive: boolean;
  nested: boolean;
  onInspect: (reference: PresentedLogReferenceV3) => void;
}) {
  switch (group.layout) {
    case 'root':
      return group.lines.map((line, lineIndex) => (
        <TreeLogLine
          key={`${lineIndex}-${line.role}`}
          line={line}
          isActive={isActive}
          connected={nested}
          onInspect={onInspect}
        />
      ));
    case 'inline':
      return (
        <TreeLogLine
          line={group.line}
          isActive={isActive}
          connected={nested}
          onInspect={onInspect}
        />
      );
    case 'branch':
      return (
        <div className="space-y-0.5">
          <TreeLogLine
            line={group.heading}
            isActive={isActive}
            connected={nested}
            level={nested ? 'attribution' : 'result'}
            onInspect={onInspect}
          />
          <div className="border-battle-faint ml-1.5 space-y-0.5 border-l pl-3">
            {group.lines.map((line, lineIndex) => (
              <TreeLogLine
                key={`${lineIndex}-${line.role}`}
                line={line}
                isActive={isActive}
                connected
                onInspect={onInspect}
              />
            ))}
          </div>
        </div>
      );
  }
}

function TreeLogLine({
  line,
  isActive,
  connected,
  level = 'result',
  onInspect,
}: {
  line: PresentedLogLineV3;
  isActive: boolean;
  connected: boolean;
  level?: LogLineLevel;
  onInspect: (reference: PresentedLogReferenceV3) => void;
}) {
  return (
    <div className="relative">
      {connected && (
        <span
          aria-hidden="true"
          className="border-battle-faint absolute top-[var(--battle-log-optical-center)] -left-3 w-2 border-t"
        />
      )}
      <LogLine
        line={line}
        isActive={isActive}
        level={level}
        onInspect={onInspect}
      />
    </div>
  );
}

type LogLineLevel = 'sequence' | 'attribution' | 'result';

function LogLine({
  line,
  isActive,
  level = 'result',
  onInspect,
}: {
  line: PresentedLogLineV3;
  isActive: boolean;
  level?: LogLineLevel;
  onInspect: (reference: PresentedLogReferenceV3) => void;
}) {
  return (
    <p
      className={cn(
        'text-sm leading-6 transition-colors',
        isActive ? 'text-ink' : 'text-battle-muted',
        lineClassName(line),
        level === 'attribution' && 'text-ink-secondary text-[13px] font-medium',
        level === 'sequence' &&
          line.role === 'system' &&
          'text-battle-muted text-sm font-medium tracking-wide',
        level === 'sequence' &&
          line.role === 'header' &&
          'text-sm font-semibold',
      )}
    >
      <LogParts parts={line.parts} onInspect={onInspect} />
    </p>
  );
}

function LogParts({
  parts,
  onInspect,
}: {
  parts: PresentedLogPartV3[];
  onInspect: (reference: PresentedLogReferenceV3) => void;
}) {
  return parts.map((part, partIndex) => {
    const key = `${partIndex}-${part.text}`;
    const className = getCombatLogPartClassNameV3(part);
    const reference = part.reference;
    if (!reference) {
      return (
        <span key={key} className={className}>
          {part.text}
        </span>
      );
    }
    return (
      <button
        key={key}
        type="button"
        className={cn(
          className,
          'hover:text-crimson focus-visible:text-crimson cursor-help underline decoration-dotted underline-offset-4 transition-colors focus-visible:outline-none',
        )}
        onClick={() => onInspect(reference)}
        aria-label={`查看${reference.name}的功能说明`}
      >
        {part.text}
      </button>
    );
  });
}

function lineClassName(line: PresentedLogLineV3): string | undefined {
  if (line.role === 'primary') return 'font-medium';
  if (['secondary', 'resource', 'state'].includes(line.role)) {
    return 'text-ink-secondary';
  }
  return undefined;
}
