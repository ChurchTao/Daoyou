import { AdminPageHeader } from '@app/routes/admin/_components/AdminPage';
import { useState } from 'react';
import { ManualPanel } from './ManualPanel';
import { OrdersPanel } from './OrdersPanel';
import { PlansPanel } from './PlansPanel';

const TABS = [
  ['orders', '订单'],
  ['plans', '方案'],
  ['manual', '人工处理'],
] as const;

type Tab = (typeof TABS)[number][0];

export default function SponsorshipAdminPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [notice, setNotice] = useState('');

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="功德簿管理"
        description="处理爱发电订单，并分别维护功德档位、订阅物资和历史补记。"
      />
      <div className="border-ink/10 flex flex-wrap gap-5 border-b pb-3 text-sm">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              tab === id
                ? 'text-crimson font-semibold'
                : 'text-ink-secondary hover:text-ink'
            }
            onClick={() => {
              setNotice('');
              setTab(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p className="border-ink/10 text-sm" role="status">
          {notice}
        </p>
      )}
      {tab === 'orders' && <OrdersPanel onNotice={setNotice} />}
      {tab === 'plans' && <PlansPanel onNotice={setNotice} />}
      {tab === 'manual' && <ManualPanel onNotice={setNotice} />}
    </div>
  );
}
