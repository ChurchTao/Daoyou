import { cn } from '@app/lib/cn';
import type { MysteryLogEntry } from '@daoyou/game-domain/dungeon/mystery';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import './mystery-scenes.css';
import { useTypewriter } from './useMysteryTypewriter';

/** 正文里可以点的字：物件、在场人物或去处；`gone` 是已毁去或已离场的，划去不可点。 */
export interface ProseTarget {
  key: string;
  name: string;
  kind: 'object' | 'npc' | 'exit' | 'gone';
  /** 去处进不去等情形：字照常标出，但显示为灰色。 */
  muted?: boolean;
}

export interface ProseMenuItem {
  label: string;
  /** 动作的代价或说明，小字跟在后面。 */
  note?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

type Span = { start: number; end: number; target: ProseTarget };

/**
 * 给每个目标在正文里找第一处出现的位置，长名字优先、互不重叠；
 * 找不到的目标交给调用方补一句，保证每样东西都点得到。
 */
function locateTargets(texts: string[], targets: ProseTarget[]) {
  const spans: Span[][] = texts.map(() => []);
  const missing: ProseTarget[] = [];
  const ordered = [...targets].sort((a, b) => b.name.length - a.name.length);
  for (const target of ordered) {
    let placed = false;
    for (let p = 0; p < texts.length && !placed; p++) {
      let from = 0;
      for (;;) {
        const start = texts[p]!.indexOf(target.name, from);
        if (start < 0) break;
        const end = start + target.name.length;
        if (spans[p]!.every((s) => end <= s.start || start >= s.end)) {
          spans[p]!.push({ start, end, target });
          placed = true;
          break;
        }
        from = start + 1;
      }
    }
    if (!placed && target.kind !== 'gone') missing.push(target);
  }
  for (const list of spans) list.sort((a, b) => a.start - b.start);
  return { spans, missing };
}

/** 没写进正文的东西，由程序补一句。 */
function fallbackLine(missing: ProseTarget[]) {
  const names = (kind: ProseTarget['kind']) =>
    missing.filter((t) => t.kind === kind).map((t) => t.name);
  const parts = [
    names('object').length ? `此处还有${names('object').join('、')}。` : '',
    names('npc').length ? `${names('npc').join('、')}也在这里。` : '',
    names('exit').length ? `从这里可以前往${names('exit').join('、')}。` : '',
  ];
  return parts.join('');
}

const ENTRY_STYLE: Partial<Record<MysteryLogEntry['kind'], string>> = {
  clue: 'border-crimson/40 border-l-2 pl-3 text-sm leading-7',
  item: 'border-crimson/40 border-l-2 pl-3 text-sm leading-7',
  hint: 'border-wood/50 border-l-2 pl-3 text-sm leading-7',
  event: 'border-ink/40 border-l-2 pl-3 leading-8',
  omen: 'text-crimson/90 leading-8',
  system: 'text-ink-secondary text-sm leading-7',
};

const ENTRY_LABEL: Partial<Record<MysteryLogEntry['kind'], ReactNode>> = {
  clue: <span className="text-crimson mr-2">记下一条线索</span>,
  item: <span className="text-crimson mr-2">得到一件物品</span>,
  hint: <span className="text-wood mr-2">提示</span>,
  event: <span className="text-ink mr-2 font-semibold">突发</span>,
  omen: <span className="mr-2 font-semibold">预兆</span>,
};

/**
 * 调查正文：显示进入当前地点以来的经过，旧段落压暗，新段落渐显；
 * 物件、人物与去处的名字可以点，点开后在字旁弹出动作菜单。
 */
export function MysteryProse({
  entries,
  turn,
  targets,
  menuFor,
  footer,
  typewriter = false,
}: {
  entries: MysteryLogEntry[];
  turn: number;
  targets: ProseTarget[];
  menuFor: (target: ProseTarget) => ProseMenuItem[];
  footer?: ReactNode;
  /** 本回合新段落逐字显出；显出完毕前字不可点。 */
  typewriter?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{
    target: ProseTarget;
    left: number;
    top: number;
  } | null>(null);

  const texts = entries.map((entry) => entry.text);
  const { spans, missing } = locateTargets(texts, targets);
  const extra = fallbackLine(missing);
  const extraSpans = extra ? locateTargets([extra], missing).spans[0]! : [];
  const firstNew = entries.findIndex((entry) => entry.turn === turn);
  // 本回合各段在逐字显示中的起点。
  const offsets: number[] = [];
  let total = 0;
  for (const entry of entries) {
    offsets.push(total);
    if (entry.turn === turn) total += entry.text.length;
  }
  const { shown, typing, skip } = useTypewriter(turn, total, typewriter);

  // 每次行动后把新段落带到视野里。
  useEffect(() => {
    latestRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turn]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (
        event instanceof PointerEvent &&
        (event.target as HTMLElement).closest('[data-prose-menu]')
      )
        return;
      setMenu(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);

  const open = (target: ProseTarget, button: HTMLButtonElement) => {
    const box = containerRef.current?.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(240, box.width);
    setMenu({
      target,
      left: Math.max(0, Math.min(rect.left - box.left, box.width - width)),
      top: rect.bottom - box.top + 6,
    });
  };

  const renderText = (text: string, list: Span[]) => {
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const span of list) {
      parts.push(text.slice(cursor, span.start));
      if (span.target.kind === 'gone') {
        parts.push(
          <span
            key={span.target.key}
            className="text-ink-secondary line-through decoration-1"
          >
            {text.slice(span.start, span.end)}
          </span>,
        );
        cursor = span.end;
        continue;
      }
      const active = menu?.target.key === span.target.key;
      parts.push(
        <button
          key={span.target.key}
          type="button"
          data-prose-menu
          aria-haspopup="menu"
          aria-expanded={active}
          className={cn(
            '-mx-0.5 inline px-0.5 underline decoration-dotted decoration-1 underline-offset-[6px] transition-colors',
            span.target.kind === 'npc'
              ? 'decoration-crimson/70'
              : 'decoration-ink/50',
            span.target.muted ? 'text-ink-secondary' : 'hover:text-crimson',
            active && 'bg-ink/5 text-crimson',
          )}
          onClick={(event) =>
            active ? setMenu(null) : open(span.target, event.currentTarget)
          }
        >
          {text.slice(span.start, span.end)}
        </button>,
      );
      cursor = span.end;
    }
    parts.push(text.slice(cursor));
    return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
  };

  return (
    <div
      ref={containerRef}
      className="relative space-y-4"
      onClick={typing ? skip : undefined}
    >
      {entries.map((entry, index) => {
        const fresh = entry.turn === turn;
        const budget = fresh
          ? Math.max(0, Math.min(entry.text.length, shown - offsets[index]!))
          : entry.text.length;
        // 还没轮到显出的段落先留空位，保留滚动定位用的引用。
        if (fresh && budget === 0)
          return (
            <div key={index} ref={index === firstNew ? latestRef : undefined} />
          );
        return (
          <div
            key={index}
            ref={index === firstNew ? latestRef : undefined}
            className={cn(
              ENTRY_STYLE[entry.kind] ?? 'leading-8',
              fresh ? 'animate-fade-in' : 'opacity-60',
            )}
          >
            <span
              className={cn(
                entry.kind === 'omen' && fresh && 'mystery-omen inline-block',
              )}
            >
              {entry.kind === 'speech' ? (
                <span className="font-semibold">{entry.speaker}：</span>
              ) : (
                ENTRY_LABEL[entry.kind]
              )}
              {budget < entry.text.length
                ? entry.text.slice(0, budget)
                : renderText(entry.text, spans[index]!)}
            </span>
          </div>
        );
      })}
      {extra && !typing ? (
        <p className="text-ink-secondary animate-fade-in leading-8">
          {renderText(extra, extraSpans)}
        </p>
      ) : null}
      {typing ? (
        <p className="text-ink-secondary text-xs">点一下显示全文</p>
      ) : null}
      {footer}

      {menu ? (
        <div
          role="menu"
          data-prose-menu
          className="bg-paper border-ink/20 absolute z-20 w-60 max-w-full border py-1 shadow-[0_8px_24px_rgba(44,24,16,0.12)]"
          style={{ left: menu.left, top: menu.top }}
        >
          {menuFor(menu.target).map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled || !item.onSelect}
              className="hover:bg-ink/5 flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm disabled:cursor-default disabled:hover:bg-transparent"
              onClick={() => {
                setMenu(null);
                item.onSelect?.();
              }}
            >
              <span
                className={
                  item.disabled || !item.onSelect ? 'text-ink-secondary' : ''
                }
              >
                {item.label}
              </span>
              {item.note ? (
                <span className="text-ink-secondary shrink-0 text-xs">
                  {item.note}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
