import { createContext, useContext, useLayoutEffect } from 'react';
import {
  defaultDungeonSceneDescriptor,
  type DungeonSceneDescriptor,
} from './dungeonSceneRegistry';

interface DungeonSceneContextValue {
  descriptor: DungeonSceneDescriptor;
  setDescriptor: (next: DungeonSceneDescriptor) => void;
}

export const DungeonSceneContext =
  createContext<DungeonSceneContextValue | null>(null);

function useDungeonSceneContext() {
  const context = useContext(DungeonSceneContext);

  if (!context) {
    throw new Error(
      'dungeon scene hooks must be used within a dungeon scene provider',
    );
  }

  return context;
}

export function useResolvedDungeonScene() {
  return useDungeonSceneContext().descriptor;
}

export function useDungeonSceneDescriptor(descriptor: DungeonSceneDescriptor) {
  const { setDescriptor } = useDungeonSceneContext();

  useLayoutEffect(() => {
    setDescriptor(descriptor);

    return () => {
      setDescriptor(defaultDungeonSceneDescriptor);
    };
  }, [descriptor, setDescriptor]);
}
