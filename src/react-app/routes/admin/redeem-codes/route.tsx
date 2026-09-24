import { InkButton } from '@app/components/ui/InkButton';
import { AdminPageHeader } from '../_components/AdminPage';
import { RedeemCodesTable } from './_components/RedeemCodesTable';
export default function RedeemCodesPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="兑换码"
        description="查看领取情况，管理奖励与有效期。"
        actions={
          <InkButton href="/admin/redeem-codes/new" variant="primary">
            新建兑换码
          </InkButton>
        }
      />
      <RedeemCodesTable />
    </div>
  );
}
