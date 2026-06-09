import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkSelect } from '@app/components/ui/InkSelect';
import { useEffect, useState } from 'react';

interface RedeemCodeItem {
  id: string;
  code: string;
  rewardSummary: string[];
  rewardSource?: 'snapshot' | 'expired_legacy' | 'broken_snapshot';
  status: 'active' | 'disabled';
  rewardPresetId?: string;
  rewardAttachments?: unknown[] | null;
  totalLimit: number | null;
  claimedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

const SNAPSHOT_REWARD_PRESET_IDS = new Set([
  '__item_library_snapshot__',
  '__reward_catalog_snapshot__',
]);

function getRewardSourceLabel(item: RedeemCodeItem) {
  const hasBrokenSummary = item.rewardSummary.some(
    (entry) => entry === '奖励快照异常' || entry === '奖励配置异常',
  );
  const hasExpiredLegacySummary = item.rewardSummary.includes(
    '旧版兑换码（已失效）',
  );

  if (item.rewardSource === 'broken_snapshot') {
    return '快照奖励异常';
  }

  if (item.rewardSource === 'snapshot') {
    return '快照奖励';
  }

  if (item.rewardAttachments !== null && item.rewardAttachments !== undefined) {
    return '快照奖励';
  }

  if (SNAPSHOT_REWARD_PRESET_IDS.has(item.rewardPresetId ?? '')) {
    if (!hasBrokenSummary && !hasExpiredLegacySummary && item.rewardSummary.length > 0) {
      return '快照奖励';
    }
    return '快照奖励异常';
  }

  if (hasBrokenSummary) {
    return '快照奖励异常';
  }

  if (!hasExpiredLegacySummary && item.rewardSummary.length > 0) {
    return '快照奖励';
  }

  return '旧版兑换码（已失效）';
}

export function RedeemCodesTable() {
  const { pushToast } = useInkUI();
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [loading, setLoading] = useState(true);
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
    let cancelled = false;

    const loadCodes = async () => {
      try {
        const query = new URLSearchParams();
        if (status !== 'all') query.set('status', status);
        const res = await fetch(`/api/admin/redeem-codes?${query.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '加载兑换码失败');
        if (!cancelled) {
          setItems(data.redeemCodes ?? []);
        }
      } catch (error) {
        if (cancelled) return;
        pushToast({
          message: error instanceof Error ? error.message : '加载兑换码失败',
          tone: 'danger',
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadCodes();

    return () => {
      cancelled = true;
    };
  }, [pushToast, status]);

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
        <InkSelect
          size="sm"
          value={status}
          onChange={(value) =>
            setStatus(value as 'all' | 'active' | 'disabled')
          }
        >
          <option value="all">全部状态</option>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </InkSelect>
        <InkButton href="/admin/redeem-codes/new" variant="primary">
          新建兑换码
        </InkButton>
      </div>

      <div className="border-ink/15 bg-bgpaper/80 overflow-x-auto border border-dashed">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-ink/10 text-ink-secondary border-b text-left">
            <tr>
              <th className="px-3 py-2">兑换码</th>
              <th className="px-3 py-2">奖励</th>
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
                    <div className="font-semibold">
                      {item.rewardSummary.join('、')}
                    </div>
                    <div className="text-ink-secondary text-xs">
                      {getRewardSourceLabel(item)}
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
                    <InkButton
                      onClick={() => toggleStatus(item.id)}
                      variant="secondary"
                    >
                      {item.status === 'active' ? '停用' : '启用'}
                    </InkButton>
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
