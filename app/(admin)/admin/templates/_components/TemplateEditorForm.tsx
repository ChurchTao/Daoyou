'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { TemplateStatus } from '@/types/admin-broadcast';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type TemplateChannel = 'email' | 'game_mail';

interface TemplateEditorFormProps {
  mode: 'create' | 'edit';
  templateId?: string;
  initialValue?: {
    channel: TemplateChannel;
    name: string;
    subjectTemplate: string;
    contentTemplate: string;
    defaultPayload: Record<string, string | number>;
    status: TemplateStatus;
  };
}

export function TemplateEditorForm({
  mode,
  templateId,
  initialValue,
}: TemplateEditorFormProps) {
  const { pushToast } = useInkUI();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [channel, setChannel] = useState<TemplateChannel>(
    initialValue?.channel ?? 'email',
  );
  const [name, setName] = useState(initialValue?.name ?? '');
  const [subjectTemplate, setSubjectTemplate] = useState(
    initialValue?.subjectTemplate ?? '',
  );
  const [contentTemplate, setContentTemplate] = useState(
    initialValue?.contentTemplate ?? '',
  );
  const [defaultPayloadText, setDefaultPayloadText] = useState(
    JSON.stringify(initialValue?.defaultPayload ?? {}, null, 2),
  );
  const [status, setStatus] = useState<TemplateStatus>(
    initialValue?.status ?? 'active',
  );

  const isEmail = useMemo(() => channel === 'email', [channel]);

  const submit = async () => {
    if (!name.trim() || !contentTemplate.trim()) {
      pushToast({ message: '请填写模板名称和正文模板', tone: 'warning' });
      return;
    }
    if (isEmail && !subjectTemplate.trim()) {
      pushToast({ message: 'email 模板必须填写主题模板', tone: 'warning' });
      return;
    }

    let defaultPayload: Record<string, string | number> = {};
    try {
      const parsed = JSON.parse(defaultPayloadText || '{}') as Record<
        string,
        unknown
      >;
      defaultPayload = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string' || typeof v === 'number') {
          defaultPayload[k] = v;
        }
      });
    } catch {
      pushToast({
        message: '默认变量 JSON 格式错误',
        tone: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      const url =
        mode === 'create' ? '/api/admin/templates' : `/api/admin/templates/${templateId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          name: name.trim(),
          subjectTemplate: subjectTemplate.trim() || undefined,
          contentTemplate: contentTemplate.trim(),
          defaultPayload,
          status,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '保存模板失败');
      }

      pushToast({
        message: mode === 'create' ? '模板创建成功' : '模板更新成功',
        tone: 'success',
      });
      router.push('/admin/templates');
      router.refresh();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存模板失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className="font-semibold tracking-wide">模板频道</span>
        <select
          className="border border-ink/20 bg-transparent px-3 py-2"
          value={channel}
          onChange={(e) => setChannel(e.target.value as TemplateChannel)}
          disabled={loading || mode === 'edit'}
        >
          <option value="email">email</option>
          <option value="game_mail">game_mail</option>
        </select>
      </label>

      <InkInput
        label="模板名称"
        value={name}
        onChange={(value) => setName(value)}
        placeholder="例如：新版本公告"
        disabled={loading}
      />

      <InkInput
        label={isEmail ? '主题模板（支持 {{var}}）' : '标题模板（可选）'}
        value={subjectTemplate}
        onChange={(value) => setSubjectTemplate(value)}
        placeholder={isEmail ? '例如：{{version}} 版本更新通知' : '例如：{{eventName}}'}
        disabled={loading}
      />

      <InkInput
        label="正文模板（支持 {{var}}）"
        value={contentTemplate}
        onChange={(value) => setContentTemplate(value)}
        placeholder="例如：道友您好，{{eventName}} 已开启..."
        multiline
        rows={10}
        disabled={loading}
      />

      <InkInput
        label="默认变量（JSON）"
        value={defaultPayloadText}
        onChange={(value) => setDefaultPayloadText(value)}
        multiline
        rows={6}
        disabled={loading}
      />

      <label className="flex flex-col gap-1">
        <span className="font-semibold tracking-wide">状态</span>
        <select
          className="border border-ink/20 bg-transparent px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as TemplateStatus)}
          disabled={loading}
        >
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
      </label>

      <div className="flex gap-3">
        <InkButton variant="primary" onClick={submit} disabled={loading}>
          {loading ? '保存中...' : mode === 'create' ? '创建模板' : '保存修改'}
        </InkButton>
        <InkButton href="/admin/templates" variant="secondary">
          返回列表
        </InkButton>
      </div>
    </div>
  );
}
