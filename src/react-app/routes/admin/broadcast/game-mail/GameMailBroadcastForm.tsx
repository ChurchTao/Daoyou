import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { REALM_VALUES } from '@shared/types/constants';
import { useState } from 'react';
import { RewardSelectionEditor } from '../../_components/RewardSelectionEditor';
import {
  parseRewardSelectionDrafts,
  type RewardSelectionDraft,
} from '../../_components/RewardSelectionEditor.helpers';

interface GameMailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  success?: boolean;
  mailType?: string;
  rewardSummary?: string[];
  sampleRecipients?: Array<{
    recipientKey: string;
    metadata?: { cultivatorName?: string; realm?: string };
  }>;
}

export function GameMailBroadcastForm() {
  const { pushToast } = useInkUI();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [rewardSelections, setRewardSelections] = useState<
    RewardSelectionDraft[]
  >([]);
  const [targetCultivatorId, setTargetCultivatorId] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [realmMin, setRealmMin] = useState('');
  const [realmMax, setRealmMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GameMailBroadcastResult | null>(null);
  const submit = async (dryRun: boolean) => {
    if (!title.trim() || !content.trim()) {
      pushToast({ message: '请填写标题和内容', tone: 'warning' });
      return;
    }

    let parsedRewardSelections;
    try {
      parsedRewardSelections = parseRewardSelectionDrafts(rewardSelections, {
        allowEmpty: true,
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '奖励配置错误',
        tone: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/broadcast/game-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: content.trim() || undefined,
          rewardSelections: parsedRewardSelections,
          filters: {
            targetCultivatorId: targetCultivatorId.trim() || undefined,
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
        按角色或人群筛选发送。奖励支持灵石、声望与新版物品栏道具，留空时发送纯公告。
        填写目标角色 ID 时进入单发模式，并忽略下方群发筛选条件。
      </InkNotice>

      <InkInput
        label="邮件标题"
        value={title}
        onChange={(value) => setTitle(value)}
        placeholder="例如：版本维护补偿"
        disabled={loading}
      />

      <InkInput
        label="邮件内容"
        value={content}
        onChange={(value) => setContent(value)}
        placeholder="请输入游戏内邮件正文"
        multiline
        rows={8}
        disabled={loading}
      />

      <RewardSelectionEditor
        value={rewardSelections}
        onChange={setRewardSelections}
        disabled={loading}
        allowEmpty
      />

      <InkInput
        label="目标角色 ID（可选，填写后单独发送）"
        value={targetCultivatorId}
        onChange={(value) => setTargetCultivatorId(value)}
        placeholder="例如：6d9f6f44-..."
        hint="填写 cultivatorId 后只发送给该活跃角色。"
        disabled={loading}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <InkInput
          label="角色创建时间起"
          type="date"
          value={createdFrom}
          onChange={(value) => setCreatedFrom(value)}
          disabled={loading || Boolean(targetCultivatorId.trim())}
        />
        <InkInput
          label="角色创建时间止"
          type="date"
          value={createdTo}
          onChange={(value) => setCreatedTo(value)}
          disabled={loading || Boolean(targetCultivatorId.trim())}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InkSelect
          label="境界下限"
          value={realmMin}
          onChange={(value) => setRealmMin(value)}
          disabled={loading || Boolean(targetCultivatorId.trim())}
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
          disabled={loading || Boolean(targetCultivatorId.trim())}
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
          预览收件人与奖励
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
        <div
          className="border-ink/15 space-y-2 border-t pt-4 text-sm"
          role="status"
        >
          <p>
            {result.dryRun ? '预计发送' : '已发送'}{' '}
            <span className="font-mono">{result.totalRecipients ?? 0}</span>{' '}
            位角色
          </p>
          <p>
            {result.rewardSummary?.length
              ? `每人奖励：${result.rewardSummary.join('、')}`
              : '公告邮件，无附件'}
          </p>
          {result.dryRun && result.sampleRecipients?.length ? (
            <p className="text-ink-secondary">
              收件人示例：
              {result.sampleRecipients
                .map((r) => r.metadata?.cultivatorName ?? r.recipientKey)
                .join('、')}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
