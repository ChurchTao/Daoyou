'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkNotice } from '@/components/ui/InkNotice';
import { useState } from 'react';

interface AdminDashboardProps {
  adminEmail: string;
}

interface ApiResult {
  dryRun?: boolean;
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  errors?: string[];
  mailType?: string;
  rewardSpiritStones?: number;
}

export function AdminDashboard({ adminEmail }: AdminDashboardProps) {
  const { pushToast } = useInkUI();

  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<ApiResult | null>(null);

  const [gameMailTitle, setGameMailTitle] = useState('');
  const [gameMailContent, setGameMailContent] = useState('');
  const [spiritStoneReward, setSpiritStoneReward] = useState('0');
  const [gameMailLoading, setGameMailLoading] = useState(false);
  const [gameMailResult, setGameMailResult] = useState<ApiResult | null>(null);

  const sendEmailBroadcast = async (dryRun: boolean) => {
    if (!emailSubject.trim() || !emailContent.trim()) {
      pushToast({ message: '请填写邮件标题和内容', tone: 'warning' });
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject.trim(),
          content: emailContent.trim(),
          dryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? '邮件群发失败');
      }

      setEmailResult(data);
      pushToast({
        message: dryRun ? '预览完成' : '邮件群发任务已执行',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '邮件群发失败',
        tone: 'danger',
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const sendGameMailBroadcast = async (dryRun: boolean) => {
    if (!gameMailTitle.trim() || !gameMailContent.trim()) {
      pushToast({ message: '请填写游戏邮件标题和内容', tone: 'warning' });
      return;
    }

    const reward = Number(spiritStoneReward || '0');
    if (!Number.isFinite(reward) || reward < 0) {
      pushToast({ message: '灵石奖励必须是大于等于 0 的数字', tone: 'warning' });
      return;
    }

    setGameMailLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast/game-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: gameMailTitle.trim(),
          content: gameMailContent.trim(),
          rewardSpiritStones: Math.floor(reward),
          dryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? '游戏邮件群发失败');
      }

      setGameMailResult(data);
      pushToast({
        message: dryRun ? '预览完成' : '游戏邮件已群发',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '游戏邮件群发失败',
        tone: 'danger',
      });
    } finally {
      setGameMailLoading(false);
    }
  };

  return (
    <InkPageShell
      title="运营后台"
      subtitle="邮件群发与游戏内公告发放"
      lead={`当前管理员：${adminEmail}`}
      backHref="/game"
      showBottomNav={false}
    >
      <div className="space-y-8">
        <InkSection title="【功能一：邮箱群发】">
          <div className="space-y-4">
            <InkNotice tone="info">
              发送对象为 Supabase 中“已验证邮箱”的全部用户。正式发送前建议先预览人数。
            </InkNotice>

            <InkInput
              label="邮件标题"
              value={emailSubject}
              onChange={(value) => setEmailSubject(value)}
              placeholder="例如：万界道友更新公告"
              disabled={emailLoading}
            />

            <InkInput
              label="邮件内容"
              value={emailContent}
              onChange={(value) => setEmailContent(value)}
              placeholder="请输入邮件正文"
              multiline
              rows={8}
              disabled={emailLoading}
            />

            <div className="flex flex-wrap gap-3">
              <InkButton
                variant="secondary"
                onClick={() => sendEmailBroadcast(true)}
                disabled={emailLoading}
              >
                预览发送人数
              </InkButton>
              <InkButton
                variant="primary"
                onClick={() => sendEmailBroadcast(false)}
                disabled={emailLoading}
              >
                {emailLoading ? '执行中...' : '确认群发邮件'}
              </InkButton>
            </div>

            {emailResult && (
              <pre className="overflow-x-auto border border-ink/15 p-3 text-xs leading-5">
                {JSON.stringify(emailResult, null, 2)}
              </pre>
            )}
          </div>
        </InkSection>

        <InkSection title="【功能二：游戏内邮件群发】">
          <div className="space-y-4">
            <InkNotice tone="info">
              发送对象为所有活跃角色。灵石奖励填 0 表示公告邮件，填大于 0 表示奖励邮件。
            </InkNotice>

            <InkInput
              label="邮件标题"
              value={gameMailTitle}
              onChange={(value) => setGameMailTitle(value)}
              placeholder="例如：春节活动补偿"
              disabled={gameMailLoading}
            />

            <InkInput
              label="邮件内容"
              value={gameMailContent}
              onChange={(value) => setGameMailContent(value)}
              placeholder="请输入游戏内邮件正文"
              multiline
              rows={8}
              disabled={gameMailLoading}
            />

            <InkInput
              label="灵石奖励（0=公告）"
              value={spiritStoneReward}
              onChange={(value) => setSpiritStoneReward(value)}
              placeholder="0"
              disabled={gameMailLoading}
            />

            <div className="flex flex-wrap gap-3">
              <InkButton
                variant="secondary"
                onClick={() => sendGameMailBroadcast(true)}
                disabled={gameMailLoading}
              >
                预览发送人数
              </InkButton>
              <InkButton
                variant="primary"
                onClick={() => sendGameMailBroadcast(false)}
                disabled={gameMailLoading}
              >
                {gameMailLoading ? '执行中...' : '确认群发游戏邮件'}
              </InkButton>
            </div>

            {gameMailResult && (
              <pre className="overflow-x-auto border border-ink/15 p-3 text-xs leading-5">
                {JSON.stringify(gameMailResult, null, 2)}
              </pre>
            )}
          </div>
        </InkSection>
      </div>
    </InkPageShell>
  );
}
