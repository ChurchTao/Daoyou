import { InkButton, InkInput, InkSelect } from '@app/components/ui';
import {
  SystemMailInputSchema,
  formatMailTime,
  systemMailConditionSummary,
  type MailRealm,
  type SystemMailCampaign,
  type SystemMailInput,
} from '@shared/contracts/systemMail';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@shared/lib/sponsorship';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@shared/types/constants';
import { useRef, useState } from 'react';
import { AdminDialog } from '../../_components/AdminDialog';
import { AdminSteps } from '../../_components/AdminPage';
import {
  RewardSelectionEditor,
  RewardSelectionPreview,
} from '../../_components/RewardSelectionEditor';
import { parseRewardSelectionDrafts } from '../../_components/RewardSelectionEditor.helpers';
import {
  beijingInput,
  beijingInstant,
  rewardDrafts,
  systemMailRequest,
} from './systemMailUi';

const realmOptions = REALM_VALUES.flatMap((realm) =>
  REALM_STAGE_VALUES.map((stage) => ({ realm, stage })),
);
const realmKey = (realm?: MailRealm) =>
  realm ? `${realm.realm}/${realm.stage}` : '';
const parseRealm = (value: string) =>
  realmOptions.find((realm) => realmKey(realm) === value);

export function SystemMailEditor({
  initial,
  copy = false,
  onClose,
  onSaved,
}: {
  initial?: SystemMailCampaign;
  copy?: boolean;
  onClose: () => void;
  onSaved: (published: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [rewards, setRewards] = useState(() =>
    rewardDrafts(initial?.rewardSelections ?? []),
  );
  const [mode, setMode] = useState(
    initial?.conditions.targetCultivatorId
      ? 'single'
      : (initial &&
            Object.keys(initial.conditions).some(
              (k) => k !== 'createdBeforePublication',
            )) ||
          initial?.conditions.createdBeforePublication
        ? 'filtered'
        : 'all',
  );
  const [target, setTarget] = useState(
    initial?.conditions.targetCultivatorId ?? '',
  );
  const [startsAt, setStartsAt] = useState(() =>
    beijingInput(copy ? Date.now() : (initial?.startsAt ?? Date.now())),
  );
  const [endsAt, setEndsAt] = useState(() =>
    beijingInput(
      copy
        ? Date.now() + 7 * 86400000
        : (initial?.endsAt ?? Date.now() + 7 * 86400000),
    ),
  );
  const [createdFrom, setCreatedFrom] = useState(
    initial?.conditions.createdFrom
      ? beijingInput(initial.conditions.createdFrom)
      : '',
  );
  const [createdBefore, setCreatedBefore] = useState(
    initial?.conditions.createdBefore
      ? beijingInput(initial.conditions.createdBefore)
      : '',
  );
  const [beforePublication, setBeforePublication] = useState(
    initial?.conditions.createdBeforePublication ?? false,
  );
  const [realmMin, setRealmMin] = useState(
    realmKey(initial?.conditions.realmMin),
  );
  const [realmMax, setRealmMax] = useState(
    realmKey(initial?.conditions.realmMax),
  );
  const [sponsorMode, setSponsorMode] = useState(
    initial?.conditions.sponsorship?.mode ?? 'none',
  );
  const [tiers, setTiers] = useState<SponsorshipTierId[]>(
    initial?.conditions.sponsorship?.tiers ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState<SystemMailInput | null>(null);
  const saved = useRef<{
    id: string;
    revision: number;
    fingerprint?: string;
  } | null>(
    initial && !copy ? { id: initial.id, revision: initial.revision } : null,
  );
  const creation = useRef<{ id: string; fingerprint: string } | null>(null);

  function input(): SystemMailInput {
    const filtered = mode !== 'all';
    const result = SystemMailInputSchema.safeParse({
      title,
      content,
      rewardSelections: parseRewardSelectionDrafts(rewards, {
        allowEmpty: true,
      }),
      startsAt: beijingInstant(startsAt),
      endsAt: beijingInstant(endsAt),
      conditions: {
        ...(mode === 'single' ? { targetCultivatorId: target.trim() } : {}),
        createdBeforePublication: filtered && beforePublication,
        ...(filtered && createdFrom
          ? { createdFrom: beijingInstant(createdFrom) }
          : {}),
        ...(filtered && createdBefore
          ? { createdBefore: beijingInstant(createdBefore) }
          : {}),
        ...(filtered && realmMin ? { realmMin: parseRealm(realmMin) } : {}),
        ...(filtered && realmMax ? { realmMax: parseRealm(realmMax) } : {}),
        ...(filtered && sponsorMode !== 'none'
          ? { sponsorship: { mode: sponsorMode, tiers } }
          : {}),
      },
    });
    if (!result.success)
      throw new Error(result.error.issues[0]?.message ?? '请检查邮件配置');
    if (
      mode === 'filtered' &&
      !beforePublication &&
      !createdFrom &&
      !createdBefore &&
      !realmMin &&
      !realmMax &&
      sponsorMode === 'none'
    )
      throw new Error('请设置至少一项条件，或选择全部有效角色');
    return result.data;
  }
  function next() {
    setError('');
    try {
      if (step === 0) {
        if (!title.trim() || !content.trim())
          throw new Error('请填写标题和正文');
        parseRewardSelectionDrafts(rewards, { allowEmpty: true });
      } else setReview(input());
      setStep(step + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请检查配置');
    }
  }
  async function submit(publish: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const value = input();
      if (publish && Date.parse(value.endsAt) <= Date.now())
        throw new Error('投递结束时间已过，请修改时间');
      const fingerprint = JSON.stringify(value);
      if (saved.current?.fingerprint !== fingerprint) {
        if (saved.current) {
          const updated = await systemMailRequest<{
            id: string;
            revision: number;
          }>(`/${saved.current.id}`, 'PUT', {
            revision: saved.current.revision,
            input: value,
          });
          saved.current = { ...updated, fingerprint };
        } else {
          if (creation.current?.fingerprint !== fingerprint)
            creation.current = { id: crypto.randomUUID(), fingerprint };
          const created = await systemMailRequest<{
            id: string;
            revision: number;
          }>('', 'POST', { requestId: creation.current.id, input: value });
          saved.current = { ...created, fingerprint };
        }
      }
      if (publish)
        await systemMailRequest(`/${saved.current!.id}/publish`, 'POST', {
          revision: saved.current!.revision,
        });
      onSaved(publish);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminDialog
      open
      wide
      title={initial && !copy ? '编辑系统邮件' : '新建系统邮件'}
      busy={busy}
      error={error}
      onClose={onClose}
      footer={
        <>
          {step > 0 && (
            <InkButton
              disabled={busy}
              onClick={() => {
                setStep(step - 1);
                setError('');
              }}
            >
              上一步
            </InkButton>
          )}
          <InkButton disabled={busy} onClick={() => void submit(false)}>
            保存草稿
          </InkButton>
          <InkButton
            variant="primary"
            pending={busy}
            onClick={() => (step === 2 ? void submit(true) : next())}
          >
            {step === 2 ? '确认发布' : '下一步'}
          </InkButton>
        </>
      }
    >
      <div className="space-y-6">
        <AdminSteps
          labels={['内容与奖励', '条件与时间', '核对发布']}
          current={step}
        />
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {step === 0 && (
            <>
              <InkInput label="邮件标题" value={title} onChange={setTitle} />
              <InkInput
                label="邮件正文"
                value={content}
                onChange={setContent}
                multiline
                rows={4}
              />
              <section className="border-ink/10 space-y-3 border-t pt-4">
                <h4 className="font-semibold">附件奖励</h4>
                <RewardSelectionEditor
                  value={rewards}
                  onChange={setRewards}
                  disabled={busy}
                  allowEmpty
                />
              </section>
            </>
          )}
          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <InkInput
                  label="投递开始（北京时间）"
                  type="datetime-local"
                  value={startsAt}
                  onChange={setStartsAt}
                />
                <InkInput
                  label="投递结束（不含此时刻）"
                  type="datetime-local"
                  value={endsAt}
                  onChange={setEndsAt}
                />
              </div>
              <InkSelect label="投递范围" value={mode} onChange={setMode}>
                <option value="all">全部有效角色</option>
                <option value="filtered">按条件筛选</option>
                <option value="single">指定角色</option>
              </InkSelect>
              {mode === 'single' && (
                <InkInput
                  label="目标角色 ID"
                  value={target}
                  onChange={setTarget}
                  placeholder="填写角色的 cultivatorId"
                />
              )}
              {mode !== 'all' && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={beforePublication}
                      onChange={(e) => setBeforePublication(e.target.checked)}
                    />
                    仅发布前创建的角色
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InkInput
                      label="角色创建不早于（可选）"
                      type="datetime-local"
                      value={createdFrom}
                      onChange={setCreatedFrom}
                    />
                    <InkInput
                      label="角色创建早于（可选）"
                      type="datetime-local"
                      value={createdBefore}
                      onChange={setCreatedBefore}
                    />
                    <InkSelect
                      label="境界下限"
                      value={realmMin}
                      onChange={setRealmMin}
                    >
                      <option value="">不限</option>
                      {realmOptions.map((r) => (
                        <option key={realmKey(r)} value={realmKey(r)}>
                          {r.realm}
                          {r.stage}
                        </option>
                      ))}
                    </InkSelect>
                    <InkSelect
                      label="境界上限"
                      value={realmMax}
                      onChange={setRealmMax}
                    >
                      <option value="">不限</option>
                      {realmOptions.map((r) => (
                        <option key={realmKey(r)} value={realmKey(r)}>
                          {r.realm}
                          {r.stage}
                        </option>
                      ))}
                    </InkSelect>
                  </div>
                  <InkSelect
                    label="历史最高赞助级别"
                    value={sponsorMode}
                    onChange={(v) => {
                      setSponsorMode(v);
                      setTiers([]);
                    }}
                  >
                    <option value="none">不限</option>
                    <option value="at_least">不低于指定级别</option>
                    <option value="one_of">属于指定级别</option>
                  </InkSelect>
                  {sponsorMode === 'at_least' && (
                    <InkSelect
                      label="最低级别"
                      value={tiers[0] ?? ''}
                      onChange={(v) =>
                        setTiers(v ? [v as SponsorshipTierId] : [])
                      }
                    >
                      <option value="">请选择</option>
                      {SPONSORSHIP_TIER_IDS.map((t) => (
                        <option key={t} value={t}>
                          {SPONSORSHIP_TIER_META[t].name}
                        </option>
                      ))}
                    </InkSelect>
                  )}
                  {sponsorMode === 'one_of' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {SPONSORSHIP_TIER_IDS.map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={tiers.includes(t)}
                            onChange={(e) =>
                              setTiers(
                                e.target.checked
                                  ? [...tiers, t]
                                  : tiers.filter((v) => v !== t),
                              )
                            }
                          />
                          {SPONSORSHIP_TIER_META[t].name}
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
              <p className="text-ink-secondary text-sm">
                所有条件须同时满足。角色上线或在线期间检查，符合条件后每位角色投递一次。
              </p>
            </>
          )}
          {step === 2 && review && (
            <>
              <article className="space-y-3">
                <h4 className="text-lg font-semibold break-words">
                  {review.title}
                </h4>
                <p className="text-sm leading-7 break-words whitespace-pre-wrap">
                  {review.content}
                </p>
              </article>
              <section className="border-ink/10 space-y-2 border-y py-4">
                <p className="text-sm">
                  {formatMailTime(review.startsAt)} 至{' '}
                  {formatMailTime(review.endsAt)}（北京时间，结束时刻不含）
                </p>
                {systemMailConditionSummary(review.conditions).map((line) => (
                  <p key={line} className="text-sm break-words">
                    {line}
                  </p>
                ))}
              </section>
              <RewardSelectionPreview value={rewards} />
              <p className="text-ink-secondary text-sm">
                发布后内容与条件固定，可停止后续投递。已收到的邮件仍可正常领取。
              </p>
            </>
          )}
        </fieldset>
      </div>
    </AdminDialog>
  );
}
