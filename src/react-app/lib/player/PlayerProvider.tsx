import { useCultivatorBundle } from '@app/lib/hooks/useCultivatorBundle';
import { createContext, useContext, type ReactNode } from 'react';

export type PlayerState = ReturnType<typeof useCultivatorBundle>;

const PlayerContext = createContext<PlayerState | null>(null);

export function usePlayer(): PlayerState {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }

  return context;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const playerState = useCultivatorBundle();

  return (
    <PlayerContext.Provider value={playerState}>
      {children}
    </PlayerContext.Provider>
  );
}
