'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { useEffect, useState } from 'react';
import { TemplateEditorForm } from '../_components/TemplateEditorForm';

interface EditTemplateClientProps {
  id: string;
}

interface TemplateDetail {
  channel: 'email' | 'game_mail';
  name: string;
  subjectTemplate: string | null;
  contentTemplate: string;
  defaultPayload: Record<string, string | number>;
  status: 'active' | 'disabled';
}

export function EditTemplateClient({ id }: EditTemplateClientProps) {
  const { pushToast } = useInkUI();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/templates/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '加载模板失败');
        setTemplate(data.template);
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '加载模板失败',
          tone: 'danger',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, pushToast]);

  if (loading) {
    return <div className="text-ink-secondary text-sm">加载模板中...</div>;
  }

  if (!template) {
    return <div className="text-crimson text-sm">模板不存在或无权限访问</div>;
  }

  return (
    <TemplateEditorForm
      mode="edit"
      templateId={id}
      initialValue={{
        channel: template.channel,
        name: template.name,
        subjectTemplate: template.subjectTemplate ?? '',
        contentTemplate: template.contentTemplate,
        defaultPayload: template.defaultPayload ?? {},
        status: template.status,
      }}
    />
  );
}
