import { toErrorMessage, validatePasswordConfirmation } from '@app/components/auth';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import type { AuthActionError } from '@app/lib/auth/authState';
import { authClient } from '@app/lib/auth/client';
import { toAuthActionError } from '@app/lib/auth/authState';
import type { AccountSetPasswordResponse } from '@shared/contracts/account';
import type { ApiFailure } from '@shared/contracts/http';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  SettingsField,
  SettingsMessage,
  SettingsSection,
  SettingsToggle,
  settingsLabelClass,
} from './SettingsFields';
import { formatDateTime } from './utils';

type LinkedAccount = {
  providerId: string;
  accountId: string;
};

type PasswordMode = 'set' | 'change';

function getPasswordMode(accounts: LinkedAccount[]): PasswordMode {
  return accounts.some((account) => account.providerId === 'credential')
    ? 'change'
    : 'set';
}

export function AccountSettingsTab() {
  const sessionState = authClient.useSession();
  const navigate = useNavigate();
  const { openDialog, pushToast } = useInkUI();
  const user = sessionState.data?.user ?? null;
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [githubBinding, setGithubBinding] = useState(false);
  const [githubMessage, setGithubMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      setAccountsLoading(true);
      setAccountsError(null);

      const { data, error } = await authClient.listAccounts();
      if (cancelled) return;

      if (error) {
        setAccountsError(
          toErrorMessage(toAuthActionError(error), '账号绑定状态读取失败'),
        );
        setAccounts([]);
      } else {
        setAccounts(
          (data ?? []).map((account) => ({
            providerId: account.providerId,
            accountId: account.accountId,
          })),
        );
      }

      setAccountsLoading(false);
    }

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, []);

  const passwordMode = useMemo(() => getPasswordMode(accounts), [accounts]);
  const hasGithub = accounts.some((account) => account.providerId === 'github');
  const passwordConfirmationError =
    newPassword || confirmPassword
      ? validatePasswordConfirmation(newPassword, confirmPassword)
      : undefined;
  const currentPasswordError =
    passwordMode === 'change' && !currentPassword.trim()
      ? '请输入当前密码'
      : undefined;
  const canSubmitPassword =
    !accountsLoading &&
    !accountsError &&
    !passwordSubmitting &&
    !!newPassword.trim() &&
    !passwordConfirmationError &&
    !currentPasswordError;

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handlePasswordSubmit = async () => {
    if (!canSubmitPassword) return;

    setPasswordSubmitting(true);
    setPasswordMessage(null);

    try {
      if (passwordMode === 'change') {
        const { error } = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions,
        });

        if (error) {
          throw toAuthActionError(error);
        }
      } else {
        const response = await fetch('/api/account/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword }),
        });
        const result = (await response.json()) as
          | AccountSetPasswordResponse
          | ApiFailure;

        if (!response.ok || !result.success) {
          throw {
            message:
              'success' in result && !result.success
                ? result.error
                : '设置密码失败',
            status: response.status,
          } satisfies AuthActionError;
        }

        setAccounts((current) => [
          ...current,
          { providerId: 'credential', accountId: 'credential' },
        ]);
      }

      resetPasswordForm();
      setPasswordMessage({
        type: 'success',
        text: passwordMode === 'change' ? '密码已更新。' : '密码已设置。',
      });
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: toErrorMessage(error as AuthActionError, '密码维护失败'),
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleBindGithub = async () => {
    if (hasGithub || githubBinding) return;

    setGithubBinding(true);
    setGithubMessage(null);

    const { error } = await authClient.linkSocial({
      provider: 'github',
      callbackURL: '/game/settings?tab=account',
      errorCallbackURL: '/game/settings?tab=account',
    });

    if (error) {
      setGithubMessage({
        type: 'error',
        text: toErrorMessage(toAuthActionError(error), 'GitHub 绑定失败'),
      });
      setGithubBinding(false);
    }
  };

  const handleSignOut = async () => {
    if (logoutSubmitting) return;

    let didNavigate = false;
    setLogoutSubmitting(true);
    setLogoutMessage(null);

    try {
      const { error } = await authClient.signOut();
      if (error) {
        throw toAuthActionError(error);
      }

      pushToast({ message: '已退出登录', tone: 'success' });
      didNavigate = true;
      navigate('/login', { replace: true });
    } catch (error) {
      const message = toErrorMessage(error as AuthActionError, '退出登录失败');
      setLogoutMessage(message);
      pushToast({ message, tone: 'danger' });
    } finally {
      if (!didNavigate) {
        setLogoutSubmitting(false);
      }
    }
  };

  const openLogoutConfirm = () => {
    if (logoutSubmitting) return;

    openDialog({
      title: '退出登录',
      content: '确定要退出当前账号吗？退出后需要重新登录才能继续游历。',
      confirmLabel: '确认退出',
      cancelLabel: '取消',
      loadingLabel: '退出中...',
      onConfirm: handleSignOut,
    });
  };

  return (
    <div className="space-y-6">
      <SettingsSection>
        <SettingsField label="用户 ID" value={user?.id ?? '—'} mono />
        <SettingsField label="昵称" value={user?.name || '—'} />
        <SettingsField label="邮箱" value={user?.email || '—'} mono />
        <SettingsField
          label="邮箱验证"
          value={user?.emailVerified ? '已验证' : '未验证'}
        />
        <SettingsField
          label="账号创建时间"
          value={formatDateTime(user?.createdAt)}
        />
      </SettingsSection>

      <SettingsSection
        title="密码维护"
        description={
          passwordMode === 'change'
            ? '使用当前密码更新登录密码。'
            : '当前账号尚未设置密码，可在此添加邮箱密码登录方式。'
        }
      >
        <div className="grid gap-4">
          {passwordMode === 'change' ? (
            <InkInput
              label="当前密码"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              error={currentPassword ? undefined : currentPasswordError}
              disabled={passwordSubmitting}
              size="sm"
              labelClassName={settingsLabelClass}
            />
          ) : null}
          <InkInput
            label={passwordMode === 'change' ? '新密码' : '登录密码'}
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            disabled={passwordSubmitting}
            size="sm"
            labelClassName={settingsLabelClass}
          />
          <InkInput
            label="确认密码"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={passwordConfirmationError}
            disabled={passwordSubmitting}
            size="sm"
            labelClassName={settingsLabelClass}
          />

          {passwordMode === 'change' ? (
            <SettingsToggle
              checked={revokeOtherSessions}
              onChange={setRevokeOtherSessions}
              disabled={passwordSubmitting}
              label="更新后退出其他设备"
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <InkButton
              variant="primary"
              onClick={handlePasswordSubmit}
              disabled={!canSubmitPassword}
            >
              {passwordSubmitting
                ? '处理中...'
                : passwordMode === 'change'
                  ? '修改密码'
                  : '设置密码'}
            </InkButton>
            {passwordMessage ? (
              <SettingsMessage type={passwordMessage.type}>
                {passwordMessage.text}
              </SettingsMessage>
            ) : null}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="GitHub 绑定"
        description={
          accountsLoading
            ? '正在读取绑定状态...'
            : hasGithub
              ? '当前账号已绑定 GitHub。'
              : '绑定后可使用 GitHub 登录当前账号。'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <InkButton
            variant={hasGithub ? 'secondary' : 'primary'}
            onClick={handleBindGithub}
            disabled={accountsLoading || hasGithub || githubBinding}
          >
            {hasGithub ? '已绑定' : githubBinding ? '跳转中...' : '绑定 GitHub'}
          </InkButton>
        </div>

        {accountsError ? (
          <SettingsMessage type="error" className="mt-3 block">
            {accountsError}
          </SettingsMessage>
        ) : null}
        {githubMessage ? (
          <SettingsMessage type={githubMessage.type} className="mt-3 block">
            {githubMessage.text}
          </SettingsMessage>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="登录会话"
        description="退出当前浏览器的登录状态，不会删除账号或角色数据。"
      >
        <div className="flex flex-wrap items-center gap-3">
          <InkButton
            variant="primary"
            onClick={openLogoutConfirm}
            disabled={logoutSubmitting}
          >
            {logoutSubmitting ? '退出中...' : '退出登录'}
          </InkButton>
          {logoutMessage ? (
            <SettingsMessage type="error">{logoutMessage}</SettingsMessage>
          ) : null}
        </div>
      </SettingsSection>
    </div>
  );
}
