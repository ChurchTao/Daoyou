import { GameLoadingState } from '@app/components/game-shell';
import type { Mail } from '@app/components/mail/types';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { apiFetch } from '@app/lib/api/fetch';
import { pendingCommandRequest } from '@app/lib/pendingCommandRequest';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  usePlayerMailSummary,
  usePlayerSession,
} from '@app/lib/resources/player';
import { mailLocationText } from '@daoyou/game-rules/mail';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { SystemMailDirectory } from './SystemMailDirectory';
import { SystemMailLetter } from './SystemMailLetter';

const PAGE_SIZE = 20;
function orderedMails(mails: Mail[]) {
  return mails.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function SystemMailPanel({
  onBack,
  obscured = false,
}: {
  onBack: () => void;
  obscured?: boolean;
}) {
  const cultivator = usePlayerSession().data?.activeCultivator;
  const mailSummary = usePlayerMailSummary();
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastViewedId, setLastViewedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [managementOpen, setManagementOpen] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});
  const [readErrors, setReadErrors] = useState<Record<string, string>>({});
  const directoryRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const directoryScrollRef = useRef(0);
  const displayedIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const steppingRef = useRef(false);
  const mailsRef = useRef<Mail[]>([]);
  const loadedPageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const loadedVersionRef = useRef<number | null>(null);
  const refreshRequestedRef = useRef(false);
  const mailRequestRef = useRef<AbortController | null>(null);
  const failedPageRef = useRef({ page: 1, older: false });
  const operationRef = useRef<string | null>(null);
  const readRequestsRef = useRef(new Map<string, AbortController>());
  const failedReadIdsRef = useRef(new Set<string>());
  const selectedMail = mails.find((mail) => mail.id === selectedId);
  const selectedIndex = mails.findIndex((mail) => mail.id === selectedId);

  const commitMails = useCallback((update: (previous: Mail[]) => Mail[]) => {
    const next = update(mailsRef.current);
    mailsRef.current = next;
    setMails(next);
  }, []);

  useLayoutEffect(() => {
    if (!selectedId) {
      const directory = directoryRef.current;
      if (!directory) return;
      directory.scrollTop = directoryScrollRef.current;
      if (lastViewedId && displayedIdRef.current !== null) {
        const row = directory.querySelector<HTMLButtonElement>(
          `[data-mail-row-id="${CSS.escape(lastViewedId)}"]`,
        );
        if (row) {
          const bounds = directory.getBoundingClientRect();
          const rowBounds = row.getBoundingClientRect();
          if (rowBounds.top < bounds.top)
            directory.scrollTop += rowBounds.top - bounds.top;
          else if (rowBounds.bottom > bounds.bottom)
            directory.scrollTop += rowBounds.bottom - bounds.bottom;
          row.focus({ preventScroll: true });
        }
      }
    } else if (displayedIdRef.current !== selectedId && readerRef.current) {
      readerRef.current.scrollTop = 0;
      readerRef.current.focus({ preventScroll: true });
    }
    displayedIdRef.current = selectedId;
  }, [selectedId, lastViewedId]);

  const fetchMails = useCallback(
    async (targetPage: number, older: boolean, summaryVersion: number) => {
      mailRequestRef.current?.abort();
      const controller = new AbortController();
      mailRequestRef.current = controller;
      if (older) setLoadingMore(true);
      else setLoading(true);
      try {
        const existingIds = new Set(mailsRef.current.map((mail) => mail.id));
        const next: Mail[] = [];
        let requestedPage = targetPage;
        let pageHasMore = false;
        while (!controller.signal.aborted) {
          const response = await apiFetch(
            `/api/cultivator/mail?page=${requestedPage}&pageSize=${PAGE_SIZE}`,
            { signal: controller.signal },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '信件读取失败');
          if (controller.signal.aborted) return false;
          const batch = (data.mails ?? []) as Mail[];
          next.push(...batch);
          pageHasMore = Boolean(data.pagination?.hasMore);
          const bridgeHead =
            !older &&
            existingIds.size > 0 &&
            pageHasMore &&
            !batch.some((mail) => existingIds.has(mail.id));
          const repeatedOlderPage =
            older &&
            pageHasMore &&
            batch.every((mail) => existingIds.has(mail.id));
          if (!bridgeHead && !repeatedOlderPage) break;
          if (!batch.length) throw new Error('信件读取中断，请重试');
          requestedPage += 1;
        }
        if (controller.signal.aborted) return false;
        commitMails((previous) =>
          orderedMails([
            ...new Map(
              [...previous, ...next].map((mail) => [mail.id, mail]),
            ).values(),
          ]),
        );
        const disconnectedHead =
          !older &&
          pageHasMore &&
          !next.some((mail) => existingIds.has(mail.id));
        if (older || loadedPageRef.current === 1 || disconnectedHead) {
          setHasMore(pageHasMore);
          hasMoreRef.current = pageHasMore;
          loadedPageRef.current = requestedPage;
        }
        if (!older) loadedVersionRef.current = summaryVersion;
        setLoadError('');
        return true;
      } catch (error) {
        if (!controller.signal.aborted) {
          failedPageRef.current = { page: targetPage, older };
          setLoadError(error instanceof Error ? error.message : '信件读取失败');
        }
        return false;
      } finally {
        if (mailRequestRef.current === controller) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [commitMails],
  );

  const refreshMails = useEffectEvent(() => {
    if (loadingMore) {
      refreshRequestedRef.current = true;
      return;
    }
    refreshRequestedRef.current = false;
    void fetchMails(1, false, mailSummary.version);
  });
  useEffect(() => {
    if (
      !loadingMore &&
      (refreshRequestedRef.current ||
        loadedVersionRef.current !== mailSummary.version)
    )
      refreshMails();
  }, [mailSummary.version, loadingMore]);

  useEffect(() => {
    const readRequests = readRequestsRef.current;
    const off = realtimeClient.subscribe(
      'player-state.events',
      ({ payload }) => {
        if (
          payload.changes.some(
            (change) =>
              change.resourceTopic === 'player.mail-summary' &&
              change.eventType === 'mail.created',
          )
        )
          refreshMails();
      },
    );
    const offReady = realtimeClient.subscribe('ready', () => refreshMails());
    return () => {
      mailRequestRef.current?.abort();
      for (const controller of readRequests.values()) controller.abort();
      readRequests.clear();
      off();
      offReady();
    };
  }, []);

  const markRead = useCallback(
    async (mailId: string) => {
      if (
        readRequestsRef.current.has(mailId) ||
        failedReadIdsRef.current.has(mailId)
      )
        return;
      const controller = new AbortController();
      readRequestsRef.current.set(mailId, controller);
      try {
        await mutate(
          apiFetch('/api/cultivator/mail/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailId }),
            signal: controller.signal,
          }),
        );
        if (controller.signal.aborted) return;
        commitMails((previous) =>
          previous.map((mail) =>
            mail.id === mailId ? { ...mail, isRead: true } : mail,
          ),
        );
        setReadErrors((previous) => {
          const next = { ...previous };
          delete next[mailId];
          return next;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          failedReadIdsRef.current.add(mailId);
          setReadErrors((previous) => ({
            ...previous,
            [mailId]: error instanceof Error ? error.message : '标记已读失败',
          }));
        }
      } finally {
        if (readRequestsRef.current.get(mailId) === controller)
          readRequestsRef.current.delete(mailId);
      }
    },
    [mutate, commitMails],
  );

  const readSelected = useEffectEvent(() => {
    if (
      !selectedMail ||
      selectedMail.isRead ||
      obscured ||
      managementOpen ||
      operationRef.current ||
      document.visibilityState !== 'visible' ||
      !document.hasFocus()
    )
      return;
    const letter = readerRef.current?.querySelector<HTMLElement>(
      `[data-mail-id="${CSS.escape(selectedMail.id)}"]`,
    );
    if (letter?.checkVisibility({ visibilityProperty: true }))
      void markRead(selectedMail.id);
  });
  useEffect(() => {
    if (!selectedId || obscured || managementOpen) return;
    readSelected();
    const onFocus = () => readSelected();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [selectedId, selectedMail?.isRead, obscured, managementOpen, operation]);

  function openMail(id: string) {
    if (!selectedIdRef.current && directoryRef.current)
      directoryScrollRef.current = directoryRef.current.scrollTop;
    selectedIdRef.current = id;
    setLastViewedId(id);
    setSelectedId(id);
  }
  function returnToDirectory() {
    selectedIdRef.current = null;
    setSelectedId(null);
  }
  async function adjacentMail(direction: -1 | 1) {
    if (steppingRef.current) return;
    const currentId = selectedIdRef.current;
    if (!currentId) return;
    const currentIndex = mailsRef.current.findIndex(
      (mail) => mail.id === currentId,
    );
    const target = mailsRef.current[currentIndex + direction];
    if (target) {
      openMail(target.id);
      return;
    }
    if (direction !== 1 || !hasMoreRef.current) return;
    steppingRef.current = true;
    setStepping(true);
    try {
      while (hasMoreRef.current && selectedIdRef.current === currentId) {
        const success = await fetchMails(
          loadedPageRef.current + 1,
          true,
          mailSummary.version,
        );
        if (!success || selectedIdRef.current !== currentId) return;
        const index = mailsRef.current.findIndex(
          (mail) => mail.id === currentId,
        );
        const next = mailsRef.current[index + 1];
        if (next) {
          openMail(next.id);
          return;
        }
      }
    } finally {
      steppingRef.current = false;
      setStepping(false);
    }
  }

  function updateClaimed(ids: Set<string>) {
    commitMails((previous) =>
      previous.map((mail) =>
        ids.has(mail.id) ? { ...mail, isClaimed: true, isRead: true } : mail,
      ),
    );
    setClaimErrors((previous) => {
      const next = { ...previous };
      for (const id of ids) delete next[id];
      return next;
    });
    for (const id of ids) failedReadIdsRef.current.delete(id);
    setReadErrors((previous) => {
      const next = { ...previous };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  async function claim(mail: Mail) {
    if (operationRef.current || mail.isClaimed || !mail.attachments?.length)
      return;
    operationRef.current = mail.id;
    setOperation(mail.id);
    setClaimErrors((previous) => {
      const next = { ...previous };
      delete next[mail.id];
      return next;
    });
    try {
      const result = await mutate<{ locations?: string[] }>(
        apiFetch('/api/cultivator/mail/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailId: mail.id }),
        }),
      );
      updateClaimed(new Set([mail.id]));
      if (result.locations?.length)
        pushToast({
          message: `附件已送至${mailLocationText(result.locations)}`,
          tone: 'success',
        });
    } catch (error) {
      setClaimErrors((previous) => ({
        ...previous,
        [mail.id]:
          error instanceof Error ? error.message : '领取失败，请稍后重试',
      }));
    } finally {
      operationRef.current = null;
      setOperation(null);
    }
  }

  async function claimAll() {
    if (!cultivator || operationRef.current) return;
    const pending = pendingCommandRequest(cultivator.id, 'mail-claim-all');
    operationRef.current = 'claim-all';
    setOperation('claim-all');
    try {
      const data = await mutate<{
        locations?: string[];
        skipped?: { id: string; reason: 'capacity' | 'occupied' }[];
        claimedMailIds: string[];
      }>(
        apiFetch('/api/cultivator/mail/claim-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: pending.requestId }),
        }),
      );
      pending.complete();
      const ids = new Set(data.claimedMailIds ?? []);
      updateClaimed(ids);
      const skipped = data.skipped ?? [];
      if (skipped.length)
        setClaimErrors((previous) => ({
          ...previous,
          ...Object.fromEntries(
            skipped.map((item) => [
              item.id,
              item.reason === 'occupied'
                ? '战斗结束后可领取这只灵兽。'
                : '兽栏空间不足，腾出仓位后可领取。',
            ]),
          ),
        }));
      const waiting = skipped.length
        ? `；${skipped.length} 封灵兽传音待${skipped.some((item) => item.reason === 'occupied') ? '战斗结束或腾出仓位' : '腾出仓位'}后领取`
        : '';
      pushToast({
        message:
          (ids.size
            ? `已领取 ${ids.size} 封传音附件${data.locations?.length ? ` · ${mailLocationText(data.locations)}` : ''}`
            : '暂无可领取附件') + waiting,
        tone: skipped.length ? 'warning' : 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '一键领取失败',
        tone: 'danger',
      });
    } finally {
      operationRef.current = null;
      setOperation(null);
    }
  }

  async function readAll() {
    if (operationRef.current) return;
    operationRef.current = 'read-all';
    setOperation('read-all');
    try {
      await mutate(
        apiFetch('/api/cultivator/mail/read-all', { method: 'POST' }),
      );
      commitMails((previous) =>
        previous.map((mail) => ({ ...mail, isRead: true })),
      );
      failedReadIdsRef.current.clear();
      setReadErrors({});
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '标记已读失败',
        tone: 'danger',
      });
    } finally {
      operationRef.current = null;
      setOperation(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-ink/15 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-dashed pb-2">
        <div className="flex min-w-0 items-center gap-1">
          <InkButton
            variant="secondary"
            className="min-h-11 md:hidden"
            onClick={onBack}
          >
            道友列表
          </InkButton>
          <p className="truncate font-semibold">系统传音</p>
        </div>
        <InkButton
          variant="secondary"
          className="min-h-11 shrink-0"
          onClick={() => setManagementOpen(true)}
        >
          传音管理
        </InkButton>
      </div>
      {loadError ? (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-2 py-2 text-sm"
        >
          <span className="text-crimson flex-1">{loadError}</span>
          <InkButton
            onClick={() =>
              void fetchMails(
                failedPageRef.current.page,
                failedPageRef.current.older,
                mailSummary.version,
              )
            }
          >
            重试读取
          </InkButton>
        </div>
      ) : null}
      {selectedMail ? (
        <>
          <nav
            aria-label="信件阅读导航"
            className="border-ink/10 flex shrink-0 flex-wrap items-center justify-between gap-x-2 border-b border-dashed py-1"
          >
            <InkButton
              variant="secondary"
              className="min-h-11"
              onClick={returnToDirectory}
            >
              返回信件
            </InkButton>
            <div className="flex items-center gap-1">
              <InkButton
                variant="secondary"
                className="min-h-11"
                disabled={stepping || selectedIndex <= 0}
                onClick={() => void adjacentMail(-1)}
              >
                上一封
              </InkButton>
              <InkButton
                variant="secondary"
                className="min-h-11"
                pending={stepping}
                pendingLabel="接续中……"
                disabled={
                  loading ||
                  loadingMore ||
                  (selectedIndex >= mails.length - 1 && !hasMore)
                }
                onClick={() => void adjacentMail(1)}
              >
                下一封
              </InkButton>
            </div>
          </nav>
          {!selectedMail.isRead && readErrors[selectedMail.id] ? (
            <div
              role="alert"
              className="flex shrink-0 items-center gap-2 py-2 text-sm"
            >
              <span className="text-crimson flex-1">
                {readErrors[selectedMail.id]}
              </span>
              <InkButton
                disabled={operation !== null}
                onClick={() => {
                  if (
                    obscured ||
                    managementOpen ||
                    document.visibilityState !== 'visible' ||
                    !document.hasFocus()
                  )
                    return;
                  failedReadIdsRef.current.delete(selectedMail.id);
                  void markRead(selectedMail.id);
                }}
              >
                重试标记已读
              </InkButton>
            </div>
          ) : null}
          <div
            ref={readerRef}
            role="region"
            aria-label="信件阅读"
            tabIndex={-1}
            className="battle-scroll min-h-0 flex-1 overflow-y-auto pt-4 pr-1 focus:outline-none"
          >
            <SystemMailLetter
              key={selectedMail.id}
              mail={selectedMail}
              pending={operation === selectedMail.id}
              claimDisabled={operation !== null}
              onClaim={() => void claim(selectedMail)}
              claimError={claimErrors[selectedMail.id]}
            />
          </div>
        </>
      ) : (
        <div
          ref={directoryRef}
          role="region"
          aria-label="系统传音信件目录"
          className="battle-scroll min-h-0 flex-1 overflow-y-auto pr-1"
          onScroll={() => {
            if (directoryRef.current)
              directoryScrollRef.current = directoryRef.current.scrollTop;
          }}
        >
          {loading && !mails.length ? (
            <GameLoadingState message="正在翻阅传音……" variant="inline" />
          ) : null}
          {!loading && !mails.length && !loadError ? (
            <p className="text-ink-secondary py-10 text-center text-sm">
              暂无系统传音
            </p>
          ) : null}
          <SystemMailDirectory
            mails={mails}
            currentId={lastViewedId}
            onSelect={openMail}
          />
          {hasMore ? (
            <div className="flex min-h-11 justify-center py-2">
              <InkButton
                variant="secondary"
                pending={loadingMore}
                pendingLabel="读取中……"
                disabled={loading}
                onClick={() =>
                  void fetchMails(
                    loadedPageRef.current + 1,
                    true,
                    mailSummary.version,
                  )
                }
              >
                更早信件
              </InkButton>
            </div>
          ) : null}
        </div>
      )}
      <InkDetailDrawer
        isOpen={managementOpen}
        onClose={() => setManagementOpen(false)}
        title="传音管理"
        size="sm"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-ink-secondary text-sm leading-6">
              领取所有可收取的附件，暂时无法入库的灵兽会保留在原传音中。
            </p>
            <InkButton
              variant="primary"
              className="min-h-11"
              pending={operation === 'claim-all'}
              disabled={operation !== null || !mails.length}
              onClick={() => void claimAll()}
            >
              领取全部附件
            </InkButton>
          </div>
          <div className="border-ink/15 space-y-2 border-t border-dashed pt-4">
            <p className="text-ink-secondary text-sm leading-6">
              未读传音{' '}
              <span className="font-mono">
                {mailSummary.data?.unreadCount ?? '—'}
              </span>
            </p>
            <InkButton
              variant="secondary"
              className="min-h-11"
              pending={operation === 'read-all'}
              disabled={operation !== null || !mailSummary.data?.unreadCount}
              onClick={() => void readAll()}
            >
              全部标记已读
            </InkButton>
          </div>
        </div>
      </InkDetailDrawer>
    </div>
  );
}
