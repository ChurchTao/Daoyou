'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkNotice } from '@/components/ui/InkNotice';
import { REALM_VALUES } from '@/types/constants';
import { useEffect, useState } from 'react';

interface EmailTemplateOption {
  id: string;
  name: string;
}

interface EmailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  errors?: string[];
  sampleRecipients?: Array<{ recipientKey: string }>;
}

export function EmailBroadcastForm() {
  const { pushToast } = useInkUI();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [payloadText, setPayloadText] = useState('{}');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [hasActiveCultivator, setHasActiveCultivator] = useState('');
  const [realmMin, setRealmMin] = useState('');
  const [realmMax, setRealmMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailBroadcastResult | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch(
          '/api/admin/templates?channel=email&status=active',
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '加载模板失败');
        setTemplates(
          (data.templates ?? []).map((item: { id: string; name: string }) => ({
            id: item.id,
            name: item.name,
          })),
        );
      } catch {
        // 模板加载失败不阻塞手动发送
      }
    };
    loadTemplates();
  }, []);

  const submit = async (dryRun: boolean) => {
    if (!templateId && (!subject.trim() || !content.trim())) {
      pushToast({ message: '请填写标题和内容，或选择模板', tone: 'warning' });
      return;
    }

    let payload = {};
    try {
      payload = JSON.parse(payloadText || '{}');
    } catch {
      pushToast({ message: '变量 JSON 格式错误', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/broadcast/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId || undefined,
          subject: subject.trim() || undefined,
          content: content.trim() || undefined,
          payload,
          filters: {
            registeredFrom: registeredFrom || undefined,
            registeredTo: registeredTo || undefined,
            hasActiveCultivator:
              hasActiveCultivator === ''
                ? undefined
                : hasActiveCultivator === 'true',
            realmMin: realmMin || undefined,
            realmMax: realmMax || undefined,
          },
          dryRun,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '邮件群发失败');
      }

      setResult(data);
      pushToast({
        message: dryRun ? '预览完成' : '邮件同步群发完成',
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
        可选模板 + 人群筛选。当前为同步执行，建议先 dry run 预估人数。
      </InkNotice>

      <label className="flex flex-col gap-1">
        <span className="font-semibold tracking-wide">模板（可选）</span>
        <select
          className="border-ink/20 border bg-transparent px-3 py-2"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={loading}
        >
          <option value="">不使用模板（手动填写）</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <InkInput
        label="主题（手动填写）"
        value={subject}
        onChange={(value) => setSubject(value)}
        placeholder="例如：万界道友版本更新公告"
        disabled={loading}
      />

      <InkInput
        label="内容（手动填写）"
        value={content}
        onChange={(value) => setContent(value)}
        placeholder="请输入邮件正文"
        multiline
        rows={8}
        disabled={loading}
      />

      <InkInput
        label="模板变量（JSON）"
        value={payloadText}
        onChange={(value) => setPayloadText(value)}
        multiline
        rows={4}
        disabled={loading}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">注册时间起</span>
          <input
            className="border-ink/20 border bg-transparent px-3 py-2"
            type="date"
            value={registeredFrom}
            onChange={(e) => setRegisteredFrom(e.target.value)}
            disabled={loading}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">注册时间止</span>
          <input
            className="border-ink/20 border bg-transparent px-3 py-2"
            type="date"
            value={registeredTo}
            onChange={(e) => setRegisteredTo(e.target.value)}
            disabled={loading}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">活跃角色</span>
          <select
            className="border-ink/20 border bg-transparent px-3 py-2"
            value={hasActiveCultivator}
            onChange={(e) => setHasActiveCultivator(e.target.value)}
            disabled={loading}
          >
            <option value="">不限</option>
            <option value="true">仅有活跃角色</option>
            <option value="false">仅无活跃角色</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">境界下限</span>
          <select
            className="border-ink/20 border bg-transparent px-3 py-2"
            value={realmMin}
            onChange={(e) => setRealmMin(e.target.value)}
            disabled={loading}
          >
            <option value="">不限</option>
            {REALM_VALUES.map((realm) => (
              <option key={realm} value={realm}>
                {realm}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">境界上限</span>
          <select
            className="border-ink/20 border bg-transparent px-3 py-2"
            value={realmMax}
            onChange={(e) => setRealmMax(e.target.value)}
            disabled={loading}
          >
            <option value="">不限</option>
            {REALM_VALUES.map((realm) => (
              <option key={realm} value={realm}>
                {realm}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <InkButton
          variant="secondary"
          onClick={() => submit(true)}
          disabled={loading}
        >
          预览发送人数
        </InkButton>
        <InkButton
          variant="primary"
          onClick={() => submit(false)}
          disabled={loading}
        >
          {loading ? '执行中...' : '确认同步群发邮件'}
        </InkButton>
      </div>

      {result && (
        <pre className="border-ink/15 bg-paper/60 overflow-x-auto rounded-lg border p-3 text-xs leading-5">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
