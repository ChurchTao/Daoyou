import { createContext } from 'react';

export type SpecialBackOverride = {
  label?: string;
  onBack: () => void;
};

interface SpecialSceneContextValue {
  backOverride: SpecialBackOverride | null;
  setBackOverride: (next: SpecialBackOverride | null) => void;
}

export const SpecialSceneContext =
  createContext<SpecialSceneContextValue | null>(null);
