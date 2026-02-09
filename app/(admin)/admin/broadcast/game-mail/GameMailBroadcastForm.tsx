'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkNotice } from '@/components/ui/InkNotice';
import { useState } from 'react';

interface GameMailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  success?: boolean;
  mailType?: string;
  rewardSpiritStones?: number;
}

export function GameMailBroadcastForm() {
  const { pushToast } = useInkUI();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [rewardSpiritStones, setRewardSpiritStones] = useState('0');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GameMailBroadcastResult | null>(null);

  const submit = async (dryRun: boolean) => {
    if (!title.trim() || !content.trim()) {
      pushToast({ message: '请填写游戏邮件标题和内容', tone: 'warning' });
      return;
    }

    const reward = Number(rewardSpiritStones || '0');
    if (!Number.isFinite(reward) || reward < 0) {
      pushToast({ message: '灵石奖励必须是大于等于 0 的数字', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/broadcast/game-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          rewardSpiritStones: Math.floor(reward),
          dryRun,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '游戏邮件群发失败');
      }

      setResult(data);
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
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <InkNotice tone="info">
        发送对象为所有活跃角色。灵石奖励为 0 时发送公告，&gt;0 时发送奖励邮件。
      </InkNotice>

      <InkInput
        label="邮件标题"
        value={title}
        onChange={(value) => setTitle(value)}
        placeholder="例如：版本维护补偿"
        disabled={loading}
      />

      <InkInput
        label="邮件内容"
        value={content}
        onChange={(value) => setContent(value)}
        placeholder="请输入游戏内邮件正文"
        multiline
        rows={10}
        disabled={loading}
      />

      <InkInput
        label="灵石奖励（0=公告）"
        value={rewardSpiritStones}
        onChange={(value) => setRewardSpiritStones(value)}
        placeholder="0"
        disabled={loading}
      />

      <div className="flex flex-wrap gap-3">
        <InkButton
          variant="secondary"
          onClick={() => submit(true)}
          disabled={loading}
        >
          预览发送人数
        </InkButton>
        <InkButton variant="primary" onClick={() => submit(false)} disabled={loading}>
          {loading ? '执行中...' : '确认群发游戏邮件'}
        </InkButton>
      </div>

      {result && (
        <pre className="overflow-x-auto rounded-lg border border-ink/15 bg-paper/60 p-3 text-xs leading-5">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
