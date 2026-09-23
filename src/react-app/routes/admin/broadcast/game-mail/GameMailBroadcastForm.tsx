import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkSelect } from '@app/components/ui';
import { REALM_VALUES } from '@shared/types/constants';
import { useState } from 'react';
import { AdminSteps } from '../../_components/AdminPage';
import {
  RewardSelectionEditor,
  RewardSelectionPreview,
} from '../../_components/RewardSelectionEditor';
import {
  parseRewardSelectionDrafts,
  type RewardSelectionDraft,
} from '../../_components/RewardSelectionEditor.helpers';

interface GameMailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  rewardSummary?: string[];
  sampleRecipients?: Array<{
    recipientKey: string;
    metadata?: { cultivatorName?: string };
  }>;
}

export function GameMailBroadcastForm() {
  const { pushToast } = useInkUI();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('single');
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
  const [error, setError] = useState('');

  const next = () => {
    if (
      mode === 'single' &&
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
        targetCultivatorId.trim(),
      )
    ) {
      setError('请填写有效的目标角色 ID');
      return;
    }
    if (
      mode === 'filtered' &&
      !createdFrom &&
      !createdTo &&
      !realmMin &&
      !realmMax
    ) {
      setError('请至少设置一项筛选条件，或选择全部活跃角色');
      return;
    }
    if (
      mode === 'filtered' &&
      ((createdFrom && createdTo && createdFrom > createdTo) ||
        (realmMin &&
          realmMax &&
          REALM_VALUES.indexOf(realmMin as (typeof REALM_VALUES)[number]) >
            REALM_VALUES.indexOf(realmMax as (typeof REALM_VALUES)[number])))
    ) {
      setError('筛选起始值不能晚于或高于结束值');
      return;
    }
    setError('');
    setStep(1);
  };
  const submit = async (dryRun: boolean) => {
    if (loading) return;
    setError('');
    if (!title.trim() || !content.trim()) {
      setError('请填写标题和正文');
      return;
    }
    setLoading(true);
    try {
      const rewards = parseRewardSelectionDrafts(rewardSelections, {
        allowEmpty: true,
      });
      const filters =
        mode === 'single'
          ? { targetCultivatorId: targetCultivatorId.trim() }
          : mode === 'all'
            ? {}
            : {
                cultivatorCreatedFrom: createdFrom || undefined,
                cultivatorCreatedTo: createdTo || undefined,
                realmMin: realmMin || undefined,
                realmMax: realmMax || undefined,
              };
      const response = await fetch('/api/admin/broadcast/game-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          rewardSelections: rewards,
          filters,
          dryRun,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '操作失败');
      setResult(data);
      setStep(dryRun ? 2 : 3);
      if (!dryRun) pushToast({ message: '游戏邮件发送完成', tone: 'success' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };
  if (step === 3)
    return (
      <div className="space-y-6 py-8" role="status">
        <h3 className="text-xl font-semibold">邮件已发送</h3>
        <p>
          《{title}》已发送给{' '}
          <span className="font-mono">{result?.totalRecipients ?? 0}</span>{' '}
          位角色。
        </p>
        <RewardSelectionPreview value={rewardSelections} />
        <InkButton
          variant="primary"
          onClick={() => {
            setTitle('');
            setContent('');
            setRewardSelections([]);
            setResult(null);
            setStep(0);
          }}
        >
          新建邮件
        </InkButton>
      </div>
    );
  return (
    <div className="max-w-3xl space-y-6">
      <AdminSteps
        labels={['收件人', '内容与奖励', '确认发送']}
        current={step}
      />
      <fieldset disabled={loading} className="min-w-0 space-y-5">
        {step === 0 && (
          <>
            <InkSelect
              label="发送范围"
              value={mode}
              onChange={(v) => {
                setMode(v);
                setError('');
              }}
            >
              <option value="single">指定角色</option>
              <option value="filtered">按条件筛选</option>
              <option value="all">全部活跃角色</option>
            </InkSelect>
            {mode === 'single' && (
              <InkInput
                label="目标角色 ID"
                value={targetCultivatorId}
                onChange={setTargetCultivatorId}
                placeholder="填写角色的 cultivatorId"
              />
            )}
            {mode === 'filtered' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <InkInput
                  label="角色创建时间起"
                  type="date"
                  value={createdFrom}
                  onChange={setCreatedFrom}
                />
                <InkInput
                  label="角色创建时间止"
                  type="date"
                  value={createdTo}
                  onChange={setCreatedTo}
                />
                <InkSelect
                  label="境界下限"
                  value={realmMin}
                  onChange={setRealmMin}
                >
                  <option value="">不限</option>
                  {REALM_VALUES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </InkSelect>
                <InkSelect
                  label="境界上限"
                  value={realmMax}
                  onChange={setRealmMax}
                >
                  <option value="">不限</option>
                  {REALM_VALUES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </InkSelect>
              </div>
            )}
            {mode === 'all' && (
              <p className="text-ink-secondary text-sm">
                发送给全部活跃角色。下一步填写内容，发送前核对实际人数。
              </p>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <InkInput
              label="邮件标题"
              value={title}
              onChange={setTitle}
              placeholder="例如：版本维护补偿"
            />
            <InkInput
              label="邮件正文"
              value={content}
              onChange={setContent}
              multiline
              rows={4}
            />
            <section className="border-ink/10 space-y-3 border-t pt-5">
              <h3 className="text-sm font-semibold">附件奖励</h3>
              <RewardSelectionEditor
                value={rewardSelections}
                onChange={setRewardSelections}
                disabled={loading}
                allowEmpty
              />
            </section>
          </>
        )}
        {step === 2 && (
          <>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                预计发送给{' '}
                <span className="font-mono">
                  {result?.totalRecipients ?? 0}
                </span>{' '}
                位角色
              </h3>
              <p className="text-ink-secondary text-sm">
                {mode === 'single'
                  ? '指定角色'
                  : mode === 'all'
                    ? '全部活跃角色'
                    : '按条件筛选'}
              </p>
              {result?.sampleRecipients?.length ? (
                <p className="text-ink-secondary text-sm break-words">
                  收件人示例：
                  {result.sampleRecipients
                    .map((r) => r.metadata?.cultivatorName ?? r.recipientKey)
                    .join('、')}
                </p>
              ) : null}
            </div>
            <article className="border-ink/10 space-y-3 border-y py-5">
              <h3 className="font-semibold break-words">{title}</h3>
              <p className="text-sm leading-7 break-words whitespace-pre-wrap">
                {content}
              </p>
            </article>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">每位角色获得</h3>
              <RewardSelectionPreview value={rewardSelections} />
            </section>
          </>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-crimson text-sm">
          {error}
        </p>
      )}
      <div className="border-ink/15 flex justify-between gap-3 border-t pt-4">
        {step > 0 ? (
          <InkButton
            disabled={loading}
            onClick={() => {
              setError('');
              setStep(step - 1);
            }}
          >
            上一步
          </InkButton>
        ) : (
          <span />
        )}
        <InkButton
          variant="primary"
          pending={loading}
          disabled={step === 2 && !result?.totalRecipients}
          onClick={() => (step === 0 ? next() : void submit(step === 1))}
        >
          {step === 0
            ? '下一步：内容与奖励'
            : step === 1
              ? '预览收件人与奖励'
              : '确认发送'}
        </InkButton>
      </div>
    </div>
  );
}
