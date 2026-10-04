import { createContext, useContext } from 'react';
import type { AlchemyCraftSession } from './useAlchemyCraftSessionState';

export const AlchemyCraftContext = createContext<AlchemyCraftSession | null>(
  null,
);

export function useAlchemyCraftSession(): AlchemyCraftSession {
  const value = useContext(AlchemyCraftContext);
  if (!value)
    throw new Error(
      'useAlchemyCraftSession must be used inside AlchemyCraftSessionProvider',
    );
  return value;
}

export {
  ALCHEMY_MAX_DOSE,
  ALCHEMY_MAX_MATERIALS,
  ALCHEMY_MIN_DOSE,
} from './useAlchemyCraftSessionState';
