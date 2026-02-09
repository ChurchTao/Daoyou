'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkNotice } from '@/components/ui/InkNotice';
import { REALM_VALUES } from '@/types/constants';
import { useEffect, useState } from 'react';

interface GameMailTemplateOption {
  id: string;
  name: string;
}

interface GameMailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  success?: boolean;
  mailType?: string;
  rewardSpiritStones?: number;
  sampleRecipients?: Array<{ recipientKey: string }>;
}

export function GameMailBroadcastForm() {
  const { pushToast } = useInkUI();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [payloadText, setPayloadText] = useState('{}');
  const [rewardSpiritStones, setRewardSpiritStones] = useState('0');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [realmMin, setRealmMin] = useState('');
  const [realmMax, setRealmMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GameMailBroadcastResult | null>(null);
  const [templates, setTemplates] = useState<GameMailTemplateOption[]>([]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch(
          '/api/admin/templates?channel=game_mail&status=active',
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
    if (!templateId && (!title.trim() || !content.trim())) {
      pushToast({ message: '请填写标题和内容，或选择模板', tone: 'warning' });
      return;
    }

    const reward = Number(rewardSpiritStones || '0');
    if (!Number.isFinite(reward) || reward < 0) {
      pushToast({ message: '灵石奖励必须是大于等于 0 的数字', tone: 'warning' });
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
      const response = await fetch('/api/admin/broadcast/game-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId || undefined,
          title: title.trim() || undefined,
          content: content.trim() || undefined,
          rewardSpiritStones: Math.floor(reward),
          payload,
          filters: {
            cultivatorCreatedFrom: createdFrom || undefined,
            cultivatorCreatedTo: createdTo || undefined,
            realmMin: realmMin || undefined,
            realmMax: realmMax || undefined,
          },
          dryRun,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '游戏邮件群发失败');
      }

      setResult(data);
      pushToast({
        message: dryRun ? '预览完成' : '游戏邮件同步群发完成',
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
        可选模板 + 人群筛选。当前为同步执行，灵石为 0 时发公告，&gt;0 时发奖励。
      </InkNotice>

      <label className="flex flex-col gap-1">
        <span className="font-semibold tracking-wide">模板（可选）</span>
        <select
          className="border border-ink/20 bg-transparent px-3 py-2"
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
        label="邮件标题（手动填写）"
        value={title}
        onChange={(value) => setTitle(value)}
        placeholder="例如：版本维护补偿"
        disabled={loading}
      />

      <InkInput
        label="邮件内容（手动填写）"
        value={content}
        onChange={(value) => setContent(value)}
        placeholder="请输入游戏内邮件正文"
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

      <InkInput
        label="灵石奖励（0=公告）"
        value={rewardSpiritStones}
        onChange={(value) => setRewardSpiritStones(value)}
        placeholder="0"
        disabled={loading}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">角色创建时间起</span>
          <input
            className="border border-ink/20 bg-transparent px-3 py-2"
            type="date"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
            disabled={loading}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">角色创建时间止</span>
          <input
            className="border border-ink/20 bg-transparent px-3 py-2"
            type="date"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
            disabled={loading}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">境界下限</span>
          <select
            className="border border-ink/20 bg-transparent px-3 py-2"
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
            className="border border-ink/20 bg-transparent px-3 py-2"
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
        <InkButton variant="primary" onClick={() => submit(false)} disabled={loading}>
          {loading ? '执行中...' : '确认同步群发游戏邮件'}
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
