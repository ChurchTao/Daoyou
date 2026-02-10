'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { TemplateStatus } from '@/types/admin-broadcast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TemplateItem {
  id: string;
  channel: 'email' | 'game_mail';
  name: string;
  status: TemplateStatus;
  subjectTemplate: string | null;
  updatedAt: string;
}

export function TemplatesTable() {
  const { pushToast } = useInkUI();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<'all' | 'email' | 'game_mail'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [items, setItems] = useState<TemplateItem[]>([]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (channel !== 'all') query.set('channel', channel);
      if (status !== 'all') query.set('status', status);
      const res = await fetch(`/api/admin/templates?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '加载模板失败');
      setItems(data.templates ?? []);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载模板失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, status]);

  const toggleStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/templates/${id}/toggle`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '切换状态失败');
      pushToast({ message: '模板状态已更新', tone: 'success' });
      fetchTemplates();
      router.refresh();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '切换状态失败',
        tone: 'danger',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border-ink/20 border bg-transparent px-3 py-2"
          value={channel}
          onChange={(e) =>
            setChannel(e.target.value as 'all' | 'email' | 'game_mail')
          }
        >
          <option value="all">全部频道</option>
          <option value="email">email</option>
          <option value="game_mail">game_mail</option>
        </select>
        <select
          className="border-ink/20 border bg-transparent px-3 py-2"
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as 'all' | 'active' | 'disabled')
          }
        >
          <option value="all">全部状态</option>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
        <InkButton href="/admin/templates/new" variant="primary">
          新建模板
        </InkButton>
      </div>

      <div className="border-ink/15 bg-paper/80 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-ink/10 text-ink-secondary border-b text-left">
            <tr>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">频道</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">主题模板</th>
              <th className="px-3 py-2">更新时间</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="text-ink-secondary px-3 py-4" colSpan={6}>
                  加载中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="text-ink-secondary px-3 py-4" colSpan={6}>
                  暂无模板
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-ink/8 border-b">
                  <td className="text-ink px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.channel}</td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="max-w-[260px] truncate px-3 py-2">
                    {item.subjectTemplate ?? '-'}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(item.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/templates/${item.id}`}
                        className="text-ink hover:text-crimson no-underline"
                      >
                        [编辑]
                      </Link>
                      <button
                        onClick={() => toggleStatus(item.id)}
                        className="text-ink-secondary hover:text-crimson cursor-pointer"
                        type="button"
                      >
                        [{item.status === 'active' ? '停用' : '启用'}]
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
