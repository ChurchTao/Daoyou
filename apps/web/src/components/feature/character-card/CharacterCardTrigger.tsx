import { InkButton } from '@app/components/ui/InkButton';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { ApiSuccess } from '@daoyou/contracts/http';
import type { CharacterCard } from '@daoyou/contracts/player/card';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CharacterCardView } from './CharacterCardView';

export function CharacterCardTrigger({
  id,
  name,
  children,
  onSelectFriend,
}: {
  id: string;
  name: string;
  children: ReactNode;
  onSelectFriend?: (id: string) => void;
}) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CharacterCard | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const cancel = () => clearTimeout(timer.current);
  const close = () => {
    cancel();
    panel.current?.hidePopover();
  };
  const show = () => {
    cancel();
    panel.current?.showPopover();
  };
  const leave = () => {
    cancel();
    timer.current = setTimeout(close, 250);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchJsonCached<ApiSuccess<CharacterCard>>(`/api/cultivator/${id}/card`, {
      key: `character-card:${id}`,
      ttlMs: 5000,
    })
      .then((response) => {
        if (!cancelled) {
          setCard(response.data);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : '名片读取失败');
      });
    return () => {
      cancelled = true;
    };
  }, [id, open, attempt]);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!panel.current || !trigger.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const rect = panel.current.getBoundingClientRect();
      panel.current.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - rect.width - 8))}px`;
      panel.current.style.top = `${Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - rect.height - 8))}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, card, error]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`查看${name}的名片`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="focus-visible:outline-crimson min-w-0 cursor-pointer text-left underline-offset-2 hover:underline"
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') {
            cancel();
            timer.current = setTimeout(show, 250);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') leave();
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) show();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
        onClick={show}
      >
        {children}
      </button>
      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label={`${name}的名片`}
        onToggle={(event) => {
          if (event.target === event.currentTarget)
            setOpen(event.newState === 'open');
        }}
        onPointerEnter={cancel}
        onPointerLeave={(event) => {
          if (
            event.pointerType === 'mouse' &&
            !panel.current?.contains(document.activeElement)
          )
            leave();
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'Escape' &&
            !event.currentTarget.querySelector('[popover]:popover-open') &&
            event.target instanceof Element &&
            event.target.closest('[popover]') === event.currentTarget
          ) {
            event.preventDefault();
            event.stopPropagation();
            trigger.current?.focus();
            close();
          }
        }}
        className="border-ink/30 bg-bgpaper text-ink fixed inset-auto m-0 max-h-[min(80dvh,44rem)] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain border p-4 shadow-xl"
      >
        {open ? (
          <>
            <div className="text-ink-secondary mb-2 flex items-center justify-between text-xs">
              <span>道友名片</span>
              <button
                type="button"
                aria-label="关闭名片"
                className="-mt-2 -mr-2 flex size-9 items-center justify-center text-lg"
                onClick={close}
              >
                ×
              </button>
            </div>
            {error ? (
              <div role="alert" className="space-y-2 text-sm">
                <p>{error}</p>
                <InkButton
                  onClick={() => {
                    setError('');
                    setAttempt((value) => value + 1);
                  }}
                >
                  重试
                </InkButton>
              </div>
            ) : card ? (
              <CharacterCardView card={card} />
            ) : (
              <p className="text-ink-secondary py-4 text-sm">正在展开名片……</p>
            )}
            {card && onSelectFriend ? (
              <div className="border-ink/15 mt-3 border-t pt-2">
                <InkButton
                  onClick={() => {
                    close();
                    onSelectFriend(id);
                  }}
                >
                  收录道友
                </InkButton>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
