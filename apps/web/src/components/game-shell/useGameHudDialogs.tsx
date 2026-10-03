import {
  BodyCultivationSummaryContent,
  MarrowWashSummaryContent,
} from '@app/components/feature/cultivator/BodyCultivationPanels';
import { useQiState } from '@app/components/feature/cultivator/useQiState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import {
  BOTTLENECK_THRESHOLD,
  BREAKTHROUGH_MIN_PROGRESS,
  COMPREHENSION_INSIGHT_CAP,
  NORMAL_BREAKTHROUGH_THRESHOLD,
  PERFECT_BREAKTHROUGH_INSIGHT,
} from '@daoyou/shared/config/cultivationTuning';
import {
  QI_ACTION_COSTS,
  QI_DAILY_RESTORE_ITEM_LIMIT,
  QI_MAX,
  QI_NATURAL_RESTORE_INTERVAL_MS,
  QI_NATURAL_RESTORE_PER_INTERVAL,
  QI_OVERFLOW_MAX,
} from '@daoyou/shared/config/qiSystem';
import { getGameConceptInfo } from '@daoyou/shared/lib/gameConceptDisplay';
import { useNavigate } from 'react-router';
import { InfoTable, StatusDetailBlock } from './GameHudDialogContent';
import type { GameHudSnapshot } from './useGameHudModel';

function formatHudNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatQiDateTime(value: string | null): string {
  if (!value) return '--';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time));
}

function formatQiDuration(durationMs: number | null): string {
  if (durationMs === null) return '--';
  const totalMinutes = Math.max(0, Math.ceil(durationMs / 60_000));
  if (totalMinutes <= 0) return '即将恢复';

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return minutes > 0
      ? `${days}日${hours}时${minutes}分`
      : hours > 0
        ? `${days}日${hours}时`
        : `${days}日`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}时${minutes}分` : `${hours}时`;
  }
  return `${minutes}分`;
}

function formatQiRecoveryMoment(
  at: string | null,
  inMs: number | null,
): string {
  if (!at || inMs === null) return '--';
  return `${formatQiDateTime(at)}（约 ${formatQiDuration(inMs)}）`;
}

const STATUS_CATEGORY_LABELS: Record<
  GameHudSnapshot['activeStatuses'][number]['category'],
  string
> = {
  pill: '丹药药力',
  breakthrough: '突破准备',
  injury: '伤势与虚弱',
  other: '其他状态',
};

export function useGameHudDialogs(
  snapshot: GameHudSnapshot | null,
  qiState: ReturnType<typeof useQiState>['state'],
  qiError: ReturnType<typeof useQiState>['error'],
) {
  const { closeDialog, openDialog } = useInkUI();
  const navigate = useNavigate();
  if (!snapshot) return null;

  const insightMetric = snapshot.metrics.find(
    (metric) => metric.key === 'insight',
  );
  const insightInfo = getGameConceptInfo('comprehension_insight');
  const qiInfo = getGameConceptInfo('world_qi');
  const qiRecovery = qiState?.recovery ?? null;
  const qiNextRestoreText =
    qiRecovery?.status === 'recovering'
      ? formatQiRecoveryMoment(
          qiRecovery.nextRestoreAt,
          qiRecovery.nextRestoreInMs,
        )
      : qiRecovery?.status === 'full'
        ? '已达自然上限'
        : qiRecovery?.status === 'overflow'
          ? '溢出期间暂停'
          : '恢复时机未定';
  const qiFullRestoreText =
    qiRecovery?.status === 'recovering'
      ? formatQiRecoveryMoment(
          qiRecovery.fullRestoreAt,
          qiRecovery.fullRestoreInMs,
        )
      : qiRecovery?.status === 'full'
        ? '已回满'
        : qiRecovery?.status === 'overflow'
          ? `降至 ${QI_MAX} 以下后重新计算`
          : '恢复时机未定';

  const openRealmInfo = () => {
    openDialog({
      title: '境界',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            境界代表当前道途层级，由大境界与小阶段共同组成。它会影响角色成长、玩法门槛、秘境匹配与突破目标。
          </p>
          <InfoTable
            rows={[
              {
                label: '当前境界',
                value: `${snapshot.realm}·${snapshot.realmStage}`,
              },
              {
                label: '提升方式',
                value: '在静室积累修为并尝试突破',
              },
              {
                label: '大境界',
                value: '通常还需完成破境卷宗',
              },
            ]}
          />
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  const openBodyCultivationInfo = () => {
    const openMarrowWashDetail = () => {
      closeDialog();
      void navigate('/game/cultivator?tab=body');
    };

    openDialog({
      title: '肉身炼体',
      content: (
        <div className="space-y-3 text-sm leading-7">
          <BodyCultivationSummaryContent
            summary={snapshot.bodyCultivation}
            dense
          />
          <div className="border-ink/10 bg-bgpaper/60 border border-dashed px-3 py-2 text-xs leading-5">
            <p className="text-ink">
              提升：服用炼体丹，丹力会进入对应的肉身轨道。
            </p>
            <p className="text-ink-secondary mt-1">
              进阶：五轨总等级与人物境界满足要求后，可无消耗、无失败地逐阶提升肉身阶位。
            </p>
          </div>
          <MarrowWashSummaryContent
            summary={snapshot.marrowWash}
            action={
              <InkButton
                onClick={openMarrowWashDetail}
                variant="secondary"
                className="text-xs"
              >
                查看详情
              </InkButton>
            }
          />
        </div>
      ),
      confirmLabel: '查看详情',
      cancelLabel: '知道了',
      onConfirm: () => navigate('/game/cultivator?tab=body'),
    });
  };

  const openCultivationInfo = () => {
    const cultivationLabel = getGameConceptInfo('cultivation_exp').label;
    const progress = snapshot.cultivationProgress;
    const nextThreshold = Math.ceil(
      (progress.cap * BREAKTHROUGH_MIN_PROGRESS) / 100,
    );
    const normalThreshold = Math.ceil(
      (progress.cap * NORMAL_BREAKTHROUGH_THRESHOLD) / 100,
    );
    const bottleneckThreshold = Math.ceil(
      (progress.cap * BOTTLENECK_THRESHOLD) / 100,
    );
    openDialog({
      title: cultivationLabel,
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            {cultivationLabel}
            是当前小阶段内的积累。闭关、秘境、任务与部分丹药都可能带来
            {cultivationLabel}
            增长；突破成功后会扣除当前阶段所需修为，溢出的积累会带入下一阶段。
          </p>
          <p>
            进度越接近上限，越适合在静室冲关。未满时也可强行尝试，但失败会折损修为，并可能提高走火入魔风险。
          </p>
          <InfoTable
            rows={[
              {
                label: '当前修为',
                value: `${formatHudNumber(progress.current)} / ${formatHudNumber(progress.cap)}`,
              },
              {
                label: '当前进度',
                value: `${progress.percent}%`,
              },
              ...(progress.overflow > 0
                ? [
                    {
                      label: '溢出修为',
                      value: formatHudNumber(progress.overflow),
                    },
                  ]
                : []),
              {
                label: insightInfo.label,
                value: `${progress.insight} / ${COMPREHENSION_INSIGHT_CAP}`,
              },
              {
                label: '强行突破',
                value: `${formatHudNumber(nextThreshold)} 修为起可尝试（${BREAKTHROUGH_MIN_PROGRESS}%）`,
              },
              {
                label: '常规突破',
                value: `${formatHudNumber(normalThreshold)} 修为起较稳（${NORMAL_BREAKTHROUGH_THRESHOLD}%）`,
              },
              {
                label: '圆满突破',
                value: `${formatHudNumber(progress.cap)} 修为且${insightInfo.label} ${PERFECT_BREAKTHROUGH_INSIGHT}+`,
              },
              {
                label: '瓶颈期',
                value: progress.bottleneckState
                  ? `已进入，闭关收益衰减（阈值 ${formatHudNumber(bottleneckThreshold)}）`
                  : `${formatHudNumber(bottleneckThreshold)} 修为后可能进入（${BOTTLENECK_THRESHOLD}%）`,
              },
              {
                label: '冲关失败',
                value:
                  progress.breakthroughFailures > 0
                    ? `连续 ${progress.breakthroughFailures} 次`
                    : '暂无连续失败',
              },
              {
                label: '走火风险',
                value: progress.innerDemon
                  ? `心魔缠身，风险 ${progress.deviationRisk}%`
                  : `${progress.deviationRisk}%`,
              },
            ]}
          />
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  const openInsightInfo = () => {
    openDialog({
      title: `${insightInfo.icon} ${insightInfo.label}`,
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>
            {insightInfo.label}
            代表对功法、神通与天地法则的理解。它会参与突破火候，也会在推演功法、神通等玩法中作为关键消耗。
          </p>
          <InfoTable
            rows={[
              {
                label: `当前${insightInfo.label}`,
                value: insightMetric?.display ?? '--',
              },
              {
                label: '圆满突破',
                value: `至少需要 ${PERFECT_BREAKTHROUGH_INSIGHT}`,
              },
              {
                label: '获取途径',
                value: '闭关顿悟、秘境历练、任务或丹药',
              },
              {
                label: '主要用途',
                value: '辅助突破，推演功法与神通',
              },
            ]}
          />
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  const openQiInfo = () => {
    openDialog({
      title: `${qiInfo.icon} ${qiInfo.label}`,
      content: (
        <div className="space-y-3 text-sm leading-7">
          <p>进入秘境、闭关修行、突破与造物时需要消耗的一定的天地灵气。</p>
          <div className="border-ink/10 bg-bgpaper/70 space-y-1 border border-dashed px-3 py-2">
            <p>
              当前{qiInfo.label}：
              {qiState
                ? `${qiState.current}/${qiState.max}`
                : qiError
                  ? '暂不可查'
                  : '汇聚中'}
            </p>
            <p>
              每 {QI_NATURAL_RESTORE_INTERVAL_MS / 60_000} 分钟自然恢复{' '}
              {QI_NATURAL_RESTORE_PER_INTERVAL} 点，最高恢复到 {QI_MAX}。
            </p>
            <p>下次恢复：{qiState ? qiNextRestoreText : '--'}</p>
            <p>预计回满：{qiState ? qiFullRestoreText : '--'}</p>
          </div>
          <p>
            恢复符箓可临时溢出到 {QI_OVERFLOW_MAX}，每日最多使用{' '}
            {QI_DAILY_RESTORE_ITEM_LIMIT} 次。
          </p>
          <div className="border-ink/10 overflow-hidden border border-dashed">
            <table className="w-full border-collapse text-xs leading-5">
              <thead className="bg-ink/5 text-ink">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">玩法</th>
                  <th className="px-3 py-1.5 text-right font-medium">消耗</th>
                </tr>
              </thead>
              <tbody className="divide-ink/10 divide-y">
                <tr>
                  <td className="px-3 py-1.5">秘境探索</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    {QI_ACTION_COSTS.dungeon_start}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">突破</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    {QI_ACTION_COSTS.breakthrough_attempt}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">炼丹</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    1～20（每 200 药蕴 1 点）
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">炼器</td>
                  <td className="text-ink px-3 py-1.5 text-right font-mono">
                    7～39（随图纸境界）
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  const openStatusInfo = () => {
    const groupedStatuses = snapshot.activeStatuses.reduce(
      (groups, status) => {
        groups[status.category].push(status);
        return groups;
      },
      {
        pill: [],
        breakthrough: [],
        injury: [],
        other: [],
      } as Record<
        GameHudSnapshot['activeStatuses'][number]['category'],
        GameHudSnapshot['activeStatuses']
      >,
    );
    const hasStatuses = snapshot.activeStatuses.length > 0;
    const hasToxicity = snapshot.pillToxicity.active;

    openDialog({
      title: '当前状态',
      content: (
        <div className="space-y-4 text-sm leading-7">
          {!hasStatuses && !hasToxicity ? (
            <div className="border-ink/10 bg-bgpaper/70 space-y-2 border border-dashed px-3 py-2">
              <p className="text-ink font-medium">安稳</p>
              <p className="text-ink-secondary">
                当前没有持续伤势、丹药药力或突破准备状态。
              </p>
              <p className="text-ink-secondary">
                丹毒无明显压制，闭关与突破会按常规状态结算。
              </p>
            </div>
          ) : null}

          {hasToxicity ? (
            <section className="space-y-2">
              <p className="text-ink text-sm font-medium">丹毒</p>
              <div className="border-ink/10 bg-bgpaper/70 space-y-1 border border-dashed px-3 py-2 text-xs leading-5">
                <p>
                  当前：{snapshot.pillToxicity.label}（
                  {snapshot.pillToxicity.value}）
                </p>
                {snapshot.pillToxicity.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            </section>
          ) : null}

          {(
            Object.keys(groupedStatuses) as Array<keyof typeof groupedStatuses>
          ).map((category) => {
            const statuses = groupedStatuses[category];
            if (statuses.length === 0) return null;

            return (
              <section key={category} className="space-y-2">
                <p className="text-ink text-sm font-medium">
                  {STATUS_CATEGORY_LABELS[category]}
                </p>
                <div className="space-y-2">
                  {statuses.map((status, index) => (
                    <StatusDetailBlock
                      key={`${status.key}:${index}`}
                      status={status}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ),
      confirmLabel: null,
      cancelLabel: '知道了',
    });
  };

  return {
    openRealmInfo,
    openBodyCultivationInfo,
    openCultivationInfo,
    openInsightInfo,
    openQiInfo,
    openStatusInfo,
  };
}
