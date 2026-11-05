import { createContext } from 'react';

export type NpcConversationPresentation = 'room' | 'map' | 'immersive';

export const RoomPresentation =
  createContext<NpcConversationPresentation>('room');
