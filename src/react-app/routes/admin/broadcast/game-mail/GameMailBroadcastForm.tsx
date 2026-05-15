import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { REALM_VALUES } from '@shared/types/constants';
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
      pushToast({
        message: '灵石奖励必须是大于等于 0 的数字',
        tone: 'warning',
      });
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

      <InkSelect
        label="模板（可选）"
        value={templateId}
        onChange={(value) => setTemplateId(value)}
        disabled={loading}
      >
          <option value="">不使用模板（手动填写）</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </InkSelect>

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
        <InkInput
          label="角色创建时间起"
          type="date"
          value={createdFrom}
          onChange={(value) => setCreatedFrom(value)}
          disabled={loading}
        />
        <InkInput
          label="角色创建时间止"
          type="date"
          value={createdTo}
          onChange={(value) => setCreatedTo(value)}
          disabled={loading}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InkSelect
          label="境界下限"
          value={realmMin}
          onChange={(value) => setRealmMin(value)}
          disabled={loading}
        >
            <option value="">不限</option>
            {REALM_VALUES.map((realm) => (
              <option key={realm} value={realm}>
                {realm}
              </option>
            ))}
        </InkSelect>
        <InkSelect
          label="境界上限"
          value={realmMax}
          onChange={(value) => setRealmMax(value)}
          disabled={loading}
        >
            <option value="">不限</option>
            {REALM_VALUES.map((realm) => (
              <option key={realm} value={realm}>
                {realm}
              </option>
            ))}
        </InkSelect>
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
          {loading ? '执行中...' : '确认同步群发游戏邮件'}
        </InkButton>
      </div>

      {result && (
        <pre className="border-ink/15 bg-bgpaper/60 overflow-x-auto border border-dashed p-3 text-xs leading-5">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
