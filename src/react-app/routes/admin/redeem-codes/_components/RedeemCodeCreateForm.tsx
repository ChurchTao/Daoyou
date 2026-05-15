import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import { useNavigate } from 'react-router';
import { useMemo, useState } from 'react';

interface PresetOption {
  id: string;
  name: string;
  description: string;
}

interface RedeemCodeCreateFormProps {
  presetOptions: PresetOption[];
}

export function RedeemCodeCreateForm({
  presetOptions,
}: RedeemCodeCreateFormProps) {
  const { pushToast } = useInkUI();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [rewardPresetId, setRewardPresetId] = useState(presetOptions[0]?.id ?? '');
  const [mailTitle, setMailTitle] = useState('');
  const [mailContent, setMailContent] = useState('');
  const [totalLimit, setTotalLimit] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState('');

  const selectedPreset = useMemo(
    () => presetOptions.find((item) => item.id === rewardPresetId) ?? null,
    [presetOptions, rewardPresetId],
  );

  const submit = async () => {
    if (!rewardPresetId) {
      pushToast({ message: '请选择奖励预设', tone: 'warning' });
      return;
    }
    if (!mailTitle.trim() || !mailContent.trim()) {
      pushToast({ message: '请填写邮件标题与正文', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        code: code.trim() || undefined,
        rewardPresetId,
        mailTitle: mailTitle.trim(),
        mailContent: mailContent.trim(),
        totalLimit: totalLimit.trim() ? Number(totalLimit.trim()) : null,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
      };

      const response = await fetch('/api/admin/redeem-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '创建兑换码失败');
      }

      const finalCode = data.redeemCode?.code || '';
      setCreatedCode(finalCode);
      pushToast({
        message: finalCode
          ? `创建成功：${finalCode}`
          : '兑换码创建成功',
        tone: 'success',
      });
      navigate('/admin/redeem-codes');
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '创建兑换码失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <InkInput
        label="兑换码（可选，留空自动生成）"
        value={code}
        onChange={(value) => setCode(value.toUpperCase())}
        placeholder="例如：SPRING2026"
        disabled={loading}
      />

      <InkSelect
        label="奖励预设"
        value={rewardPresetId}
        onChange={(value) => setRewardPresetId(value)}
        disabled={loading}
      >
          {presetOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
      </InkSelect>

      {selectedPreset && (
        <p className="text-ink-secondary border-ink/10 border border-dashed px-3 py-2 text-sm">
          奖励预览：{selectedPreset.description}
        </p>
      )}

      <InkInput
        label="邮件标题"
        value={mailTitle}
        onChange={setMailTitle}
        placeholder="例如：活动兑换奖励"
        disabled={loading}
      />

      <InkInput
        label="邮件正文"
        value={mailContent}
        onChange={setMailContent}
        placeholder="请输入奖励邮件正文"
        multiline
        rows={6}
        disabled={loading}
      />

      <InkInput
        label="总次数（可选，留空=不限）"
        value={totalLimit}
        onChange={setTotalLimit}
        placeholder="例如：100"
        disabled={loading}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <InkInput
          label="生效时间（可选）"
          type="datetime-local"
          value={startsAt}
          onChange={(value) => setStartsAt(value)}
          disabled={loading}
        />
        <InkInput
          label="结束时间（可选）"
          type="datetime-local"
          value={endsAt}
          onChange={(value) => setEndsAt(value)}
          disabled={loading}
        />
      </div>

      {createdCode && (
        <p className="text-ink-secondary text-sm">
          最新创建兑换码：<span className="font-mono">{createdCode}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <InkButton variant="primary" onClick={submit} disabled={loading}>
          {loading ? '创建中...' : '创建兑换码'}
        </InkButton>
        <InkButton href="/admin/redeem-codes" variant="secondary">
          返回列表
        </InkButton>
      </div>
    </div>
  );
}
