import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import {
  MentorshipProfileSchema,
  type MentorshipProfileInput,
  type MentorshipProfileView,
} from '@daoyou/contracts/mentorship';
import { useId, useState, type FormEvent } from 'react';

const recruitmentSchema = MentorshipProfileSchema.omit({ requestId: true });

type RecruitmentValues = Omit<MentorshipProfileInput, 'requestId'>;
type FieldErrors = Partial<
  Record<'directions' | 'availableTimes' | 'introduction' | 'form', string>
>;

export function RecruitmentEditor({
  profile,
  pending,
  error,
  onSave,
  onClose,
  onReadLatest,
}: {
  profile: MentorshipProfileView | null;
  pending: boolean;
  error?: string;
  onSave: (value: RecruitmentValues) => Promise<boolean>;
  onClose: () => void;
  onReadLatest?: () => Promise<MentorshipProfileView | null>;
}) {
  // Keep the revision and draft from when the editor opened. Background refreshes
  // must not replace a player's unfinished recruitment notice.
  const [initialProfile] = useState(() => profile);
  const [open, setOpen] = useState(initialProfile?.open ?? false);
  const [directions, setDirections] = useState(
    initialProfile?.directions.join('、') ?? '',
  );
  const [availableTimes, setAvailableTimes] = useState(
    initialProfile?.availableTimes ?? '',
  );
  const [introduction, setIntroduction] = useState(
    initialProfile?.introduction ?? '',
  );
  const [expectedRevision, setExpectedRevision] = useState(
    initialProfile?.revision ?? 0,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [reading, setReading] = useState(false);
  const [latest, setLatest] = useState<{
    profile: MentorshipProfileView | null;
  } | null>(null);
  const [readError, setReadError] = useState('');
  const [adopted, setAdopted] = useState(false);
  const descriptionId = useId();
  const unavailable = pending || submitting || reading;

  async function readLatest() {
    if (unavailable || !onReadLatest) return;
    setReading(true);
    setReadError('');
    setAdopted(false);
    try {
      setLatest({ profile: await onReadLatest() });
    } catch (reason) {
      setReadError(
        reason instanceof Error ? reason.message : '读取失败，请稍后再试。',
      );
    } finally {
      setReading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unavailable) return;
    const parsed = recruitmentSchema.safeParse({
      open,
      directions: directions
        .split(/[、，,]/)
        .map((value) => value.trim())
        .filter(Boolean),
      availableTimes,
      introduction,
      expectedRevision,
    });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        switch (issue.path[0]) {
          case 'directions':
            nextErrors.directions =
              issue.path.length > 1
                ? '每个擅长方向最多20字，请缩短后再保存。'
                : '最多填写5个擅长方向，请删减后再保存。';
            break;
          case 'availableTimes':
            nextErrors.availableTimes = '常用时段最多100字。';
            break;
          case 'introduction':
            nextErrors.introduction = '收徒自述最多300字。';
            break;
          default:
            nextErrors.form = '招募信息无效，请检查后再试。';
        }
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setLatest(null);
    setReadError('');
    setAdopted(false);
    setSubmitting(true);
    try {
      if (await onSave(parsed.data)) onClose();
    } catch (reason) {
      setErrors({
        form:
          reason instanceof Error ? reason.message : '保存失败，请稍后再试。',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      id="mentorship-recruitment-form"
      aria-label="收徒招募设置"
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-busy={unavailable || undefined}
      className="space-y-6"
    >
      <div className="space-y-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={open}
            disabled={unavailable}
            onChange={(event) => setOpen(event.target.checked)}
            aria-describedby={descriptionId}
            className="accent-crimson focus-visible:outline-crimson size-5 shrink-0"
          />
          <span className="font-semibold">公开招收弟子</span>
        </label>
        <p id={descriptionId} className="text-ink-secondary text-sm leading-6">
          开启后，道友可在寻师名录中看见你的招募。关闭不影响现有弟子。
        </p>
      </div>

      <div className="space-y-5">
        <InkInput
          label="擅长方向"
          value={directions}
          onChange={(value) => {
            setDirections(value);
            setErrors((previous) => ({ ...previous, directions: undefined }));
          }}
          disabled={unavailable}
          placeholder="例如宗门配装、功法修行、育兽"
          hint="选填，最多5项，每项20字，以顿号或逗号分隔。"
          error={errors.directions}
          className="min-h-11"
        />
        <InkInput
          label="常用时段"
          value={availableTimes}
          onChange={(value) => {
            setAvailableTimes(value);
            setErrors((previous) => ({
              ...previous,
              availableTimes: undefined,
            }));
          }}
          disabled={unavailable}
          maxLength={100}
          placeholder="例如工作日晚间，通常次日回复"
          hint="选填，让后辈知道何时方便与你交流。"
          error={errors.availableTimes}
          className="min-h-11"
        />
        <InkInput
          label="收徒自述"
          value={introduction}
          onChange={(value) => {
            setIntroduction(value);
            setErrors((previous) => ({ ...previous, introduction: undefined }));
          }}
          disabled={unavailable}
          maxLength={300}
          multiline
          rows={5}
          placeholder="想与怎样的后辈结缘？你愿意分享哪些修行心得？"
          hint="选填，最多300字。"
          error={errors.introduction}
        />
      </div>

      {error || errors.form ? (
        <p role="alert" className="text-crimson text-sm leading-6">
          {errors.form || error}
        </p>
      ) : null}
      {errors.directions || errors.availableTimes || errors.introduction ? (
        <p role="alert" className="text-crimson text-sm">
          请检查标出的招募信息，填写内容已保留。
        </p>
      ) : null}

      {error && onReadLatest ? (
        <section className="border-ink/15 space-y-3 border-t pt-4">
          <p className="text-ink-secondary text-sm leading-6">
            草稿仍在。可先核对最新发布的资料，再决定是否用此草稿保存。
          </p>
          {!latest && !adopted ? (
            <InkButton
              variant="secondary"
              onClick={() => void readLatest()}
              pending={reading}
              pendingLabel="读取中……"
              disabled={pending || submitting}
              className="min-h-11"
            >
              核对最新资料
            </InkButton>
          ) : null}
          {readError ? (
            <p role="alert" className="text-crimson text-sm leading-6">
              {readError}
            </p>
          ) : null}
          {latest && !adopted ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">最新已发布资料</h3>
              {latest.profile ? (
                <dl className="space-y-3 text-sm leading-6">
                  <div>
                    <dt className="text-ink-secondary text-xs">招募状态</dt>
                    <dd>{latest.profile.open ? '公开收徒中' : '招募已关闭'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary text-xs">擅长方向</dt>
                    <dd className="break-words">
                      {latest.profile.directions.join('、') || '未填写'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary text-xs">常用时段</dt>
                    <dd className="break-words whitespace-pre-wrap">
                      {latest.profile.availableTimes || '未填写'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary text-xs">收徒自述</dt>
                    <dd className="break-words whitespace-pre-wrap">
                      {latest.profile.introduction || '未填写'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-ink-secondary text-sm">
                  当前尚未发布招募资料。
                </p>
              )}
              <p className="text-ink-secondary text-sm leading-6">
                采用此版本只更新保存依据，当前草稿保持不变。再次保存会用草稿替换上述资料。
              </p>
              <InkButton
                disabled={unavailable}
                onClick={() => {
                  setExpectedRevision(latest.profile?.revision ?? 0);
                  setAdopted(true);
                }}
                className="min-h-11"
              >
                保留草稿并采用此版本
              </InkButton>
            </div>
          ) : null}
          {adopted ? (
            <p role="status" className="text-teal text-sm leading-6">
              已采用最新版本，请核对草稿后保存
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="border-ink/15 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <InkButton
          variant="secondary"
          disabled={unavailable}
          onClick={onClose}
          className="min-h-11"
        >
          取消
        </InkButton>
        <InkButton
          type="submit"
          variant="primary"
          pending={unavailable}
          pendingLabel={reading ? '核对资料中……' : '保存中……'}
          className="min-h-11"
        >
          保存招募
        </InkButton>
      </div>
    </form>
  );
}
