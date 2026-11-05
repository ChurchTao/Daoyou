import {
  NpcConversationPresentationProvider,
  type RoomActorView,
} from '@app/components/feature/room';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

export function SectMapLocationPanel({
  title,
  description,
  footer,
  actors,
  onClose,
  renderConversation,
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  actors: readonly RoomActorView[];
  onClose(): void;
  renderConversation(actorId: string, onExit: () => void): ReactNode;
}) {
  const [actorId, setActorId] = useState<string>();
  const activeActor = actors.find((actor) => actor.id === actorId);
  const activeActorId = activeActor?.id;
  const previousActorId = useRef<string>(undefined);
  const roster = useRef<HTMLDivElement>(null);
  const conversation = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeActorId) {
      previousActorId.current = activeActorId;
      conversation.current?.focus({ preventScroll: true });
    } else if (previousActorId.current) {
      const selector = `[data-map-actor="${CSS.escape(previousActorId.current)}"]`;
      roster.current?.querySelector<HTMLButtonElement>(selector)?.focus();
    }
  }, [activeActorId]);

  const leaveConversation = () => setActorId(undefined);
  return (
    <InkDetailDrawer
      isOpen
      onClose={activeActor ? leaveConversation : onClose}
      closeLabel={activeActor ? '返回地点' : '收起'}
      title={title}
      description={activeActor ? undefined : description}
      footer={activeActor ? undefined : footer}
      size={activeActor ? 'md' : 'sm'}
      className={
        activeActor
          ? 'max-h-[calc(var(--overlay-viewport-height,100dvh)*0.74)] md:max-h-full'
          : 'max-h-[calc(var(--overlay-viewport-height,100dvh)*0.58)] md:max-h-full'
      }
      overlayClassName="bg-ink/20"
    >
      {activeActor ? (
        <div ref={conversation} tabIndex={-1}>
          <NpcConversationPresentationProvider presentation="immersive">
            <Suspense
              fallback={
                <p role="status" className="text-ink-secondary py-5 text-sm">
                  正在等候回应……
                </p>
              }
            >
              {renderConversation(activeActor.id, leaveConversation)}
            </Suspense>
          </NpcConversationPresentationProvider>
        </div>
      ) : (
        <div ref={roster} className="divide-ink/15 divide-y divide-dashed">
          {actors.map((actor) => (
            <button
              key={actor.id}
              type="button"
              data-map-actor={actor.id}
              onClick={() => setActorId(actor.id)}
              className="hover:text-crimson focus-visible:outline-crimson flex min-h-16 w-full items-center gap-3 px-1 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            >
              {actor.portrait || actor.appearance === 'facility' ? (
                <GameIcon
                  value={actor.portrait ?? actor.sigil}
                  purpose="artwork"
                  className="size-12 text-2xl"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-ink-secondary flex size-12 shrink-0 items-center justify-center text-2xl"
                >
                  {actor.sigil}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">
                  {actor.name}
                </span>
                <span className="text-ink-secondary block text-xs leading-5">
                  {actor.identity}
                </span>
                {actor.responsibility ? (
                  <span className="text-ink-secondary block text-xs leading-5">
                    {actor.responsibility}
                  </span>
                ) : null}
              </span>
              <span aria-hidden="true" className="text-ink-secondary text-xs">
                {actor.appearance === 'facility' ? '查看' : '交谈'}
              </span>
            </button>
          ))}
        </div>
      )}
    </InkDetailDrawer>
  );
}
