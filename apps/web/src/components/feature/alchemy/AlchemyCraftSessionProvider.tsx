import type { ReactNode } from 'react';
import { AlchemyCraftContext } from './alchemyCraftContext';
import type { AlchemySectContext } from './alchemyTypes';
import { useAlchemyCraftSessionState } from './useAlchemyCraftSessionState';

export function AlchemyCraftSessionProvider({
  children,
  sectContext,
}: {
  children: ReactNode;
  sectContext?: AlchemySectContext;
}) {
  const value = useAlchemyCraftSessionState(sectContext);
  return (
    <AlchemyCraftContext.Provider value={value}>
      {children}
    </AlchemyCraftContext.Provider>
  );
}
