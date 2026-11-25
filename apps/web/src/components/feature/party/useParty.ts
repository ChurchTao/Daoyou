import type {
  CurrentParty,
  PartyApplicationStatus,
  PartyCommand,
} from '@daoyou/contracts/party';
import type { WorldChatMessageDTO } from '@daoyou/contracts/world-chat';
import { createContext, useContext } from 'react';

export type PartyDraft = {
  partyId: string;
  text: string;
  reply: WorldChatMessageDTO | null;
};
export type PartyResult = CurrentParty & { outcome?: PartyApplicationStatus };
export const PartyContext = createContext<{
  actorId: string;
  value?: CurrentParty;
  error: string;
  busy: boolean;
  unread: number;
  draft?: PartyDraft;
  refresh: () => void;
  send: (command: PartyCommand) => Promise<PartyResult | undefined>;
  setDraft: (update: (draft: PartyDraft) => PartyDraft) => void;
  setChatVisible: (visible: boolean) => void;
} | null>(null);

export function useParty() {
  const party = useContext(PartyContext);
  if (!party) throw new Error('队伍视图须在玩家布局内使用');
  return party;
}
