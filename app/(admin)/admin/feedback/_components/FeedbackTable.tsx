'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { useEffect, useState } from 'react';

type FeedbackType = 'bug' | 'feature' | 'balance' | 'other';
type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'closed';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  content: string;
  status: FeedbackStatus;
  userId: string;
  cultivatorId: string | null;
  userEmail: string | null;
  cultivatorName: string | null;
  cultivatorRealm: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  pending: 'text-red-600',
  processing: 'text-yellow-600',
  resolved: 'text-green-600',
  closed: 'text-gray-500',
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug 反馈',
  feature: '功能建议',
  balance: '游戏平衡',
  other: '其他意见',
};

export function FeedbackTable() {
  const { pushToast } = useInkUI();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [type, setType] = useState<FeedbackType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminMessages, setAdminMessages] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(limit));
      if (status !== 'all') query.set('status', status);
      if (type !== 'all') query.set('type', type);
      if (search.trim()) query.set('search', search.trim());

      const res = await fetch(`/api/admin/feedback?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '加载反馈失败');
      setItems(data.feedbacks ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载反馈失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, page]);

  const handleSearch = () => {
    setPage(1);
    fetchFeedbacks();
  };

  const updateStatus = async (id: string, newStatus: FeedbackStatus) => {
    try {
      setUpdatingId(id);
      const adminMessage = adminMessages[id]?.trim();
      const res = await fetch(`/api/admin/feedback/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          adminMessage: adminMessage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '更新状态失败');
      const message =
        data.statusChanged && !data.notifiedUser
          ? '状态已更新，但未找到用户角色，站内信未发送'
          : '状态已更新并通知用户';
      pushToast({ message, tone: 'success' });
      fetchFeedbacks();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '更新状态失败',
        tone: 'danger',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  const truncateContent = (content: string, maxLength = 50) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className="space-y-4">
      {/* 筛选条件 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border-ink/20 border bg-transparent px-3 py-2"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as FeedbackStatus | 'all');
            setPage(1);
          }}
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="resolved">已解决</option>
          <option value="closed">已关闭</option>
        </select>
        <select
          className="border-ink/20 border bg-transparent px-3 py-2"
          value={type}
          onChange={(e) => {
            setType(e.target.value as FeedbackType | 'all');
            setPage(1);
          }}
        >
          <option value="all">全部类型</option>
          <option value="bug">Bug 反馈</option>
          <option value="feature">功能建议</option>
          <option value="balance">游戏平衡</option>
          <option value="other">其他意见</option>
        </select>
        <input
          type="text"
          placeholder="搜索内容..."
          className="border-ink/20 min-w-[200px] border bg-transparent px-3 py-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          className="border-ink/20 hover:border-ink/40 border px-3 py-2"
          type="button"
        >
          搜索
        </button>
      </div>

      {/* 表格 */}
      <div className="border-ink/15 bg-paper/80 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-ink/10 text-ink-secondary border-b text-left">
            <tr>
              <th className="w-24 px-3 py-2">状态</th>
              <th className="w-24 px-3 py-2">类型</th>
              <th className="px-3 py-2">内容摘要</th>
              <th className="w-24 px-3 py-2">角色</th>
              <th className="w-28 px-3 py-2">提交时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="text-ink-secondary px-3 py-4" colSpan={5}>
                  加载中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="text-ink-secondary px-3 py-4" colSpan={5}>
                  暂无反馈
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <>
                  <tr
                    key={item.id}
                    className="border-ink/8 hover:bg-ink/5 cursor-pointer border-b"
                    onClick={() =>
                      setExpandedId(expandedId === item.id ? null : item.id)
                    }
                  >
                    <td
                      className={`px-3 py-2 font-medium ${STATUS_COLORS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </td>
                    <td className="px-3 py-2">{TYPE_LABELS[item.type]}</td>
                    <td className="max-w-[300px] truncate px-3 py-2">
                      {truncateContent(item.content)}
                    </td>
                    <td className="px-3 py-2">{item.cultivatorName || '-'}</td>
                    <td className="text-ink-secondary px-3 py-2">
                      {formatTime(item.createdAt)}
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr
                      key={`${item.id}-detail`}
                      className="border-ink/8 bg-ink/3 border-b"
                    >
                      <td className="px-3 py-4" colSpan={5}>
                        <div className="space-y-3">
                          <div>
                            <span className="font-semibold">完整内容：</span>
                            <p className="mt-1 whitespace-pre-wrap">
                              {item.content}
                            </p>
                          </div>
                          <div className="text-ink-secondary flex gap-6 text-sm">
                            <span>用户：{item.userEmail || item.userId}</span>
                            {item.cultivatorName && (
                              <span>
                                角色：{item.cultivatorName}
                                {item.cultivatorRealm &&
                                  ` (${item.cultivatorRealm})`}
                              </span>
                            )}
                          </div>
                          <div>
                            <label
                              htmlFor={`feedback-admin-message-${item.id}`}
                              className="text-ink-secondary text-sm"
                            >
                              管理员留言（会附在站内信中）
                            </label>
                            <textarea
                              id={`feedback-admin-message-${item.id}`}
                              className="border-ink/20 mt-1 min-h-[80px] w-full border bg-transparent px-3 py-2"
                              placeholder="可选：填写给用户的说明、处理结果或补偿原因"
                              value={adminMessages[item.id] ?? ''}
                              onChange={(e) =>
                                setAdminMessages((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              maxLength={1000}
                            />
                          </div>
                          <div className="flex gap-2">
                            <span className="text-ink-secondary text-sm">
                              状态：
                            </span>
                            {(
                              [
                                'pending',
                                'processing',
                                'resolved',
                                'closed',
                              ] as FeedbackStatus[]
                            ).map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={updatingId === item.id}
                                onClick={() => updateStatus(item.id, s)}
                                className={`border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                  item.status === s
                                    ? 'border-crimson text-crimson bg-crimson/5'
                                    : 'border-ink/20 text-ink-secondary hover:border-ink/40'
                                }`}
                              >
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="text-ink-secondary flex items-center justify-between text-sm">
          <span>
            共 {total} 条，第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-ink/20 border px-3 py-1 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-ink/20 border px-3 py-1 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
