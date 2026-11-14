import { GameLoadingState } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkInput } from '@app/components/ui/InkInput';
import type {
  MentorshipMentorView,
  MentorshipRequestView,
} from '@daoyou/contracts/mentorship';

export function MentorDirectory({
  mentors,
  loading,
  error,
  canApprentice,
  blockReason,
  pendingRequests,
  search,
  onSearch,
  onSelect,
  onRequests,
  onRetry,
}: {
  mentors: MentorshipMentorView[] | undefined;
  loading: boolean;
  error?: string;
  canApprentice: boolean;
  blockReason: string;
  pendingRequests: MentorshipRequestView[];
  search: string;
  onSearch: (value: string) => void;
  onSelect: (mentor: MentorshipMentorView) => void;
  onRequests: () => void;
  onRetry: () => void;
}) {
  const query = search.trim().toLowerCase();
  const visible = mentors?.filter((mentor) =>
    [mentor.name, mentor.sectName ?? '', ...mentor.profile.directions]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
  const pending = pendingRequests.filter(
    (request) => request.status === 'pending',
  );

  return (
    <section className="space-y-5" aria-label="寻师名录">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">寻师名录</h2>
          {visible ? (
            <p className="text-ink-secondary text-sm" role="status">
              找到 <span className="font-mono">{visible.length}</span> 位师父
            </p>
          ) : null}
        </div>
        <p className="text-crimson text-sm leading-6">
          拜师礼成后，一生只认这一位师父。
        </p>
        {!canApprentice || pending.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            {!canApprentice ? (
              <p className="text-ink-secondary text-sm leading-6">
                {blockReason || '当前不符合拜师条件。'}
              </p>
            ) : (
              <p className="text-ink-secondary text-sm leading-6">
                有 <span className="font-mono">{pending.length}</span>{' '}
                份结缘申请待回应。
              </p>
            )}
            {pending.length > 0 ? (
              <InkButton
                variant="secondary"
                onClick={onRequests}
                className="min-h-11"
              >
                查看结缘申请
              </InkButton>
            ) : null}
          </div>
        ) : null}
        <InkInput
          type="search"
          label="寻找师父"
          placeholder="道号、宗门或擅长方向"
          value={search}
          onChange={onSearch}
          className="min-h-11"
        />
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="alert" className="text-crimson text-sm leading-6">
            {error}
          </p>
          <InkButton onClick={onRetry} pending={loading} className="min-h-11">
            重新寻访
          </InkButton>
        </div>
      ) : null}
      {loading && !mentors ? (
        <GameLoadingState message="正在寻访收徒的师父……" variant="inline" />
      ) : null}
      {loading && mentors ? (
        <p role="status" className="text-ink-secondary text-sm">
          正在更新名录……
        </p>
      ) : null}

      {visible?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((mentor) => {
            const application = pending.find(
              (request) => request.mentor.id === mentor.cultivatorId,
            );
            return (
              <InkChoiceButton
                key={mentor.cultivatorId}
                layout="card"
                selected={false}
                onClick={() => onSelect(mentor)}
                className="focus-visible:outline-crimson flex min-h-11 flex-col gap-4 p-5 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-semibold break-words">
                      {mentor.name}
                    </h3>
                    <p className="text-ink-secondary text-sm leading-6">
                      {mentor.realm}
                      {mentor.realmStage}
                      {mentor.sectName ? ` · ${mentor.sectName}` : ''}
                    </p>
                  </div>
                  <p className="text-teal shrink-0 text-sm leading-6">
                    余 <span className="font-mono">{mentor.remainingSeats}</span>{' '}
                    席
                  </p>
                </div>
                <div className="w-full flex-1 space-y-2">
                  <p className="text-sm leading-6 break-words">
                    {mentor.profile.directions.slice(0, 5).join(' · ') ||
                      '愿与后辈交流修行'}
                  </p>
                  {mentor.profile.availableTimes ? (
                    <p className="text-ink-secondary text-sm leading-6 break-words">
                      <span className="sr-only">常用时段：</span>
                      {mentor.profile.availableTimes}
                    </p>
                  ) : null}
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1 text-sm">
                  <span className="text-ink-secondary">
                    {application
                      ? application.incoming
                        ? '待你回应'
                        : '等待回复'
                      : '公开收徒'}
                  </span>
                  <span className="text-crimson">
                    {application || !canApprentice ? '查看资料' : '了解与拜师'}
                    <span aria-hidden="true" className="ml-1">
                      →
                    </span>
                  </span>
                </div>
              </InkChoiceButton>
            );
          })}
        </div>
      ) : visible?.length === 0 ? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-sm leading-7">
            {query
              ? '没有找到符合条件的师父。'
              : '暂未寻到开放收徒的师父。'}
          </p>
          <p className="text-ink-secondary text-sm leading-6">
            {query ? '换个道号、宗门或方向试试。' : '可稍后再访。'}
          </p>
          <InkButton
            onClick={query ? () => onSearch('') : onRetry}
            disabled={loading}
            className="min-h-11"
          >
            {query ? '清除搜索' : '重新寻访'}
          </InkButton>
        </div>
      ) : !loading && !error ? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-ink-secondary text-sm">名录尚未读取，请再试一次。</p>
          <InkButton onClick={onRetry} className="min-h-11">
            重新寻访
          </InkButton>
        </div>
      ) : null}
    </section>
  );
}
