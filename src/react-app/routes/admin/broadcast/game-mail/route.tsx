import { AdminPageHeader } from '../../_components/AdminPage';
import { GameMailBroadcastForm } from './GameMailBroadcastForm';

export default function AdminGameMailBroadcastPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="游戏邮件"
        description="选择收件人，配置内容与奖励，核对后发送。"
      />
      <GameMailBroadcastForm />
    </div>
  );
}
