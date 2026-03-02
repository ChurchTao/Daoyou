'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { useEffect, useState } from 'react';

interface RedeemCodeItem {
  id: string;
  code: string;
  rewardPresetId: string;
  rewardPresetName: string;
  status: 'active' | 'disabled';
  totalLimit: number | null;
  claimedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export function RedeemCodesTable() {
  const { pushToast } = useInkUI();
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RedeemCodeItem[]>([]);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (status !== 'all') query.set('status', status);
      const res = await fetch(`/api/admin/redeem-codes?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '加载兑换码失败');
      setItems(data.redeemCodes ?? []);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载兑换码失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const toggleStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/redeem-codes/${id}/toggle`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '切换状态失败');
      pushToast({ message: '兑换码状态已更新', tone: 'success' });
      fetchCodes();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '切换状态失败',
        tone: 'danger',
      });
    }
  };

  const formatTime = (value: string | null) =>
    value ? new Date(value).toLocaleString() : '-';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border-ink/20 border bg-transparent px-3 py-2"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as 'all' | 'active' | 'disabled')
          }
        >
          <option value="all">全部状态</option>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
        <InkButton href="/admin/redeem-codes/new" variant="primary">
          新建兑换码
        </InkButton>
      </div>

      <div className="border-ink/15 bg-paper/80 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-ink/10 text-ink-secondary border-b text-left">
            <tr>
              <th className="px-3 py-2">兑换码</th>
              <th className="px-3 py-2">奖励包</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">名额</th>
              <th className="px-3 py-2">生效时间</th>
              <th className="px-3 py-2">过期时间</th>
              <th className="px-3 py-2">创建时间</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="text-ink-secondary px-3 py-4" colSpan={8}>
                  加载中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="text-ink-secondary px-3 py-4" colSpan={8}>
                  暂无兑换码
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-ink/8 border-b">
                  <td className="px-3 py-2 font-mono tracking-wide">{item.code}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{item.rewardPresetName}</div>
                    <div className="text-ink-secondary text-xs">
                      {item.rewardPresetId}
                    </div>
                  </td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2">
                    {item.claimedCount}/{item.totalLimit ?? '∞'}
                  </td>
                  <td className="px-3 py-2">{formatTime(item.startsAt)}</td>
                  <td className="px-3 py-2">{formatTime(item.endsAt)}</td>
                  <td className="px-3 py-2">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleStatus(item.id)}
                      className="text-ink-secondary hover:text-crimson cursor-pointer"
                    >
                      [{item.status === 'active' ? '停用' : '启用'}]
                    </button>
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
