import { FriendTargetModal } from '@app/components/feature/friends';
import {
  socialRequest,
  useSocialQuery,
} from '@app/components/feature/friends/socialApi';
import { GameLoadingState } from '@app/components/game-shell';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkNotice, InkTabs } from '@app/components/ui';
import { apiFetch } from '@app/lib/api/fetch';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  FriendRequestDTO,
  FriendSearchResponse,
} from '@daoyou/contracts/friends';
import type { SocialBlockDTO } from '@daoyou/contracts/social';
import { useState } from 'react';

export type FriendsManagementTab = 'find' | 'requests' | 'blocks';
export function FriendsManagement({
  tab,
  onTabChange,
  onClose,
  requests,
}: {
  tab: FriendsManagementTab;
  onTabChange: (tab: FriendsManagementTab) => void;
  onClose: () => void;
  requests: {
    data?: { requests: FriendRequestDTO[] };
    error?: string;
    reload: () => Promise<void>;
  };
}) {
  const actor = usePlayerSession().data?.activeCultivator;
  const blocks = useSocialQuery<{ blocks: SocialBlockDTO[] }>(
    tab === 'blocks' ? '/api/social/blocks' : null,
  );
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<
    FriendSearchResponse['results'] | null
  >(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState('');
  const { pushToast } = useInkUI();
  const incoming =
    requests.data?.requests.filter(
      (request) =>
        request.status === 'pending' && request.direction === 'incoming',
    ) ?? [];
  const outgoing =
    requests.data?.requests.filter(
      (request) =>
        request.status === 'pending' && request.direction === 'outgoing',
    ) ?? [];
  const error = requests.error || blocks.error;
  async function action(
    key: string,
    run: () => Promise<unknown>,
    success?: string,
  ) {
    if (busy) return;
    setBusy(key);
    try {
      await run();
      if (success) pushToast({ message: success, tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '操作失败',
        tone: 'warning',
      });
    } finally {
      setBusy(null);
    }
  }
  async function searchFriends() {
    if (!search.trim() || searchBusy) return;
    setSearchBusy(true);
    try {
      const response = await apiFetch(
        `/api/friends/search?name=${encodeURIComponent(search.trim())}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '寻访失败');
      setResults((result as FriendSearchResponse).results);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '寻访失败',
        tone: 'warning',
      });
    } finally {
      setSearchBusy(false);
    }
  }
  async function share() {
    if (!actor) return;
    const url = `${window.location.origin}/game/friends?addFriend=${actor.id}`;
    try {
      await navigator.clipboard.writeText(url);
      pushToast({ message: '结缘链接已复制', tone: 'success' });
    } catch {
      setShareLink(url);
    }
  }
  const requestRows = (items: FriendRequestDTO[], received: boolean) =>
    items.map((request) => {
      const peer = received ? request.requester : request.recipient;
      return (
        <div
          key={request.id}
          className="border-ink/10 flex flex-wrap items-center justify-between gap-2 border-b border-dashed py-3"
        >
          <div>
            <p>{peer.name}</p>
            <p className="text-ink-secondary text-sm">
              {peer.realm} {peer.realmStage} ·{' '}
              {new Date(request.expiresAt).toLocaleDateString('zh-CN')} 前有效
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {received ? (
              <>
                <InkButton
                  variant="primary"
                  pending={busy === `${request.id}:accept`}
                  disabled={!!busy}
                  onClick={() =>
                    void action(
                      `${request.id}:accept`,
                      () =>
                        socialRequest(
                          `/api/friends/requests/${request.id}/accept`,
                          { expectedRevision: request.revision },
                        ),
                      '已成为好友',
                    )
                  }
                >
                  接受
                </InkButton>
                <InkButton
                  disabled={!!busy}
                  onClick={() =>
                    void action(`${request.id}:reject`, () =>
                      socialRequest(
                        `/api/friends/requests/${request.id}/reject`,
                        { expectedRevision: request.revision },
                      ),
                    )
                  }
                >
                  婉拒
                </InkButton>
              </>
            ) : (
              <InkButton
                disabled={!!busy}
                pending={busy === request.id}
                onClick={() =>
                  void action(request.id, () =>
                    socialRequest(
                      `/api/friends/requests/${request.id}/cancel`,
                      { expectedRevision: request.revision },
                    ),
                  )
                }
              >
                撤回
              </InkButton>
            )}
          </div>
        </div>
      );
    });

  return (
    <>
      <InkModal
        isOpen={!targetId}
        onClose={onClose}
        title="道友往来"
        className="max-w-lg"
        footer={
          <div className="flex justify-end">
            <InkButton variant="secondary" onClick={onClose}>
              返回聊天
            </InkButton>
          </div>
        }
      >
        <InkTabs
          items={[
            { value: 'find', label: '结识道友' },
            {
              value: 'requests',
              label: incoming.length
                ? `结缘申请 · ${incoming.length}`
                : '结缘申请',
            },
            { value: 'blocks', label: '屏蔽管理' },
          ]}
          activeValue={tab}
          onChange={(value) => onTabChange(value as FriendsManagementTab)}
        />
        {error ? (
          <InkNotice tone="warning">
            {error}{' '}
            <InkButton
              onClick={() => {
                void requests.reload();
                void blocks.reload();
              }}
            >
              重试
            </InkButton>
          </InkNotice>
        ) : null}
        {tab === 'find' ? (
          <div className="space-y-4 pt-3">
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void searchFriends();
              }}
            >
              <InkInput
                containerClassName="min-w-0 flex-1"
                label="寻访道友"
                placeholder="输入完整道号"
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setResults(null);
                }}
              />
              <InkButton type="submit" pending={searchBusy}>
                搜索
              </InkButton>
            </form>
            {results ? (
              <section aria-label="寻访结果">
                {results.length ? (
                  results.map((result) => (
                    <div
                      className="border-ink/10 flex flex-wrap items-center justify-between gap-2 border-b border-dashed py-3"
                      key={result.id}
                    >
                      <div>
                        <p>{result.name}</p>
                        <p className="text-ink-secondary text-sm">
                          {result.realm} {result.realmStage} ·{' '}
                          <span className="font-mono">
                            {result.id.slice(0, 8)}
                          </span>
                        </p>
                      </div>
                      <InkButton onClick={() => setTargetId(result.id)}>
                        {result.isFriend
                          ? '查看好友'
                          : result.relationship === 'outgoing'
                            ? '已发申请'
                            : result.relationship === 'incoming'
                              ? '收到申请'
                              : '结缘'}
                      </InkButton>
                    </div>
                  ))
                ) : (
                  <InkNotice>没有找到这个道号，试试分享结缘链接。</InkNotice>
                )}
              </section>
            ) : null}

            <div className="border-ink/15 border-t border-dashed pt-3">
              <p className="text-ink-secondary mb-2 text-sm">
                也可把结缘链接分享给道友。
              </p>
              <InkButton onClick={() => void share()}>
                复制我的结缘链接
              </InkButton>
              {shareLink ? (
                <InkInput
                  label="结缘链接"
                  value={shareLink}
                  readOnly
                  onChange={() => {}}
                />
              ) : null}
            </div>
          </div>
        ) : tab === 'requests' ? (
          <div className="space-y-5">
            <section>
              <h2 className="mb-2 font-semibold">收到的申请</h2>
              {incoming.length ? (
                requestRows(incoming, true)
              ) : (
                <InkNotice>暂无待处理申请。</InkNotice>
              )}
            </section>
            <section>
              <h2 className="mb-2 font-semibold">已发出的申请</h2>
              {outgoing.length ? (
                requestRows(outgoing, false)
              ) : (
                <p className="text-ink-secondary text-sm">
                  暂无等待回复的申请。
                </p>
              )}
            </section>
          </div>
        ) : (
          <div>
            <p className="text-ink-secondary mb-3 text-sm">
              屏蔽按账号生效。解除屏蔽不会自动恢复好友或师徒关系。
            </p>
            {blocks.loading && !blocks.data ? (
              <GameLoadingState message="正在读取屏蔽记录……" variant="inline" />
            ) : null}
            {blocks.data?.blocks.length === 0 ? (
              <InkNotice>暂无屏蔽记录。</InkNotice>
            ) : null}
            {blocks.data?.blocks.map((block) => (
              <div
                key={block.id}
                className="border-ink/10 flex items-center justify-between gap-2 border-b border-dashed py-3"
              >
                <span>{block.name}</span>
                <InkButton
                  pending={busy === block.id}
                  disabled={!!busy}
                  onClick={() =>
                    void action(
                      block.id,
                      () =>
                        socialRequest(
                          `/api/social/blocks/${block.id}`,
                          undefined,
                          'DELETE',
                        ),
                      '已解除屏蔽',
                    )
                  }
                >
                  解除屏蔽
                </InkButton>
              </div>
            ))}
          </div>
        )}
      </InkModal>
      <FriendTargetModal
        targetId={targetId}
        onClose={() => setTargetId(null)}
      />
    </>
  );
}
