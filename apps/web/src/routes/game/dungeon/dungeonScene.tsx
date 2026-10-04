import { cn } from '@app/lib/cn';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DungeonSceneContext,
  useDungeonSceneDescriptor,
} from './dungeonSceneContext';
import {
  defaultDungeonSceneDescriptor,
  DUNGEON_SCENE_CONTENT_BOTTOM_GAP,
  DUNGEON_SCENE_CONTENT_TOP_GAP,
  type DungeonSceneDescriptor,
} from './dungeonSceneRegistry';

export function DungeonSceneProvider({ children }: { children: ReactNode }) {
  const [descriptor, setDescriptor] = useState<DungeonSceneDescriptor>(
    defaultDungeonSceneDescriptor,
  );
  const value = useMemo(
    () => ({
      descriptor,
      setDescriptor,
    }),
    [descriptor],
  );

  return (
    <DungeonSceneContext.Provider value={value}>
      {children}
    </DungeonSceneContext.Provider>
  );
}

export function DungeonSceneScreen({
  descriptor,
  children,
  className,
}: {
  descriptor: DungeonSceneDescriptor;
  children: ReactNode;
  className?: string;
}) {
  useDungeonSceneDescriptor(descriptor);

  const containerClassName =
    descriptor.density === 'full'
      ? 'h-full'
      : descriptor.density === 'wide'
        ? 'mx-auto w-full max-w-6xl pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]'
        : descriptor.density === 'centered'
          ? 'mx-auto flex min-h-full w-full max-w-3xl items-center justify-center pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]'
          : 'mx-auto w-full max-w-5xl pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]';

  const containerStyle: CSSProperties | undefined =
    descriptor.density === 'full'
      ? undefined
      : {
          paddingTop: DUNGEON_SCENE_CONTENT_TOP_GAP,
          paddingBottom: DUNGEON_SCENE_CONTENT_BOTTOM_GAP,
        };
  const showSceneTitle =
    descriptor.density !== 'full' && descriptor.density !== 'centered';

  return (
    <div className={cn(containerClassName, className)} style={containerStyle}>
      {showSceneTitle ? (
        <header className="border-battle-rule-strong mb-5 border-b border-dashed pb-4 md:mb-6">
          <h1 className="font-heading text-ink text-3xl leading-tight md:text-4xl">
            {descriptor.sceneLabel}
          </h1>
          {descriptor.subtitle ? (
            <p className="text-battle-muted mt-2 text-sm leading-6">
              {descriptor.subtitle}
            </p>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  );
}
