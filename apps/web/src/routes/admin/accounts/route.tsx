import { apiFetch } from '@app/lib/api/fetch';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkSelect } from '@app/components/ui';
import { authClient } from '@app/lib/auth/client';
import type {
  AdminAccountBanDuration,
  AdminAccountErrorResponse,
  AdminAccountListItem,
  AdminAccountListResponse,
  AdminAccountModerationResponse,
} from '@daoyou/contracts/admin/accounts';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

const PAGE_SIZE = 20;

const PROVIDER_LABELS: Record<string, string> = {
  credential: '邮箱密码',
  github: 'GitHub',
};

function formatDateTime(value: string | null): string {
  if (!value) return '暂无';
  return new Date(value).toLocaleString();
}

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function isBanExpired(account: AdminAccountListItem): boolean {
  return Boolean(
    account.banned &&
    account.banExpires &&
    new Date(account.banExpires).getTime() <= Date.now(),
  );
}

async function readPayload<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({
    success: false,
    error: '服务器返回了无法解析的响应',
  }))) as T;
}

export default function AdminAccountsPage() {
  const { openDialog, pushToast } = useInkUI();
  const sessionState = authClient.useSession();
  const operatorUserId = sessionState.data?.user.id;

  const [accounts, setAccounts] = useState<AdminAccountListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<'email' | 'name'>('email');
  const [verified, setVerified] = useState<'all' | 'true' | 'false'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionRevokePending, setSessionRevokePending] = useState<Set<string>>(
    new Set(),
  );
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] =
    useState<AdminAccountBanDuration>('7_days');
  const [moderatingUserId, setModeratingUserId] = useState<string | null>(null);

  const loadAccounts = useCallback(
    async (signal?: AbortSignal) => {
      await Promise.resolve();
      if (signal?.aborted) return;
      setLoading(true);
      setLoadError(null);

      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          searchField,
          verified,
        });
        if (search) query.set('search', search);

        const response = await apiFetch(
          `/api/admin/accounts?${query.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
            signal,
          },
        );
        const payload = await readPayload<
          AdminAccountListResponse | AdminAccountErrorResponse
        >(response);

        if (!payload.success) {
          throw new Error(payload.error || '加载账号列表失败');
        }
        if (!response.ok) {
          throw new Error('加载账号列表失败');
        }

        setAccounts(payload.data.accounts);
        setTotal(payload.data.total);
      } catch (error) {
        if (signal?.aborted) return;
        const message =
          error instanceof Error ? error.message : '加载账号列表失败';
        setLoadError(message);
        pushToast({ message, tone: 'danger' });
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [page, pushToast, search, searchField, verified],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadAccounts(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadAccounts, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const editingAccount = useMemo(
    () => accounts.find((account) => account.userId === editingUserId) ?? null,
    [accounts, editingUserId],
  );

  const resetEmailForm = () => {
    setEditingUserId(null);
    setNewEmail('');
    setConfirmEmail('');
  };

  const resetBanForm = () => {
    setBanningUserId(null);
    setBanReason('');
    setBanDuration('7_days');
  };

  const beginEmailChange = (account: AdminAccountListItem) => {
    resetBanForm();
    setEditingUserId(account.userId);
    setNewEmail('');
    setConfirmEmail('');
  };

  const beginBan = (account: AdminAccountListItem) => {
    resetEmailForm();
    setBanningUserId(account.userId);
    setBanReason('');
    setBanDuration('7_days');
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextSearch = searchDraft.trim();
    const shouldForceRefresh = page === 1 && nextSearch === search;
    setPage(1);
    setSearch(nextSearch);
    if (shouldForceRefresh) {
      setRefreshKey((value) => value + 1);
    }
  };

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingAccount || saving) return;

    const normalizedEmail = newEmail.trim().toLowerCase();
    const normalizedConfirmation = confirmEmail.trim().toLowerCase();

    if (!normalizedEmail || !normalizedConfirmation) {
      pushToast({ message: '请填写并确认新邮箱', tone: 'danger' });
      return;
    }
    if (normalizedEmail !== normalizedConfirmation) {
      pushToast({ message: '两次输入的新邮箱不一致', tone: 'danger' });
      return;
    }
    if (normalizedEmail === editingAccount.email.toLowerCase()) {
      pushToast({ message: '新邮箱不能与当前邮箱相同', tone: 'danger' });
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(
        `/api/admin/accounts/${editingAccount.userId}/change-email`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedCurrentEmail: editingAccount.email,
            newEmail: normalizedEmail,
          }),
        },
      );
      const payload = await readPayload<
        | {
            success: true;
            data: {
              userId: string;
              email: string;
              emailVerified: false;
              sessionsRevoked: true;
            };
          }
        | AdminAccountErrorResponse
      >(response);

      if (!payload.success) {
        if (
          payload.code === 'EMAIL_CHANGED_SESSION_REVOKE_FAILED' &&
          payload.partial
        ) {
          setSessionRevokePending((current) => {
            const next = new Set(current);
            next.add(payload.partial!.userId);
            return next;
          });
          resetEmailForm();
          setRefreshKey((value) => value + 1);
        }
        throw new Error(payload.error || '邮箱改绑失败');
      }
      if (!response.ok) {
        throw new Error('邮箱改绑失败');
      }

      pushToast({
        message: '邮箱已改绑为未验证状态，账号现有会话已全部撤销',
        tone: 'success',
        duration: 6000,
      });
      resetEmailForm();

      if (operatorUserId === payload.data.userId) {
        window.location.assign('/login');
        return;
      }

      setRefreshKey((value) => value + 1);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '邮箱改绑失败',
        tone: 'danger',
        duration: 6000,
      });
    } finally {
      setSaving(false);
    }
  };

  const revokeSessions = async (userId: string) => {
    if (revokingUserId) return;
    setRevokingUserId(userId);

    try {
      const response = await apiFetch(
        `/api/admin/accounts/${userId}/revoke-sessions`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      const payload = await readPayload<
        | { success: true; data: { userId: string; sessionsRevoked: true } }
        | AdminAccountErrorResponse
      >(response);

      if (!payload.success) {
        throw new Error(payload.error || '撤销账号会话失败');
      }
      if (!response.ok) {
        throw new Error('撤销账号会话失败');
      }

      setSessionRevokePending((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      pushToast({ message: '账号会话已全部撤销', tone: 'success' });

      if (operatorUserId === userId) {
        window.location.assign('/login');
        return;
      }

      setRefreshKey((value) => value + 1);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '撤销账号会话失败',
        tone: 'danger',
      });
    } finally {
      setRevokingUserId(null);
    }
  };

  const confirmRevokeSessions = (account: AdminAccountListItem) => {
    openDialog({
      title: '确认强制下线',
      content: (
        <p className="text-ink-secondary text-sm leading-7">
          将撤销账号“{account.name}”（{account.email}）的全部登录会话。
          {operatorUserId === account.userId
            ? '这是当前管理员账号，操作成功后将返回登录页。'
            : '玩家需要重新登录。'}
        </p>
      ),
      confirmLabel: '确认下线',
      cancelLabel: '取消',
      onConfirm: () => revokeSessions(account.userId),
    });
  };

  const banAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!banningUserId || moderatingUserId) return;

    const account = accounts.find((item) => item.userId === banningUserId);
    const reason = banReason.trim();
    if (!account || !reason) {
      pushToast({ message: '请填写封禁原因', tone: 'danger' });
      return;
    }

    setModeratingUserId(account.userId);
    try {
      const response = await apiFetch(
        `/api/admin/accounts/${account.userId}/ban`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason,
            duration: banDuration,
          }),
        },
      );
      const payload = await readPayload<
        AdminAccountModerationResponse | AdminAccountErrorResponse
      >(response);

      if (!payload.success) {
        throw new Error(payload.error || '封禁账号失败');
      }
      if (!response.ok) {
        throw new Error('封禁账号失败');
      }

      resetBanForm();
      setSessionRevokePending((current) => {
        const next = new Set(current);
        next.delete(account.userId);
        return next;
      });
      pushToast({
        message: '账号已封禁，现有会话已全部撤销',
        tone: 'success',
      });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '封禁账号失败',
        tone: 'danger',
      });
    } finally {
      setModeratingUserId(null);
    }
  };

  const unbanAccount = async (account: AdminAccountListItem) => {
    if (moderatingUserId) return;
    setModeratingUserId(account.userId);

    try {
      const response = await apiFetch(
        `/api/admin/accounts/${account.userId}/unban`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      const payload = await readPayload<
        AdminAccountModerationResponse | AdminAccountErrorResponse
      >(response);

      if (!payload.success) {
        throw new Error(payload.error || '解除封禁失败');
      }
      if (!response.ok) {
        throw new Error('解除封禁失败');
      }

      pushToast({ message: '账号封禁已解除', tone: 'success' });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '解除封禁失败',
        tone: 'danger',
      });
    } finally {
      setModeratingUserId(null);
    }
  };

  const confirmUnban = (account: AdminAccountListItem) => {
    openDialog({
      title: '确认解除封禁',
      content: (
        <p className="text-ink-secondary text-sm leading-7">
          将允许账号“{account.name}”（{account.email}）重新登录。
        </p>
      ),
      confirmLabel: '确认解封',
      cancelLabel: '取消',
      onConfirm: () => unbanAccount(account),
    });
  };

  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          ACCOUNT OPERATIONS
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">账号管理</h2>
        <p className="text-ink-secondary mt-2 max-w-3xl text-sm leading-7">
          查询 Better Auth
          账号与活跃角色摘要，并执行封禁、解封和强制下线。邮箱改绑后会立即变为未验证状态并撤销全部会话；
          本工具不会主动发送验证邮件，玩家使用新邮箱再次登录时会触发现有验证流程。封禁账号会同时撤销其全部会话。
        </p>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-5 border border-dashed p-6">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={submitSearch}
        >
          <InkSelect
            label="搜索字段"
            size="sm"
            value={searchField}
            onChange={(value) => {
              setSearchField(value as 'email' | 'name');
              setPage(1);
            }}
          >
            <option value="email">邮箱</option>
            <option value="name">账号昵称</option>
          </InkSelect>
          <div className="min-w-[260px] flex-1">
            <InkInput
              label="搜索内容"
              size="sm"
              value={searchDraft}
              placeholder={
                searchField === 'email' ? '输入邮箱关键字' : '输入账号昵称'
              }
              onChange={setSearchDraft}
            />
          </div>
          <InkSelect
            label="验证状态"
            size="sm"
            value={verified}
            onChange={(value) => {
              setVerified(value as 'all' | 'true' | 'false');
              setPage(1);
            }}
          >
            <option value="all">全部</option>
            <option value="true">已验证</option>
            <option value="false">未验证</option>
          </InkSelect>
          <InkButton type="submit" variant="primary" disabled={loading}>
            搜索
          </InkButton>
          <InkButton
            variant="secondary"
            disabled={loading}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            刷新
          </InkButton>
        </form>

        {loadError ? (
          <div className="border-crimson/30 bg-crimson/5 text-crimson border border-dashed p-4 text-sm leading-7">
            {loadError}
          </div>
        ) : null}

        <div className="border-ink/15 bg-bgpaper/80 overflow-x-auto border border-dashed">
          <table className="w-full min-w-[1360px] text-sm">
            <thead className="border-ink/10 text-ink-secondary border-b text-left">
              <tr>
                <th className="px-3 py-2">账号</th>
                <th className="px-3 py-2">登录邮箱</th>
                <th className="px-3 py-2">账号状态</th>
                <th className="px-3 py-2">登录方式</th>
                <th className="px-3 py-2">活跃角色</th>
                <th className="px-3 py-2">会话</th>
                <th className="px-3 py-2">注册时间</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="text-ink-secondary px-3 py-6" colSpan={8}>
                    加载中...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td className="text-ink-secondary px-3 py-6" colSpan={8}>
                    暂无符合条件的账号
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <Fragment key={account.userId}>
                    <tr className="border-ink/8 border-b align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold">{account.name}</p>
                        <p className="text-ink-secondary mt-1 max-w-48 font-mono text-[11px] break-all">
                          {account.userId}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="break-all">{account.email}</p>
                        <p
                          className={
                            account.emailVerified
                              ? 'text-teal mt-1 text-xs'
                              : 'text-crimson mt-1 text-xs'
                          }
                        >
                          {account.emailVerified ? '已验证' : '未验证'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {account.banned ? (
                          <>
                            <p
                              className={
                                isBanExpired(account)
                                  ? 'text-ink-secondary font-semibold'
                                  : 'text-crimson font-semibold'
                              }
                            >
                              {isBanExpired(account) ? '封禁已过期' : '已封禁'}
                            </p>
                            <p className="text-ink-secondary mt-1 max-w-52 text-xs break-words">
                              原因：{account.banReason || '未填写'}
                            </p>
                            <p className="text-ink-secondary mt-1 text-xs">
                              {account.banExpires
                                ? `截止：${formatDateTime(account.banExpires)}`
                                : '期限：永久'}
                            </p>
                          </>
                        ) : (
                          <span className="text-teal">正常</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {account.providers.length > 0
                          ? account.providers.map(providerLabel).join('、')
                          : '暂无'}
                      </td>
                      <td className="px-3 py-3">
                        {account.activeCultivator ? (
                          <>
                            <p className="font-semibold">
                              {account.activeCultivator.name}
                            </p>
                            <p className="text-ink-secondary mt-1 text-xs">
                              {account.activeCultivator.realm}
                              {account.activeCultivator.realmStage} · 最近活跃：
                              {formatDateTime(
                                account.activeCultivator.lastActiveAt,
                              )}
                            </p>
                          </>
                        ) : (
                          <span className="text-ink-secondary">无活跃角色</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p>有效会话：{account.activeSessionCount}</p>
                        <p className="text-ink-secondary mt-1 text-xs">
                          最近：{formatDateTime(account.lastSessionAt)}
                        </p>
                      </td>
                      <td className="text-ink-secondary px-3 py-3">
                        {formatDateTime(account.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <InkButton
                            variant="secondary"
                            disabled={
                              saving ||
                              Boolean(revokingUserId) ||
                              Boolean(moderatingUserId)
                            }
                            onClick={() => beginEmailChange(account)}
                          >
                            改绑邮箱
                          </InkButton>
                          <InkButton
                            variant={
                              sessionRevokePending.has(account.userId)
                                ? 'primary'
                                : 'secondary'
                            }
                            disabled={Boolean(revokingUserId)}
                            onClick={() =>
                              sessionRevokePending.has(account.userId)
                                ? void revokeSessions(account.userId)
                                : confirmRevokeSessions(account)
                            }
                          >
                            {revokingUserId === account.userId
                              ? '下线中...'
                              : sessionRevokePending.has(account.userId)
                                ? '重试下线'
                                : '强制下线'}
                          </InkButton>
                          {account.banned ? (
                            <InkButton
                              variant="secondary"
                              disabled={Boolean(moderatingUserId)}
                              onClick={() => confirmUnban(account)}
                            >
                              {moderatingUserId === account.userId
                                ? '解封中...'
                                : '解除封禁'}
                            </InkButton>
                          ) : (
                            <InkButton
                              variant="primary"
                              disabled={
                                account.userId === operatorUserId ||
                                Boolean(moderatingUserId)
                              }
                              onClick={() => beginBan(account)}
                            >
                              {account.userId === operatorUserId
                                ? '不可封禁本人'
                                : '封禁账号'}
                            </InkButton>
                          )}
                        </div>
                      </td>
                    </tr>

                    {editingUserId === account.userId ? (
                      <tr className="border-crimson/15 bg-crimson/3 border-b">
                        <td className="px-4 py-5" colSpan={8}>
                          <form
                            className="space-y-4"
                            onSubmit={(event) => void changeEmail(event)}
                          >
                            <div>
                              <h3 className="font-heading text-ink text-xl">
                                改绑登录邮箱
                              </h3>
                              <p className="text-ink-secondary mt-2 text-sm leading-7">
                                目标账号：{account.name}（{account.email}）。
                                提交后新邮箱将标记为未验证，全部现有会话会被撤销，且此工具不会发送验证邮件。
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <InkInput
                                label="新邮箱"
                                type="email"
                                value={newEmail}
                                disabled={saving}
                                placeholder="player@example.com"
                                onChange={setNewEmail}
                              />
                              <InkInput
                                label="再次确认新邮箱"
                                type="email"
                                value={confirmEmail}
                                disabled={saving}
                                placeholder="再次输入完整新邮箱"
                                onChange={setConfirmEmail}
                              />
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <InkButton
                                type="submit"
                                variant="primary"
                                disabled={saving}
                              >
                                {saving ? '改绑中...' : '确认改绑并下线'}
                              </InkButton>
                              <InkButton
                                variant="secondary"
                                disabled={saving}
                                onClick={resetEmailForm}
                              >
                                取消
                              </InkButton>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}

                    {banningUserId === account.userId ? (
                      <tr className="border-crimson/15 bg-crimson/3 border-b">
                        <td className="px-4 py-5" colSpan={8}>
                          <form
                            className="space-y-4"
                            onSubmit={(event) => void banAccount(event)}
                          >
                            <div>
                              <h3 className="font-heading text-crimson text-xl">
                                封禁账号
                              </h3>
                              <p className="text-ink-secondary mt-2 text-sm leading-7">
                                目标账号：{account.name}（{account.email}）。
                                封禁后玩家将无法登录，当前全部登录会话也会立即撤销。
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
                              <InkInput
                                label="封禁原因"
                                value={banReason}
                                multiline
                                rows={3}
                                disabled={moderatingUserId === account.userId}
                                placeholder="填写运营封禁原因（最多 500 字）"
                                hint={`${banReason.length}/500`}
                                onChange={(value) =>
                                  setBanReason(value.slice(0, 500))
                                }
                              />
                              <InkSelect
                                label="封禁期限"
                                value={banDuration}
                                disabled={moderatingUserId === account.userId}
                                onChange={(value) =>
                                  setBanDuration(
                                    value as AdminAccountBanDuration,
                                  )
                                }
                              >
                                <option value="1_day">1 天</option>
                                <option value="7_days">7 天</option>
                                <option value="30_days">30 天</option>
                                <option value="permanent">永久</option>
                              </InkSelect>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <InkButton
                                type="submit"
                                variant="primary"
                                disabled={
                                  moderatingUserId === account.userId ||
                                  !banReason.trim()
                                }
                              >
                                {moderatingUserId === account.userId
                                  ? '封禁中...'
                                  : '确认封禁并下线'}
                              </InkButton>
                              <InkButton
                                variant="secondary"
                                disabled={moderatingUserId === account.userId}
                                onClick={resetBanForm}
                              >
                                取消
                              </InkButton>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-ink-secondary flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            共 {total} 个账号，第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <InkButton
              variant="secondary"
              disabled={loading || page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              上一页
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={loading || page >= totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
            >
              下一页
            </InkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
