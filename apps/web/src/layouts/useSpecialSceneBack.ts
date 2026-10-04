import { useContext, useEffect } from 'react';
import {
  SpecialSceneContext,
  type SpecialBackOverride,
} from './specialSceneContext';

function useSpecialSceneContext() {
  const context = useContext(SpecialSceneContext);

  if (!context) {
    throw new Error(
      'special scene hooks must be used within a special scene layout',
    );
  }

  return context;
}

export function useSpecialSceneBackOverride() {
  return useSpecialSceneContext().backOverride;
}

export function useSpecialSceneBackAction(
  backOverride: SpecialBackOverride | null,
) {
  const { setBackOverride } = useSpecialSceneContext();
  const label = backOverride?.label;
  const onBack = backOverride?.onBack;

  useEffect(() => {
    setBackOverride(onBack ? { label, onBack } : null);

    return () => {
      setBackOverride(null);
    };
  }, [label, onBack, setBackOverride]);
}
