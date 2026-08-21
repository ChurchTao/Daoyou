import type {
  NpcConversationMessage,
  NpcConversationOption,
} from '@app/components/feature/room';
import { useStorySurface } from '@app/lib/hooks/useStorySurface';
import type {
  StorySurfaceKey,
  StorySurfaceNpcDialogueEntry,
} from '@shared/types/story';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

export interface StoryNpcDialogueController {
  active: boolean;
  messages: NpcConversationMessage[];
  options: NpcConversationOption[];
  busy: boolean;
  error?: string;
  /**
   * true 表示该 option 已被剧情层消费，业务对话不要再处理它。
   */
  handleOption(optionId: string): Promise<boolean>;
  reset(): void;
}

/**
 * 稳定的 NPC 剧情端口。
 *
 * 房间只告诉 Story Runtime：“我现在正在和谁说话”。
 * 它不认识第一卷、节点号、Flag，也不决定剧情内容。
 */
export function useStoryNpcDialogue(
  surface: StorySurfaceKey,
  npcName: string,
): StoryNpcDialogueController {
  const navigate = useNavigate();
  const { entries, interact, loading, error } = useStorySurface(surface, {
    npcName,
  });
  const entry = useMemo(
    () =>
      entries.find(
        (candidate): candidate is StorySurfaceNpcDialogueEntry =>
          candidate.kind === 'npc-dialogue' && candidate.npcName === npcName,
      ),
    [entries, npcName],
  );
  const [openedEntryId, setOpenedEntryId] = useState<string>();
  const [busyActionId, setBusyActionId] = useState<string>();

  // entry 切换时不主动 setState：openedEntryId 与当前 entry.id 不一致即视为未展开。
  const active = Boolean(entry && openedEntryId === entry.id);

  const messages = useMemo<NpcConversationMessage[]>(() => {
    if (!entry || !active) return [];
    return entry.messages.map((message) => ({
      id: `story:${entry.id}:${message.id}`,
      speaker: message.speaker === 'actor' ? npcName : undefined,
      body: message.text,
      tone: message.tone,
    }));
  }, [active, entry, npcName]);

  const options = useMemo<NpcConversationOption[]>(() => {
    if (!entry) return [];
    if (!active) {
      return [
        {
          id: `story-topic:${entry.id}`,
          label: entry.topicLabel,
          tone: entry.topicTone ?? 'normal',
        },
      ];
    }
    return entry.actions.map((action) => ({
      id: `story-action:${entry.id}:${action.id}`,
      label: action.label,
      tone: action.tone ?? 'normal',
      disabled: Boolean(busyActionId),
    }));
  }, [active, busyActionId, entry]);

  const handleOption = useCallback(
    async (optionId: string): Promise<boolean> => {
      if (!entry) return false;
      if (optionId === `story-topic:${entry.id}`) {
        setOpenedEntryId(entry.id);
        return true;
      }

      const prefix = `story-action:${entry.id}:`;
      if (!optionId.startsWith(prefix)) return false;
      const actionId = optionId.slice(prefix.length);
      const action = entry.actions.find((candidate) => candidate.id === actionId);
      if (!action || busyActionId) return true;

      setBusyActionId(action.id);
      try {
        await interact(action.id, { npcName });
        setOpenedEntryId(undefined);
        if (action.href) navigate(action.href);
      } finally {
        setBusyActionId(undefined);
      }
      return true;
    },
    [busyActionId, entry, interact, navigate, npcName],
  );

  return {
    active,
    messages,
    options,
    busy: loading || Boolean(busyActionId),
    error,
    handleOption,
    reset: () => setOpenedEntryId(undefined),
  };
}
