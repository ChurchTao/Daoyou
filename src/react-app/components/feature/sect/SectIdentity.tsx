import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton, InkNotice } from '@app/components/ui';
import type {
  SectContextData,
  SectPromotionEvaluationData,
} from '@shared/contracts/sect';
import { SECT_RANK_LABELS } from '@shared/engine/sect';
import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import { getSectIdentityLabels } from './sectIdentityDisplay';
import {
  useActiveSectContextQuery,
  useSectPromotionEvaluationQuery,
} from './sectResources';

function formatSectDate(value?: string): string {
  if (!value) return '未录';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '未录';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function formatContribution(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function IdentityRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-ink/10 grid min-w-0 gap-1 border-b border-dashed py-2 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-4">
      <span className="text-ink-secondary text-sm">{label}</span>
      <span className="text-ink min-w-0 text-sm sm:text-right">{value}</span>
    </div>
  );
}

function PromotionStatus({
  promotion,
  loading,
  error,
}: {
  promotion?: SectPromotionEvaluationData;
  loading: boolean;
  error?: string;
}) {
  if (loading) {
    return <p className="text-ink-secondary text-sm">晋升考校正在核验……</p>;
  }
  if (error) {
    return <p className="text-crimson text-sm">{error}</p>;
  }
  if (!promotion) return null;
  if (!promotion.nextRank) {
    return <p className="text-ink text-sm">已列真传，暂无更高弟子职阶。</p>;
  }

  const nextRankLabel = SECT_RANK_LABELS[promotion.nextRank];
  return (
    <div className="space-y-2 text-sm leading-6">
      <p className="text-ink">下一身份：{nextRankLabel}</p>
      {promotion.allowed ? (
        <p className="text-teal">晋升条件已经齐备，可前往宗门事务办理。</p>
      ) : (
        <div className="space-y-1">
          <p className="text-ink-secondary">尚需完成：</p>
          {promotion.missing.map((requirement) => (
            <p key={requirement} className="text-ink pl-3">
              · {requirement}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectIdentityDetails({
  context,
  showJoinedAt = false,
  className,
}: {
  context: SectContextData;
  showJoinedAt?: boolean;
  className?: string;
}) {
  const labels = getSectIdentityLabels(context);
  return (
    <div
      className={cn(
        'border-ink/15 bg-bgpaper/55 border border-dashed px-3 py-1',
        className,
      )}
    >
      <IdentityRow label="宗门" value={labels.sectName} />
      <IdentityRow label="弟子身份" value={labels.rankLabel} />
      <IdentityRow label="宗门职司" value={labels.officeLabel} />
      <IdentityRow
        label="当前贡献"
        value={
          <span className="text-wood font-mono">
            {formatContribution(context.contribution)}
          </span>
        }
      />
      <IdentityRow
        label="累计贡献"
        value={
          <span className="text-wood/80 font-mono">
            {formatContribution(context.lifetimeContribution)}
          </span>
        }
      />
      {showJoinedAt ? (
        <IdentityRow
          label="入门时间"
          value={formatSectDate(context.joinedAt)}
        />
      ) : null}
    </div>
  );
}

export function SectIdentityDialogContent() {
  const context = useActiveSectContextQuery();
  const promotion = useSectPromotionEvaluationQuery(Boolean(context.data));

  if (!context.hasSect && !context.sessionLoading) {
    return <InkNotice>尚未拜入宗门，当前仍以散修身份行走。</InkNotice>;
  }
  if (context.error) {
    return (
      <InkNotice>
        <p>{context.error}</p>
        <InkButton onClick={() => void context.retry()}>重新核验</InkButton>
      </InkNotice>
    );
  }
  if (!context.data) {
    return <GameLoadingState message="身份玉牒正在显化……" variant="inline" />;
  }

  return (
    <div className="space-y-4">
      <SectIdentityDetails context={context.data} showJoinedAt />
      <section className="border-ink/15 border-t border-dashed pt-3">
        <p className="text-ink mb-2 text-sm font-medium">晋升定位</p>
        <PromotionStatus
          promotion={promotion.data}
          loading={promotion.loading}
          error={promotion.error}
        />
      </section>
    </div>
  );
}
