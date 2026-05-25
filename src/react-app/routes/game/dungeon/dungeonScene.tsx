import { cn } from '@shared/lib/cn';
import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
        ? 'mx-auto w-full max-w-6xl px-3 md:px-6'
        : descriptor.density === 'centered'
          ? 'mx-auto flex min-h-full w-full max-w-3xl items-center justify-center px-3 md:px-6'
          : 'mx-auto w-full max-w-5xl px-3 md:px-6';

  const containerStyle: CSSProperties | undefined =
    descriptor.density === 'full'
      ? undefined
      : {
          paddingTop: DUNGEON_SCENE_CONTENT_TOP_GAP,
          paddingBottom: DUNGEON_SCENE_CONTENT_BOTTOM_GAP,
        };

  return (
    <div className={cn(containerClassName, className)} style={containerStyle}>
      {children}
    </div>
  );
}
