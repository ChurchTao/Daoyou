import { InkButton, InkNotice } from '@app/components/ui';
import type { SectCurrentData } from '@shared/contracts/sect';
import { sectJsonRequest, type SectAction } from './types';

export function CommissionsTab({
  data,
  busy,
  action,
}: {
  data: SectCurrentData;
  busy: boolean;
  action: SectAction;
}) {
  if (!data.sect) return <InkNotice>拜师后方可承接宗门委托。</InkNotice>;
  return (
    <div className="space-y-3">
      <InkNotice>
        {data.commission.claimedAt
          ? '今日委托奖励已领取。'
          : data.commission.completedAt
            ? '今日委托已完成，可领取奖励。'
            : '今日尚未完成宗门委托。'}
      </InkNotice>
      <div className="flex gap-2">
        {!data.commission.completedAt ? (
          <InkButton
            disabled={busy}
            onClick={() =>
              void action(
                '/api/sects/current/commissions/spar',
                sectJsonRequest('POST'),
              )
            }
          >
            完成切磋委托
          </InkButton>
        ) : null}
        {data.commission.completedAt && !data.commission.claimedAt ? (
          <InkButton
            variant="primary"
            disabled={busy}
            onClick={() =>
              void action(
                '/api/sects/current/commissions/claim',
                sectJsonRequest('POST'),
              )
            }
          >
            领取贡献
          </InkButton>
        ) : null}
      </div>
    </div>
  );
}
