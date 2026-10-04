import { useMemo, useState, type ReactNode } from 'react';
import {
  SpecialSceneContext,
  type SpecialBackOverride,
} from './specialSceneContext';

export function SpecialSceneProvider({ children }: { children: ReactNode }) {
  const [backOverride, setBackOverride] = useState<SpecialBackOverride | null>(
    null,
  );
  const value = useMemo(
    () => ({
      backOverride,
      setBackOverride,
    }),
    [backOverride],
  );

  return (
    <SpecialSceneContext.Provider value={value}>
      {children}
    </SpecialSceneContext.Provider>
  );
}
