import { CultivatorInspectionModal } from '@app/components/feature/cultivator-inspection/CultivatorInspectionModal';
import { GameLoadingState, GameSceneTabs } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { PartyView } from '@daoyou/contracts/party';
import type { CultivatorInspectionData } from '@daoyou/contracts/player';
import { useEffect, useRef, useState } from 'react';
import { PartyChat } from './PartyChat';
import { PartyRecruitmentBoard } from './PartyRecruitmentBoard';
import { PartyRoster } from './PartyRoster';
import { requestParty } from './partyWorkspaceApi';
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
  const [profile, setProfile] = useState<CultivatorInspectionData | null>(null);
  const [inspectionStatus, setInspectionStatus] = useState('');
  const inspection = useRef<AbortController>(null);
  const party = value?.party;
  const hasTabs = !!party && !value.roleMismatch;
  const chat = hasTabs && tab === 'chat';
  useEffect(() => () => inspection.current?.abort(), []);

  async function inspect(path: string, name: string) {
    inspection.current?.abort();
    const abort = new AbortController();
    inspection.current = abort;
    setInspectionStatus(`正在查探「${name}」……`);
    try {
      const result = await requestParty<CultivatorInspectionData>(path, {
        signal: abort.signal,
      });
      if (!abort.signal.aborted) {
        setProfile(result);
        setInspectionStatus('');
      }
    } catch (cause) {
      if (!abort.signal.aborted)
        setInspectionStatus(
          cause instanceof Error ? cause.message : '暂时无法查探这位道友',
        );
    }
  }

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
              inspection.current?.abort();
              setInspectionStatus('');
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
        {!chat && inspectionStatus && (
          <p role="status" className="text-ink-secondary text-sm">
            {inspectionStatus}
          </p>
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
            onInspect={(path, name) => void inspect(path, name)}
          />
        ) : (
          <PartyRecruitmentBoard
            focus={focus}
            invite={invite}
            applications={applications}
            onToggleApplications={() => showApplications(!applications)}
          />
        )}
        <CultivatorInspectionModal
          cultivator={party ? profile : null}
          isOpen={!!party && !!profile}
          onClose={() => setProfile(null)}
          mode="cultivator"
        />
      </div>
    </InkDetailDrawer>
  );
}
