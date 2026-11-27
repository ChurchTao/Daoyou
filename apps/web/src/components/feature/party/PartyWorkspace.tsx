import { CharacterCardContent } from '@app/components/feature/character-card/CharacterCardContent';
import { CharacterCardDialog } from '@app/components/feature/character-card/CharacterCardDialog';
import { GameLoadingState, GameSceneTabs } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { PartyView } from '@daoyou/contracts/party';
import { useEffect, useState } from 'react';
import { PartyChat } from './PartyChat';
import { PartyRecruitmentBoard } from './PartyRecruitmentBoard';
import { PartyRoster } from './PartyRoster';
import { useParty, type PartyRecruitmentFocus } from './useParty';

function PartyConversation({ party }: { party: PartyView }) {
  const { actorId, draft, setDraft, setChatVisible } = useParty();
  useEffect(() => {
    setChatVisible(true);
    return () => setChatVisible(false);
  }, [setChatVisible]);
  return (
    <PartyChat
      team={party}
      actorId={actorId}
      draft={draft?.text ?? ''}
      reply={draft?.reply ?? null}
      setDraft={(update) =>
        setDraft((old) => ({
          ...old,
          text: typeof update === 'function' ? update(old.text) : update,
        }))
      }
      setReply={(update) =>
        setDraft((old) => ({
          ...old,
          reply: typeof update === 'function' ? update(old.reply) : update,
        }))
      }
    />
  );
}

export function PartyWorkspace({
  initialTab,
  invite,
  focus,
  inHuntOverlay,
  onClose,
}: {
  initialTab: 'party' | 'chat';
  invite?: string;
  focus?: PartyRecruitmentFocus;
  inHuntOverlay: boolean;
  onClose: () => void;
}) {
  const { value, error, unread, refresh } = useParty();
  const [tab, setTab] = useState(initialTab);
  const [applications, showApplications] = useState(false);
  const [card, setCard] = useState<{ id: string; path: string } | null>(null);
  const party = value?.party;
  const hasTabs = !!party && !value.roleMismatch;
  const chat = hasTabs && tab === 'chat';

  const closeLabel =
    focus?.kind === 'hunt'
      ? '返回讨伐'
      : focus?.kind === 'invasion'
        ? '返回营地'
        : focus?.kind === 'arena'
          ? '返回擂台'
          : undefined;

  return (
    <InkDetailDrawer
      isOpen
      onClose={onClose}
      title={
        !value || party
          ? '队伍'
          : applications
            ? '我的申请'
            : invite
              ? '入队邀请'
              : '队伍'
      }
      closeLabel={closeLabel}
      size="md"
      className="party-drawer max-h-[calc(var(--overlay-viewport-height,100dvh)*0.86)] min-h-[min(26rem,calc(var(--overlay-viewport-height,100dvh)*0.86))] md:h-full md:max-h-full"
      bodyClassName="flex flex-col overflow-hidden pt-2"
      overlayClassName={inHuntOverlay ? 'bg-transparent' : undefined}
      headerContent={
        hasTabs ? (
          <GameSceneTabs
            className="[&_button]:min-h-11 [&_button]:pb-0"
            activeValue={tab}
            items={[
              { value: 'party', label: '队伍' },
              {
                value: 'chat',
                label: unread
                  ? `传音（${unread > 99 ? '99+' : unread}）`
                  : '传音',
              },
            ]}
            onChange={(next) => {
              setCard(null);
              setTab(next === 'chat' ? 'chat' : 'party');
            }}
          />
        ) : undefined
      }
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-3"
        data-party-tab={chat ? 'chat' : 'party'}
      >
        {error && (
          <InkNotice tone="warning">
            {error}
            {!value && (
              <InkButton variant="secondary" onClick={refresh}>
                重试
              </InkButton>
            )}
          </InkNotice>
        )}
        {!value ? (
          !error && (
            <GameLoadingState variant="inline" message="正在读取队伍……" />
          )
        ) : chat && party ? (
          <PartyConversation key={party.id} party={party} />
        ) : party ? (
          <PartyRoster
            key={party.id}
            party={party}
            current={value}
            focus={focus}
            onInspect={(id, path) => setCard({ id, path })}
          />
        ) : (
          <PartyRecruitmentBoard
            focus={focus}
            invite={invite}
            applications={applications}
            onToggleApplications={() => showApplications(!applications)}
          />
        )}
        {hasTabs && !chat && card ? (
          <CharacterCardDialog onClose={() => setCard(null)}>
            <CharacterCardContent
              key={card.path}
              id={card.id}
              path={card.path}
            />
          </CharacterCardDialog>
        ) : null}
      </div>
    </InkDetailDrawer>
  );
}
