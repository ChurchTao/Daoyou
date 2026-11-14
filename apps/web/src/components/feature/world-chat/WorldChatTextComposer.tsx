import {
  ChatTextComposer,
  type ChatTextComposerProps,
} from '@app/components/feature/chat/ChatTextComposer';
import { InkButton } from '@app/components/ui/InkButton';
import type { WorldChatMessageDTO } from '@daoyou/contracts/world-chat';
import { getWorldChatMessageBody } from './worldChatSummary';

type WorldChatTextComposerProps = Omit<ChatTextComposerProps, 'reply'> & {
  reply: WorldChatMessageDTO | null;
  onClearReply: () => void;
};

export function WorldChatTextComposer({
  reply,
  onClearReply,
  ...props
}: WorldChatTextComposerProps) {
  return (
    <ChatTextComposer
      {...props}
      reply={
        reply ? (
          <div className="border-teal bg-ink/4 mb-2 flex min-w-0 items-center gap-2 border-l-2 px-3 py-1">
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-teal">回复 {reply.senderName}</p>
              <p className="text-ink-secondary truncate">
                {getWorldChatMessageBody(reply)}
              </p>
            </div>
            <InkButton
              className="min-h-11"
              variant="secondary"
              onClick={onClearReply}
            >
              取消
            </InkButton>
          </div>
        ) : null
      }
    />
  );
}
