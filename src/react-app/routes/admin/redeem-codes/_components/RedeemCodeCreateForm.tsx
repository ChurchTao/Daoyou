import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput } from '@app/components/ui';
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

export function RedeemCodeCreateForm() {
  const { pushToast } = useInkUI();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [rewardSelections, setRewardSelections] = useState<
    RewardSelectionDraft[]
  >([]);
  const [mailTitle, setMailTitle] = useState('');
  const [mailContent, setMailContent] = useState('');
  const [totalLimit, setTotalLimit] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [error, setError] = useState('');
  const next = () => {
    try {
      if (step === 0) {
        if (!mailTitle.trim() || !mailContent.trim())
          throw new Error('请填写奖励邮件的标题与正文');
        parseRewardSelectionDrafts(rewardSelections);
      } else {
        if (
          totalLimit &&
          (!Number.isInteger(Number(totalLimit)) ||
            Number(totalLimit) < 1 ||
            Number(totalLimit) > 100000000)
        )
          throw new Error('领取名额必须为 1 至 100000000 的整数');
        if (startsAt && endsAt && startsAt > endsAt)
          throw new Error('结束时间不能早于生效时间');
      }
      setError('');
      setStep(step + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请检查配置');
    }
  };
  const submit = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/redeem-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim() || undefined,
          rewardSelections: parseRewardSelectionDrafts(rewardSelections),
          mailTitle: mailTitle.trim(),
          mailContent: mailContent.trim(),
          totalLimit: totalLimit.trim() ? Number(totalLimit) : null,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '创建兑换码失败');
      setCreatedCode(data.redeemCode.code);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建兑换码失败');
    } finally {
      setLoading(false);
    }
  };
  if (step === 3)
    return (
      <div className="space-y-5 py-8" role="status">
        <h3 className="text-xl font-semibold">兑换码已创建</h3>
        <p className="font-mono text-2xl break-all">{createdCode}</p>
        <div className="flex flex-wrap gap-3">
          <InkButton
            variant="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(createdCode);
                pushToast({ message: '兑换码已复制', tone: 'success' });
              } catch {
                pushToast({
                  message: '复制失败，请手动选择兑换码复制',
                  tone: 'warning',
                });
              }
            }}
          >
            复制兑换码
          </InkButton>
          <InkButton href="/admin/redeem-codes">返回列表</InkButton>
        </div>
      </div>
    );
  return (
    <div className="max-w-3xl space-y-6">
      <AdminSteps
        labels={['奖励与邮件', '领取设置', '核对创建']}
        current={step}
      />
      <fieldset disabled={loading} className="min-w-0 space-y-5">
        {step === 0 && (
          <>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">兑换奖励</h3>
              <RewardSelectionEditor
                value={rewardSelections}
                onChange={setRewardSelections}
                disabled={loading}
              />
            </section>
            <div className="border-ink/10 space-y-4 border-t pt-5">
              <InkInput
                label="邮件标题"
                value={mailTitle}
                onChange={setMailTitle}
                placeholder="例如：活动兑换奖励"
              />
              <InkInput
                label="邮件正文"
                value={mailContent}
                onChange={setMailContent}
                multiline
                rows={4}
              />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <InkInput
              label="兑换码"
              value={code}
              onChange={(v) => setCode(v.toUpperCase())}
              placeholder="留空自动生成"
            />
            <InkInput
              label="领取名额"
              type="number"
              min={1}
              max={100000000}
              value={totalLimit}
              onChange={setTotalLimit}
              placeholder="留空表示不限"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <InkInput
                label="生效时间"
                type="datetime-local"
                value={startsAt}
                onChange={setStartsAt}
                hint="留空立即生效"
              />
              <InkInput
                label="结束时间"
                type="datetime-local"
                value={endsAt}
                onChange={setEndsAt}
                hint="留空长期有效"
              />
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-ink-secondary">兑换码</dt>
              <dd className="font-mono break-all">{code || '自动生成'}</dd>
              <dt className="text-ink-secondary">领取名额</dt>
              <dd className="font-mono">{totalLimit || '不限'}</dd>
              <dt className="text-ink-secondary">生效时间</dt>
              <dd>
                {startsAt ? new Date(startsAt).toLocaleString() : '立即生效'}
              </dd>
              <dt className="text-ink-secondary">结束时间</dt>
              <dd>{endsAt ? new Date(endsAt).toLocaleString() : '长期有效'}</dd>
            </dl>
            <section className="border-ink/10 space-y-3 border-y py-5">
              <h3 className="font-semibold break-words">{mailTitle}</h3>
              <p className="text-sm leading-7 break-words whitespace-pre-wrap">
                {mailContent}
              </p>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">每次兑换获得</h3>
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
        <InkButton
          disabled={loading}
          href={step === 0 ? '/admin/redeem-codes' : undefined}
          onClick={() => {
            setError('');
            setStep(step - 1);
          }}
        >
          {step === 0 ? '取消' : '上一步'}
        </InkButton>
        <InkButton
          variant="primary"
          pending={loading}
          onClick={() => (step < 2 ? next() : void submit())}
        >
          {step === 2 ? '确认创建' : '下一步'}
        </InkButton>
      </div>
    </div>
  );
}
