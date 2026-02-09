'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkNotice } from '@/components/ui/InkNotice';
import { useState } from 'react';

interface EmailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  errors?: string[];
}

export function EmailBroadcastForm() {
  const { pushToast } = useInkUI();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailBroadcastResult | null>(null);

  const submit = async (dryRun: boolean) => {
    if (!subject.trim() || !content.trim()) {
      pushToast({ message: '请填写邮件标题和内容', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/broadcast/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          content: content.trim(),
          dryRun,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '邮件群发失败');
      }

      setResult(data);
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
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <InkNotice tone="info">
        发送对象为 Supabase 中已验证邮箱用户。建议先执行“预览发送人数”。
      </InkNotice>

      <InkInput
        label="邮件标题"
        value={subject}
        onChange={(value) => setSubject(value)}
        placeholder="例如：万界道友版本更新公告"
        disabled={loading}
      />

      <InkInput
        label="邮件内容"
        value={content}
        onChange={(value) => setContent(value)}
        placeholder="请输入邮件正文"
        multiline
        rows={10}
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
          {loading ? '执行中...' : '确认群发邮件'}
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
